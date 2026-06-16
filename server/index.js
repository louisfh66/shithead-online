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

const TURN_TIMEOUT = 20000;  // 20 seconds
const RECONNECT_TIMEOUT = 30000; // 30 seconds

// ─── UTILS ────────────────────────────────────────────────────
function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function makeDeck() {
  const suits = ["\u2660","\u2665","\u2666","\u2663"];
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
  if (mustPlayLower) return val <= 7;
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
const rooms = {};

function getRoom(code) { return rooms[code]; }

function broadcastState(code) {
  const room = getRoom(code);
  if (!room) return;

  const now = Date.now();
  const turnDeadline = room.turnDeadline || null;

  room.players.forEach(player => {
    const socket = io.sockets.sockets.get(player.id);
    if (!socket) return;

    const playersPublic = room.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      faceUp: p.faceUp,
      faceDown: p.faceDown.map(() => ({ hidden: true })),
      faceDownCount: p.faceDown.length,
      finished: p.finished,
      finishPosition: p.finishPosition,
      shitheadCount: p.shitheadCount || 0,
      isHost: p.id === room.hostId,
      disconnected: p.disconnected || false,
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
      turnDeadline,
      burning: room.burning || false,
      stats: room.stats || {},
      lastPlayedCards: room.lastPlayedCards || [],
      lastPlayedBy: room.lastPlayedBy || null,
    });
  });
}

function addLog(room, msg) {
  room.log = [msg, ...(room.log || [])].slice(0, 20);
}

// ─── TURN TIMER ───────────────────────────────────────────────
function clearTurnTimer(room) {
  if (room.turnTimer) {
    clearTimeout(room.turnTimer);
    room.turnTimer = null;
    room.turnDeadline = null;
  }
}

function startTurnTimer(code) {
  const room = getRoom(code);
  if (!room || room.phase !== "game") return;

  clearTurnTimer(room);

  room.turnDeadline = Date.now() + TURN_TIMEOUT;
  // Broadcast immediately so clients receive the deadline
  broadcastState(code);

  room.turnTimer = setTimeout(() => {
    const r = getRoom(code);
    if (!r || r.phase !== "game") return;

    const player = r.players[r.currentTurn];
    if (!player || player.finished) return;

    // Force pick up pile, or just advance turn if pile empty
    if (r.pile.length > 0) {
      player.hand = [...player.hand, ...r.pile];
      r.pile = [];
      r.mustPlayLower = false;
      addLog(r, player.name + " ran out of time — picks up the pile.");
    } else {
      addLog(r, player.name + " ran out of time — turn skipped.");
    }

    r.currentTurn = nextAlive(r, r.currentTurn, 1);
    broadcastState(code);
    startTurnTimer(code);
  }, TURN_TIMEOUT);
}

