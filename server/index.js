const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "https://www.shithead.website", "https://shithead.website"],
    methods: ["GET", "POST"]
  }
});

// ─── UTILS ────────────────────────────────────────────────────

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makeDeck() {
  const suits = ["♠","♥","♦","♣"];
  const ranks = ["2","3","4","5","6","7","8","9","10","J","Q","K","A"];
  const deck = [];
  for (const suit of suits)
    for (const rank of ranks)
      deck.push({ rank, suit, id: `${rank}${suit}${Math.random().toString(36).slice(2,5)}` });
  return shuffle(deck);
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const RANK_VALUE = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10,"J":11,"Q":12,"K":13,"A":14 };

function effectiveTopCard(pile) {
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank !== "3") return pile[i];
  }
  return null;
}

function canPlay(card, pile, mustPlayLower) {
  if (card.rank === "2" || card.rank === "3" || card.rank === "10") return true;
  if (pile.length === 0) return true;
  const top = effectiveTopCard(pile);
  if (!top) return true;
  const val = RANK_VALUE[card.rank];
  if (mustPlayLower) return val < 7;
  return val >= RANK_VALUE[top.rank];
}

function checkBurn(pile) {
  if (pile.length < 4) return false;
  const top = pile[pile.length - 1];
  let count = 0;
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].rank === "3") continue;
    if (pile[i].rank === top.rank) count++;
    else break;
    if (count === 4) return true;
  }
  return false;
}

function hasNoCards(player) {
  return player.hand.length === 0 && player.faceUp.length === 0 && player.faceDown.length === 0;
}

// ─── GAME STATE ───────────────────────────────────────────────
// rooms: { [code]: { players, deck, pile, currentTurn, phase, mustPlayLower, hostId, burnedPile, finishOrder, shitheadCounts } }
const rooms = {};

function getRoom(code) { return rooms[code]; }

function broadcastState(code) {
  const room = getRoom(code);
  if (!room) return;

  // Send each player their own private state
  room.players.forEach(player => {
    const socket = io.sockets.sockets.get(player.id);
    if (!socket) return;

    // Build state: hide other players' hand cards and facedown cards
    const playersPublic = room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      faceUp: p.faceUp,
      faceDown: p.faceDown.map(() => ({ hidden: true })), // count only, no card info
      faceDownCount: p.faceDown.length,
      finished: p.finished,
      finishPosition: p.finishPosition,
      shitheadCount: p.shitheadCount || 0,
      isHost: p.id === room.hostId,
    }));

    socket.emit("gameState", {
      phase: room.phase,
      pile: room.pile,
      deckCount: room.deck.length,
      currentTurn: room.currentTurn,
      mustPlayLower: room.mustPlayLower,
      players: playersPublic,
      myHand: player.hand,
      myFaceUp: player.faceUp,
      myFaceDown: player.faceDown,
      myId: player.id,
      hostId: room.hostId,
      log: room.log,
      finishOrder: room.finishOrder || [],
      shitheadId: room.shitheadId || null,
      code,
    });
  });
}

function addLog(room, msg) {
  room.log = [msg, ...(room.log || [])].slice(0, 20);
}

