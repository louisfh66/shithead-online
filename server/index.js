const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { nanoid } = require("nanoid");

const app = express();
app.use(cors());
app.get("/health", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const allowedOrigins = (process.env.CLIENT_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const io = new Server(server, {
  cors: {
    origin: (origin, cb) => {
      // allow server-to-server / health checks
      if (!origin) return cb(null, true);

      // if you haven't set CLIENT_ORIGINS, allow all (safe for dev)
      if (allowedOrigins.length === 0) return cb(null, true);

      // allow listed origins
      if (allowedOrigins.includes(origin)) return cb(null, true);

      return cb(new Error(`CORS blocked origin: ${origin}`));
    },
    methods: ["GET", "POST"],
  },
});


/**
Room:
{
  code: string,
  hostSocketId: string|null,
  players: [{id: string, name: string}],
  phase: "lobby"|"setup"|"playing"|"ended",
  game: null | GameState
}

GameState:
{
  deck: Card[],
  pile: Card[],
  burned: Card[],
  currentPlayerId: string,
  playersState: Record<socketId, PlayerState>,

  finished: string[],
  winnerId: string|null,
  loserId: string|null
}

PlayerState:
{
  id: string,
  name: string,
  hand: Card[],
  faceUp: Card[],
  faceDown: Card[],
  stage: "chooseFaceUp"|"ready"|"playing"
}

Card: { r: string, s: string, id: string }
*/

const rooms = new Map();

/* ------------------ basic helpers ------------------ */

function makeRoomCode() {
  return nanoid(4).toUpperCase();
}

function publicRoomState(room) {
  return {
    code: room.code,
    hostSocketId: room.hostSocketId,
    phase: room.phase,
    players: room.players.map((p) => ({ id: p.id, name: p.name })),
  };
}

/* ------------------ cards ------------------ */

function makeDeck() {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];

  for (const s of suits) {
    for (const r of ranks) {
      deck.push({ r, s, id: `${r}${s}-${nanoid(6)}` });
    }
  }

  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

function rankValue(r) {
  if (r === "A") return 14;
  if (r === "K") return 13;
  if (r === "Q") return 12;
  if (r === "J") return 11;
  return Number(r);
}

function isMagic(r) {
  return r === "2" || r === "3" || r === "10";
}

function pileEffectiveTopRank(pile) {
  // 3 is invisible => last non-3 is the effective top
  for (let i = pile.length - 1; i >= 0; i--) {
    if (pile[i].r !== "3") return pile[i].r;
  }
  return null;
}

function canPlayOnPile(cardRank, pile) {
  // Magic anytime
  if (isMagic(cardRank)) return true;

  const top = pileEffectiveTopRank(pile);
  if (!top) return true; // empty pile

  // Same rank always allowed
  if (cardRank === top) return true;

  // If effective top is 7 => must play LOWER than 7 (or magic)
  if (top === "7") {
    return rankValue(cardRank) < 7;
  }

  // Otherwise must be >= top
  return rankValue(cardRank) >= rankValue(top);
}

function lastFourNon3Same(pile) {
  // burn if last 4 non-3 ranks are identical (ignore 3s between)
  const non3 = [];
  for (let i = pile.length - 1; i >= 0 && non3.length < 4; i--) {
    if (pile[i].r !== "3") non3.push(pile[i].r);
  }
  if (non3.length < 4) return false;
  return non3.every((r) => r === non3[0]);
}

/* ------------------ turn / zones ------------------ */

function playerZoneToUse(room, pid) {
  // Rule:
  // While deck has cards: play from HAND (and draw back up to 3).
  // After deck empty: play HAND until empty; then FACE-UP; then FACE-DOWN.
  const ps = room.game.playersState[pid];
  if (!ps) return "hand";

  const deckNotEmpty = room.game.deck.length > 0;

  if (deckNotEmpty) return "hand";
  if (ps.hand.length > 0) return "hand";
  if (ps.faceUp.length > 0) return "faceUp";
  return "faceDown";
}

function isPlayerOut(ps) {
  return ps.hand.length === 0 && ps.faceUp.length === 0 && ps.faceDown.length === 0;
}

function nextPlayerId(room, fromId, steps = 1) {
  const g = room.game;
  const ids = room.players.map((p) => p.id);
  if (ids.length === 0) return null;

  const finished = new Set(g?.finished ?? []);
  const active = ids.filter((id) => !finished.has(id));
  if (active.length === 0) return null;

  let idx = active.indexOf(fromId);
  if (idx === -1) idx = 0;

  for (let i = 0; i < steps; i++) {
    idx = (idx + 1) % active.length;
  }
  return active[idx];
}

function ensureFinishAndMaybeEnd(room) {
  const g = room.game;
  if (!g) return;

  if (!g.finished) g.finished = [];

  // add any newly finished players (keep order)
  for (const p of room.players) {
    const ps = g.playersState[p.id];
    if (!ps) continue;
    if (isPlayerOut(ps) && !g.finished.includes(p.id)) {
      g.finished.push(p.id);
    }
  }

  const allIds = room.players.map((p) => p.id);
  const finishedSet = new Set(g.finished);
  const active = allIds.filter((id) => !finishedSet.has(id));

  if (active.length === 1 && allIds.length >= 2) {
    // Game over:
    // winner = first finished, loser = last remaining active
    room.phase = "ended";
    g.winnerId = g.finished[0] ?? null;
    g.loserId = active[0] ?? null;

    // keep UI stable
    if (finishedSet.has(g.currentPlayerId)) g.currentPlayerId = g.loserId;
  } else {
    // if current player is finished, bump to next active
    if (finishedSet.has(g.currentPlayerId)) {
      g.currentPlayerId = nextPlayerId(room, g.currentPlayerId, 1);
    }
  }
}

function drawUpToThree(room, pid) {
  const ps = room.game.playersState[pid];
  if (!ps) return;
  if (room.game.deck.length <= 0) return;

  while (ps.hand.length < 3 && room.game.deck.length > 0) {
    ps.hand.push(room.game.deck.shift());
  }
}

function removeCardsByIds(arr, ids) {
  const idSet = new Set(ids);
  const removed = [];
  const kept = [];
  for (const c of arr) {
    if (idSet.has(c.id)) removed.push(c);
    else kept.push(c);
  }
  return { removed, kept };
}

/* ------------------ state emission ------------------ */

function gamePublicState(room) {
  const g = room.game;
  if (!g) return null;

  const playersPublic = room.players.map((p) => {
    const ps = g.playersState[p.id];
    return {
      id: p.id,
      name: p.name,
      handCount: ps ? ps.hand.length : 0,
      faceDownCount: ps ? ps.faceDown.length : 0,
      faceUp: ps ? ps.faceUp : [], // visible to all
    };
  });

  return {
    phase: room.phase,
    currentPlayerId: g.currentPlayerId,
    deckCount: g.deck.length,
    pile: g.pile,
    pileCount: g.pile.length,
    players: playersPublic,
    effectiveTop: pileEffectiveTopRank(g.pile),

    // endgame info
    winnerId: g.winnerId ?? null,
    loserId: g.loserId ?? null,
    finished: g.finished ?? [],
  };
}

function emitState(room) {
  const pubRoom = publicRoomState(room);
  io.to(room.code).emit("room:update", pubRoom);

  if (!room.game) return;

  const gamePub = gamePublicState(room);
  io.to(room.code).emit("game:state", { room: pubRoom, game: gamePub });

  // per-player private state
  for (const pid of Object.keys(room.game.playersState)) {
    const you = room.game.playersState[pid];
    io.to(pid).emit("game:private", { room: pubRoom, you, gamePublic: gamePub });
  }
}

/* ------------------ sockets ------------------ */

io.on("connection", (socket) => {
  // Create party
  socket.on("room:create", ({ name }, cb) => {
    const safeName = String(name || "").trim().slice(0, 20);
    if (!safeName) return cb?.({ ok: false, error: "Name required" });

    let code = makeRoomCode();
    while (rooms.has(code)) code = makeRoomCode();

    const room = {
      code,
      hostSocketId: socket.id,
      players: [{ id: socket.id, name: safeName }],
      phase: "lobby",
      game: null,
    };

    rooms.set(code, room);
    socket.join(code);

    cb?.({ ok: true, room: publicRoomState(room), yourId: socket.id });
    emitState(room);
  });

  // Join party
  socket.on("room:join", ({ code, name }, cb) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const safeName = String(name || "").trim().slice(0, 20);

    const room = rooms.get(roomCode);
    if (!room) return cb?.({ ok: false, error: "Room not found" });
    if (!safeName) return cb?.({ ok: false, error: "Name required" });

    if (!room.players.some((p) => p.id === socket.id)) {
      room.players.push({ id: socket.id, name: safeName });
    }

    socket.join(roomCode);

    cb?.({ ok: true, room: publicRoomState(room), yourId: socket.id });
    emitState(room);
  });

  // Host starts game
  socket.on("game:start", ({ code }, cb) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) return cb?.({ ok: false, error: "Room not found" });

    if (room.hostSocketId !== socket.id)
      return cb?.({ ok: false, error: "Only host can start" });

    if (room.players.length < 2)
      return cb?.({ ok: false, error: "Need at least 2 players" });

    if (room.phase !== "lobby")
      return cb?.({ ok: false, error: "Game already started" });

    const deck = makeDeck();
    const playersState = {};

    for (const p of room.players) {
      const faceDown = deck.splice(0, 3);
      const hand = deck.splice(0, 6);

      playersState[p.id] = {
        id: p.id,
        name: p.name,
        faceDown,
        faceUp: [],
        hand,
        stage: "chooseFaceUp",
      };
    }

    room.phase = "setup";
    room.game = {
      deck,
      pile: [],
      burned: [],
      currentPlayerId: room.players[0].id,
      playersState,

      finished: [],
      winnerId: null,
      loserId: null,
    };

    cb?.({ ok: true });
    emitState(room);
  });

  // Players choose 3 face-up cards
  socket.on("setup:setFaceUp", ({ code, chosenCardIds }, cb) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });

    const you = room.game.playersState[socket.id];
    if (!you) return cb?.({ ok: false, error: "You are not in this game" });
    if (you.stage !== "chooseFaceUp")
      return cb?.({ ok: false, error: "Already locked in" });

    const ids = Array.isArray(chosenCardIds) ? chosenCardIds : [];
    if (ids.length !== 3) return cb?.({ ok: false, error: "Pick exactly 3 cards" });

    const inHand = new Set(you.hand.map((c) => c.id));
    for (const id of ids) {
      if (!inHand.has(id)) return cb?.({ ok: false, error: "Invalid selection" });
    }

    const chosen = [];
    const remaining = [];
    for (const c of you.hand) {
      if (ids.includes(c.id)) chosen.push(c);
      else remaining.push(c);
    }

    you.faceUp = chosen;
    you.hand = remaining; // leaves 3
    you.stage = "ready";

    const allReady = Object.values(room.game.playersState).every((p) => p.stage === "ready");
    if (allReady) {
      room.phase = "playing";
      for (const p of Object.values(room.game.playersState)) p.stage = "playing";
    }

    cb?.({ ok: true });
    emitState(room);
  });

  /* ------------------ gameplay ------------------ */

  socket.on("play:cards", ({ code, cardIds, source, faceDownIndex }, cb) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });
    if (room.phase !== "playing") return cb?.({ ok: false, error: "Not in playing phase" });

    const g = room.game;
    if (g.currentPlayerId !== socket.id) return cb?.({ ok: false, error: "Not your turn" });

    const ps = g.playersState[socket.id];
    if (!ps) return cb?.({ ok: false, error: "You are not in this game" });

    const mustZone = playerZoneToUse(room, socket.id);
    if (source !== mustZone) {
      return cb?.({ ok: false, error: `You must play from ${mustZone}` });
    }

    let played = [];

    // ---- Select cards from correct source ----
    if (source === "faceDown") {
      const idx = Number(faceDownIndex);
      if (!Number.isInteger(idx)) return cb?.({ ok: false, error: "Pick a face-down card" });
      if (!ps.faceDown[idx]) return cb?.({ ok: false, error: "No card there" });

      const c = ps.faceDown[idx];
      ps.faceDown.splice(idx, 1);
      played = [c];
    } else {
      const ids = Array.isArray(cardIds) ? cardIds : [];
      if (ids.length < 1) return cb?.({ ok: false, error: "Select a card" });

      const zoneArr = source === "hand" ? ps.hand : ps.faceUp;

      // ensure all selected are in that zone
      const zoneIds = new Set(zoneArr.map((c) => c.id));
      for (const id of ids) {
        if (!zoneIds.has(id)) return cb?.({ ok: false, error: "Invalid selection" });
      }

      // enforce same-rank multi-play
      const ranks = ids.map((id) => zoneArr.find((c) => c.id === id).r);
      const firstRank = ranks[0];
      if (!ranks.every((r) => r === firstRank)) {
        return cb?.({ ok: false, error: "You can only play multiple cards of the same rank" });
      }

      const out = removeCardsByIds(zoneArr, ids);
      played = out.removed;
      if (source === "hand") ps.hand = out.kept;
      else ps.faceUp = out.kept;
    }

    const playRank = played[0].r;

    // ---- Validate play vs pile ----
    if (!canPlayOnPile(playRank, g.pile)) {
      // illegal => pickup pile and include played card(s) into hand
      ps.hand.push(...played, ...g.pile);
      g.pile = [];

      // end turn
      g.currentPlayerId = nextPlayerId(room, socket.id, 1);

      ensureFinishAndMaybeEnd(room);
      cb?.({ ok: true, forcedPickup: true });
      emitState(room);
      return;
    }

    // ---- Apply play ----
    g.pile.push(...played);

    // ---- Burn checks ----
    const num8 = played.filter((c) => c.r === "8").length;
    const isTenBurn = playRank === "10";
    const isFourBurn = lastFourNon3Same(g.pile);

    if (isTenBurn || isFourBurn) {
      g.burned.push(...g.pile);
      g.pile = [];

      // draw after burn (if playing from hand and deck has cards)
      if (source === "hand") drawUpToThree(room, socket.id);

      // burn => play again (do not advance)
      ensureFinishAndMaybeEnd(room);
      cb?.({ ok: true, burned: true });
      emitState(room);
      return;
    }

    // draw up to 3 if from hand
    if (source === "hand") drawUpToThree(room, socket.id);

    // advance with 8 skip rule: steps = 1 + number of 8s played
    const steps = 1 + num8;
    g.currentPlayerId = nextPlayerId(room, socket.id, steps);

    ensureFinishAndMaybeEnd(room);
    cb?.({ ok: true });
    emitState(room);
  });

  socket.on("play:pickup", ({ code }, cb) => {
    const roomCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(roomCode);
    if (!room?.game) return cb?.({ ok: false, error: "Game not started" });
    if (room.phase !== "playing") return cb?.({ ok: false, error: "Not in playing phase" });

    const g = room.game;
    if (g.currentPlayerId !== socket.id) return cb?.({ ok: false, error: "Not your turn" });

    const ps = g.playersState[socket.id];
    if (!ps) return cb?.({ ok: false, error: "You are not in this game" });

    // pick up pile into hand
    ps.hand.push(...g.pile);
    g.pile = [];

    // advance
    g.currentPlayerId = nextPlayerId(room, socket.id, 1);

    ensureFinishAndMaybeEnd(room);
    cb?.({ ok: true });
    emitState(room);
  });

  /* ------------------ disconnect ------------------ */

  socket.on("disconnect", () => {
    for (const [code, room] of rooms.entries()) {
      const before = room.players.length;
      room.players = room.players.filter((p) => p.id !== socket.id);

      if (room.players.length !== before) {
        if (room.hostSocketId === socket.id) {
          room.hostSocketId = room.players[0]?.id || null;
        }

        if (room.game?.playersState?.[socket.id]) {
          delete room.game.playersState[socket.id];
        }

        if (room.players.length === 0) {
          rooms.delete(code);
        } else {
          emitState(room);
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