// ─── RECONNECT ────────────────────────────────────────────────
function handleDisconnectDuringGame(room, code, socketId) {
  const player = room.players.find(p => p.id === socketId);
  if (!player) return;

  player.disconnected = true;
  addLog(room, player.name + " disconnected. 30s to reconnect...");
  broadcastState(code);

  // If it was their turn, pause the turn timer
  const playerIdx = room.players.findIndex(p => p.id === socketId);
  if (playerIdx === room.currentTurn) {
    clearTurnTimer(room);
  }

  // Start reconnect countdown
  player.reconnectTimer = setTimeout(() => {
    const r = getRoom(code);
    if (!r) return;
    const p = r.players.find(pl => pl.id === socketId);
    if (!p || !p.disconnected) return;

    // Time's up — dump their cards to pile then pick up
    addLog(r, p.name + " failed to reconnect — cards added to pile.");

    // Add their cards to pile
    const allCards = [...p.hand, ...p.faceUp, ...p.faceDown];
    r.pile = [...r.pile, ...allCards];
    p.hand = [];
    p.faceUp = [];
    p.faceDown = [];
    p.finished = true;
    p.finishPosition = r.finishOrder.length + 1;
    r.finishOrder.push(p.id);

    // Check if game over
    const active = r.players.filter(pl => !pl.finished);
    if (active.length === 1) {
      const shithead = active[0];
      shithead.shitheadCount = (shithead.shitheadCount || 0) + 1;
      r.shitheadId = shithead.id;
      r.finishOrder.push(shithead.id);
      r.phase = "results";
      clearTurnTimer(r);
      addLog(r, shithead.name + " is the Shithead!");
      broadcastState(code);
      return;
    }

    // If it was their turn, advance
    if (r.currentTurn === playerIdx) {
      r.currentTurn = nextAlive(r, playerIdx, 1);
      startTurnTimer(code);
    }

    broadcastState(code);
  }, RECONNECT_TIMEOUT);
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
        hand: [], faceUp: [], faceDown: [],
        finished: false, finishPosition: null,
        shitheadCount: 0, setupDone: false,
        disconnected: false,
      }],
      deck: [], pile: [],
      mustPlayLower: false,
      currentTurn: 0,
      log: [],
      finishOrder: [],
      shitheadId: null,
      turnTimer: null,
      turnDeadline: null,
      stats: {}, // { [playerId]: { burns, pickups, cardsPlayed } }
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
    // If game in progress, check if reconnect by name
    if (room.phase !== 'lobby') {
      const disc = room.players.find(p => p.name === name && p.disconnected);
      if (disc) {
        if (disc.reconnectTimer) { clearTimeout(disc.reconnectTimer); disc.reconnectTimer = null; }
        const oldId = disc.id;
        disc.id = socket.id;
        disc.disconnected = false;
        if (room.hostId === oldId) room.hostId = socket.id;
        socket.join(code);
        socket.data.code = code;
        addLog(room, disc.name + ' reconnected.');
        const pIdx = room.players.findIndex(p => p.id === socket.id);
        if (pIdx === room.currentTurn) startTurnTimer(code);
        broadcastState(code);
        return;
      }
      socket.emit('error', 'Game already in progress.');
      return;
    }
    if (room.players.length >= 5) { socket.emit("error", "Room is full (max 5 players)."); return; }

    room.players.push({
      id: socket.id, name,
      hand: [], faceUp: [], faceDown: [],
      finished: false, finishPosition: null,
      shitheadCount: 0, setupDone: false,
      disconnected: false,
    });

    socket.join(code);
    socket.data.code = code;
    socket.emit("joinedParty", { code });
    broadcastState(code);
  });

  // ── RECONNECT ─────────────────────────────────────────────
  socket.on("reconnectPlayer", ({ code, name }) => {
    const room = getRoom(code);
    if (!room || room.phase === "lobby") return;

    const player = room.players.find(p => p.name === name && p.disconnected);
    if (!player) { socket.emit("error", "Could not reconnect."); return; }

    // Cancel reconnect timer
    if (player.reconnectTimer) {
      clearTimeout(player.reconnectTimer);
      player.reconnectTimer = null;
    }

    const oldId = player.id;
    player.id = socket.id;
    player.disconnected = false;

    // Update host if needed
    if (room.hostId === oldId) room.hostId = socket.id;

    socket.join(code);
    socket.data.code = code;
    addLog(room, player.name + " reconnected.");

    // Restart turn timer if it's their turn
    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx === room.currentTurn) {
      startTurnTimer(code);
    }

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
    room.stats = {};
    room.lastPlayedCards = [];
    room.lastPlayedBy = null;

    room.players.forEach(p => {
      const cards = deck.splice(0, 9);
      p.faceDown = cards.slice(0, 3);
      p.hand = cards.slice(3, 9);
      p.faceUp = [];
      p.finished = false;
      p.finishPosition = null;
      p.setupDone = false;
      p.disconnected = false;
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

    addLog(room, player.name + " is ready.");

    if (room.players.every(p => p.setupDone)) {
      room.phase = "game";
      room.currentTurn = 0;
      addLog(room, "Game begins! " + room.players[0].name + " goes first.");
      broadcastState(code);
      startTurnTimer(code);
      return;
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
    if (cards.some(c => c.rank !== cards[0].rank)) { socket.emit("error", "All played cards must be the same rank."); return; }

    if (source !== "faceDown") {
      if (!canPlay(cards[0], room.pile, room.mustPlayLower)) { socket.emit("error", "Cannot play that card."); return; }
    }

    clearTurnTimer(room);

    player[source] = player[source].filter(c => !cardIds.includes(c.id));
    room.pile = [...room.pile, ...cards];

    while (player.hand.length < 3 && room.deck.length > 0) {
      player.hand.push(room.deck.shift());
    }

    const rank = cards[0].rank;
    let extraTurn = false;
    let skipCount = 0;

    // Face-down illegal check
    if (source === "faceDown") {
      const pileBeforePlay = room.pile.slice(0, room.pile.length - cards.length);
      const legal = pileBeforePlay.length === 0 || canPlay(cards[0], pileBeforePlay, room.mustPlayLower);
      if (!legal) {
        player.hand = [...player.hand, ...room.pile];
        room.pile = [];
        room.mustPlayLower = false;
        addLog(room, player.name + " flipped " + cards[0].rank + " blind — illegal! Picks up the pile.");
        room.currentTurn = nextAlive(room, playerIdx, 1);
        broadcastState(code);
        startTurnTimer(code);
        return;
      }
    }

    // Special cards
    const isBurn = rank === "10" || checkBurn(room.pile);
    if (isBurn) {
      extraTurn = true;
      room.mustPlayLower = false;
      room.burning = true;
      if (!room.stats[player.id]) room.stats[player.id] = {burns:0,pickups:0,cardsPlayed:0};
      room.stats[player.id].burns++;
      if (rank === "10") {
        room.stats[player.id].cardsPlayed = (room.stats[player.id].cardsPlayed||0) + cards.length;
        addLog(room, player.name + " played 10 — pile burns! Plays again.");
      } else {
        addLog(room, "Four of a kind — auto burn! " + player.name + " plays again.");
      }
      // Check win before delay
      if (hasNoCards(player) && !player.finished) {
        player.finished = true;
        player.finishPosition = room.finishOrder.length + 1;
        room.finishOrder.push(player.id);
        addLog(room, player.name + " is out!");
      }
      const activeNow = room.players.filter(p => !p.finished);
      if (activeNow.length === 1) {
        const sh = activeNow[0];
        sh.shitheadCount = (sh.shitheadCount||0) + 1;
        room.shitheadId = sh.id;
        room.finishOrder.push(sh.id);
        room.phase = "results";
        clearTurnTimer(room);
        addLog(room, sh.name + " is the Shithead!");
        broadcastState(code);
        setTimeout(() => { const r=getRoom(code); if(r){r.pile=[];r.burning=false;broadcastState(code);} }, 1500);
        return;
      }
      const nextTurnIdx = player.finished ? nextAlive(room, playerIdx, 1) : playerIdx;
      broadcastState(code);
      setTimeout(() => {
        const r = getRoom(code);
        if (!r) return;
        r.pile = [];
        r.burning = false;
        r.currentTurn = nextTurnIdx;
        broadcastState(code);
        startTurnTimer(code);
      }, 1500);
      return;
    } else if (rank === "8") {
      skipCount = cards.length;
      room.mustPlayLower = false;
      addLog(room, player.name + " played " + cards.length + "x 8 — skips " + (cards.length > 1 ? cards.length + " players" : "next player") + ".");
    } else if (rank === "7") {
      room.mustPlayLower = true;
      addLog(room, player.name + " played 7 — next must go lower.");
    } else if (rank === "2") {
      room.mustPlayLower = false;
      addLog(room, player.name + " played 2 — pile reset.");
    } else if (rank === "3") {
      const effTop = effectiveTopCard(room.pile);
      room.mustPlayLower = effTop?.rank === "7";
      addLog(room, player.name + " played 3 (invisible)" + (room.mustPlayLower ? " — still on a 7" : "") + ".");
    } else {
      room.mustPlayLower = false;
      addLog(room, player.name + " played " + cards.map(c => c.rank + c.suit).join(", ") + ".");
    }

    if (room.pile.length === 0) room.mustPlayLower = false;

    // Check win
    if (hasNoCards(player) && !player.finished) {
      player.finished = true;
      player.finishPosition = room.finishOrder.length + 1;
      room.finishOrder.push(player.id);
      addLog(room, player.name + " is out!");
    }

    // Check game over
    const active = room.players.filter(p => !p.finished);
    if (active.length === 1) {
      const shithead = active[0];
      shithead.shitheadCount = (shithead.shitheadCount || 0) + 1;
      room.shitheadId = shithead.id;
      room.finishOrder.push(shithead.id);
      room.phase = "results";
      clearTurnTimer(room);
      addLog(room, shithead.name + " is the Shithead!");
      broadcastState(code);
      return;
    }

    room.currentTurn = extraTurn
      ? (player.finished ? nextAlive(room, playerIdx, 1) : playerIdx)
      : nextAlive(room, playerIdx, 1 + skipCount);

    broadcastState(code);
    startTurnTimer(code);
  });

  // ── PICK UP PILE ──────────────────────────────────────────
  socket.on("pickUpPile", () => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room || room.phase !== "game") return;

    const playerIdx = room.players.findIndex(p => p.id === socket.id);
    if (playerIdx !== room.currentTurn) return;
    if (room.pile.length === 0) return;

    clearTurnTimer(room);

    const player = room.players[playerIdx];
    player.hand = [...player.hand, ...room.pile];
    room.pile = [];
    room.mustPlayLower = false;
    addLog(room, player.name + " picked up the pile.");
    if (!room.stats[player.id]) room.stats[player.id] = {burns:0,pickups:0,cardsPlayed:0};
    room.stats[player.id].pickups++;
    room.currentTurn = nextAlive(room, playerIdx, 1);
    broadcastState(code);
    startTurnTimer(code);
  });

  // ── NEW ROUND ─────────────────────────────────────────────
  socket.on("newRound", () => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room) return;
    if (socket.id !== room.hostId) return;

    clearTurnTimer(room);

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
      p.disconnected = false;
      if (p.reconnectTimer) { clearTimeout(p.reconnectTimer); p.reconnectTimer = null; }
    });

    room.currentTurn = starterIdx >= 0 ? starterIdx : 0;
    addLog(room, "New round! " + room.players[room.currentTurn].name + " goes first.");
    broadcastState(code);
  });


  // ── CHAT ──────────────────────────────────────────────────
  socket.on('chatMessage', ({ message }) => {
    const code = socket.data.code;
    const room = getRoom(code);
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;
    const msg = { name: player.name, message: message.slice(0, 200), id: socket.id, ts: Date.now() };
    if (!room.chat) room.chat = [];
    room.chat = [...room.chat, msg].slice(-50);
    io.to(code).emit('chatMessage', msg);
  });

  // ── DISCONNECT ────────────────────────────────────────────
  socket.on("disconnect", () => {
    const code = socket.data.code;
    if (!code) return;
    const room = getRoom(code);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);

    if (room.phase === "lobby") {
      room.players = room.players.filter(p => p.id !== socket.id);
      if (room.players.length === 0) { delete rooms[code]; return; }
      if (room.hostId === socket.id) room.hostId = room.players[0].id;
      if (player) addLog(room, player.name + " left the lobby.");
      broadcastState(code);
      return;
    }

    // In game — start reconnect window
    if (player) handleDisconnectDuringGame(room, code, socket.id);
  });
});

// ── HELPER ────────────────────────────────────────────────────
function nextAlive(room, fromIdx, steps) {
  const n = room.players.length;
  let idx = fromIdx;
  let skipped = 0;
  while (skipped < steps) {
    idx = (idx + 1) % n;
    if (!room.players[idx].finished) skipped++;
    if (skipped > n * 2) break;
  }
  return idx;
}

// ─── START ────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log("Server running on port " + PORT));