// ─── SOCKET.IO ────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // ── CREATE PARTY ──────────────────────────────────────────
  socket.on("createParty", ({ name }) => {
    let code;
    do { code = generateCode(); } while (rooms[code]);

    rooms[code] = {
      code,
      hostId: socket.id,
      phase: "lobby",
      players: [{
        id: socket.id,
        name,
        hand: [],
        faceUp: [],
        faceDown: [],
        finished: false,
        finishPosition: null,
        shitheadCount: 0,
        setupDone: false,
      }],
      deck: [],
      pile: [],
      mustPlayLower: false,
      currentTurn: 0,
      log: [],
      finishOrder: [],
      shitheadId: null,
    };

    socket.join(code);
    socket.data.code = code;
    socket.emit("partyCreated", { code });
    broadcastState(code);
  });

  // ── JOIN PARTY ────────────────────────────────────────────
  socket.on("joinParty", ({ name, code }) => {
    const room = getRoom(code);
    if (!room) { socket.emit("error", "Room not found."); return; }
    if (room.phase !== "lobby") { socket.emit("error", "Game already in progress."); return; }
    if (room.players.length >= 5) { socket.emit("error", "Room is full (max 5 players)."); return; }

    room.players.push({
      id: socket.id,
      name,
      hand: [],
      faceUp: [],
      faceDown: [],
      finished: false,
      finishPosition: null,
      shitheadCount: 0,
      setupDone: false,
    });

    socket.join(code);
    socket.data.code = code;
    socket.emit("joinedParty", { code });
    broadcastState(code);
  });

  // ── START GAME ────────────────────────────────────────────
  socket.on("startGame", () => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room) return;
    if (socket.id !== room.hostId) return;
    if (room.players.length < 2) { socket.emit("error", "Need at least 2 players."); return; }

    const deck = makeDeck();
    room.deck = deck;
    room.pile = [];
    room.mustPlayLower = false;
    room.phase = "setup";
    room.finishOrder = [];
    room.shitheadId = null;

    // Deal 9 cards to each player (3 facedown, 6 hand — player picks 3 for faceup)
    room.players.forEach((p, i) => {
      const cards = deck.splice(0, 9);
      p.faceDown = cards.slice(0, 3);
      p.hand = cards.slice(3, 9);
      p.faceUp = [];
      p.finished = false;
      p.finishPosition = null;
      p.setupDone = false;
    });

    addLog(room, "Game started — choose your 3 face-up cards.");
    broadcastState(code);
  });

  // ── CONFIRM SETUP ─────────────────────────────────────────
  socket.on("confirmSetup", ({ cardIds }) => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room || room.phase !== "setup") return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player || player.setupDone) return;
    if (cardIds.length !== 3) return;

    const chosen = player.hand.filter(c => cardIds.includes(c.id));
    if (chosen.length !== 3) return;

    player.faceUp = chosen;
    player.hand = player.hand.filter(c => !cardIds.includes(c.id));
    player.setupDone = true;

    addLog(room, `${player.name} is ready.`);

    // Check if all players done
    if (room.players.every(p => p.setupDone)) {
      room.phase = "game";
      room.currentTurn = 0; // host starts
      addLog(room, `Game begins! ${room.players[0].name} goes first.`);
    }

    broadcastState(code);
  });

  // ── PLAY CARDS ────────────────────────────────────────────
  socket.on("playCards", ({ cardIds }) => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room || room.phase !== "game") return;

    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx !== room.currentTurn) return;

    const player = room.players[playerIdx];
    const source = player.hand.length > 0 ? "hand" : player.faceUp.length > 0 ? "faceUp" : "faceDown";
    const cards = cardIds.map(id => player[source].find(c => c.id === id)).filter(Boolean);

    if (cards.length === 0) return;

    // Validate same rank
    if (cards.some(c => c.rank !== cards[0].rank)) {
      socket.emit("error", "All played cards must be the same rank.");
      return;
    }

    // Validate playable (unless facedown — blind)
    if (source !== "faceDown") {
      if (!canPlay(cards[0], room.pile, room.mustPlayLower)) {
        socket.emit("error", "Cannot play that card.");
        return;
      }
    }

    // Remove from source
    player[source] = player[source].filter(c => !cardIds.includes(c.id));

    // Add to pile
    room.pile = [...room.pile, ...cards];

    // Draw back up to 3 from deck
    while (player.hand.length < 3 && room.deck.length > 0) {
      player.hand.push(room.deck.shift());
    }

    const rank = cards[0].rank;
    let burned = false;
    let extraTurn = false;
    let skipCount = 0;
    // Don't reset mustPlayLower yet — recalculate after pile is updated

    // Face-down illegal check
    if (source === "faceDown") {
      const legal = room.pile.length <= cards.length || canPlay(cards[0], room.pile.slice(0, room.pile.length - cards.length), false);
      if (!legal) {
        // Pick up whole pile
        player.hand = [...player.hand, ...room.pile];
        room.pile = [];
        room.mustPlayLower = false;
        addLog(room, `${player.name} flipped ${cards[0].rank}${cards[0].suit} blind — illegal! Picks up the pile.`);
        room.currentTurn = nextAlive(room, playerIdx, 1);
        broadcastState(code);
        return;
      }
    }

    // Special cards
    if (rank === '10') {
      burned = true;
      extraTurn = true;
      room.pile = [];
      room.mustPlayLower = false;
      addLog(room, player.name + ' played 10 — pile burns! Plays again.');
    } else if (checkBurn(room.pile)) {
      burned = true;
      extraTurn = true;
      room.pile = [];
      room.mustPlayLower = false;
      addLog(room, 'Four of a kind — auto burn! ' + player.name + ' plays again.');
    } else if (rank === '8') {
      skipCount = cards.length;
      room.mustPlayLower = false;
      addLog(room, player.name + ' played ' + cards.length + 'x 8 — skip' + (cards.length > 1 ? 's ' + cards.length + ' players' : 's next player') + '.');
    } else if (rank === '7') {
      room.mustPlayLower = true;
      addLog(room, player.name + ' played 7 — next must go lower.');
    } else if (rank === '2') {
      room.mustPlayLower = false;
      addLog(room, player.name + ' played 2 — pile reset.');
    } else if (rank === '3') {
      const effTop = effectiveTopCard(room.pile);
      room.mustPlayLower = effTop?.rank === '7';
      addLog(room, player.name + ' played 3 (invisible)' + (room.mustPlayLower ? ' — still on a 7, next must go lower' : '') + '.');
    } else {
      room.mustPlayLower = false;
      addLog(room, player.name + ' played ' + cards.map(c => c.rank + c.suit).join(', ') + '.');
    }

    // If pile was burned, mustPlayLower must be false
    if (room.pile.length === 0) room.mustPlayLower = false;

    // Check if player finished
    if (hasNoCards(player) && !player.finished) {
      player.finished = true;
      player.finishPosition = room.finishOrder.length + 1;
      room.finishOrder.push(player.id);
      addLog(room, `✅ ${player.name} is out!`);
    }

    // Check game over (only 1 active player left)
    const activePlayers = room.players.filter(p => !p.finished);
    if (activePlayers.length === 1) {
      const shithead = activePlayers[0];
      shithead.shitheadCount = (shithead.shitheadCount || 0) + 1;
      room.shitheadId = shithead.id;
      room.finishOrder.push(shithead.id);
      room.phase = "results";
      addLog(room, `💀 ${shithead.name} is the Shithead!`);
      broadcastState(code);
      return;
    }

    // Advance turn
    if (extraTurn) {
      // Stay on same player (but check they're still active)
      if (player.finished) {
        room.currentTurn = nextAlive(room, playerIdx, 1);
      }
    } else {
      room.currentTurn = nextAlive(room, playerIdx, 1 + skipCount);
    }

    broadcastState(code);
  });

  // ── PICK UP PILE ──────────────────────────────────────────
  socket.on("pickUpPile", () => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room || room.phase !== "game") return;

    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx !== room.currentTurn) return;
    if (room.pile.length === 0) return;

    const player = room.players[playerIdx];
    player.hand = [...player.hand, ...room.pile];
    room.pile = [];
    room.mustPlayLower = false;
    addLog(room, `${player.name} picked up the pile.`);
    room.currentTurn = nextAlive(room, playerIdx, 1);
    broadcastState(code);
  });

  // ── NEW ROUND ─────────────────────────────────────────────
  socket.on("newRound", () => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room) return;
    if (socket.id !== room.hostId) return;

    // Winner of last round (position 1) starts
    const lastWinnerId = room.finishOrder[0];
    const starterIdx = room.players.findIndex(p => p.id === lastWinnerId);

    const deck = makeDeck();
    room.deck = deck;
    room.pile = [];
    room.mustPlayLower = false;
    room.phase = "setup";
    room.finishOrder = [];
    room.shitheadId = null;

    room.players.forEach(p => {
      const cards = deck.splice(0, 9);
      p.faceDown = cards.slice(0, 3);
      p.hand = cards.slice(3, 9);
      p.faceUp = [];
      p.finished = false;
      p.finishPosition = null;
      p.setupDone = false;
    });

    room.currentTurn = starterIdx >= 0 ? starterIdx : 0;
    addLog(room, `New round! ${room.players[room.currentTurn].name} will go first.`);
    broadcastState(code);
  });

  // ── DISCONNECT ────────────────────────────────────────────
  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (player) addLog(room, `${player.name} disconnected.`);

    // If lobby, remove them
    if (room.phase === "lobby") {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) {
        delete rooms[code];
        return;
      }
      // Transfer host if needed
      if (room.hostId === socket.id) {
        room.hostId = room.players[0].id;
      }
    }

    broadcastState(code);
  });
});

// ── HELPER: next alive player index ──────────────────────────
function nextAlive(room, fromIdx, steps) {
  const n = room.players.length;
  let idx = fromIdx;
  let skipped = 0;
  while (skipped < steps) {
    idx = (idx + 1) % n;
    if (!room.players[idx].finished) skipped++;
    // Safety: if all finished somehow, break
    if (skipped > n * 2) break;
  }
  return idx;
}

// ─── START ────────────────────────────────────────────────────
const PORT = 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));