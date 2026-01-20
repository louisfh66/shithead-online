import { useEffect, useMemo, useState } from "react";
import { socket } from "./socket";

type Player = { id: string; name: string };

type RoomPublic = {
  code: string;
  hostSocketId: string | null;
  phase: "lobby" | "setup" | "playing" | "ended";
  players: Player[];
};

type Card = { r: string; s: string; id: string };

type YouState = {
  id: string;
  name: string;
  faceDown: Card[];
  faceUp: Card[];
  hand: Card[];
  stage: "chooseFaceUp" | "ready" | "playing";
};

type GamePublic = {
  phase: "lobby" | "setup" | "playing" | "ended";
  currentPlayerId: string;
  deckCount: number;
  pile: Card[];
  pileCount: number;
  effectiveTop: string | null;
  players: Array<{
    id: string;
    name: string;
    handCount: number;
    faceDownCount: number;
    faceUp: Card[];
  }>;
  winnerId: string | null;
  loserId: string | null;
  finished: string[];
};

function suitColor(s: string) {
  return s === "♥" || s === "♦" ? "#c1121f" : "#111827";
}

function CardFace({
  card,
  selected,
  onClick,
}: {
  card: Card;
  selected?: boolean;
  onClick?: () => void;
}) {
  const col = suitColor(card.s);

  return (
    <button
      onClick={onClick}
      style={{
        ...styles.realCard,
        transform: selected ? "translateY(-6px)" : "none",
        boxShadow: selected
          ? "0 10px 18px rgba(0,0,0,0.35)"
          : "0 6px 14px rgba(0,0,0,0.22)",
        outline: selected ? "2px solid rgba(43,99,255,0.9)" : "none",
        cursor: onClick ? "pointer" : "default",
      }}
      title={`${card.r}${card.s}`}
      type="button"
    >
      <div style={{ ...styles.corner, color: col }}>
        <div style={{ fontWeight: 900 }}>{card.r}</div>
        <div style={{ fontWeight: 900, marginTop: -2 }}>{card.s}</div>
      </div>

      <div style={{ ...styles.corner, ...styles.cornerBR, color: col }}>
        <div style={{ fontWeight: 900 }}>{card.r}</div>
        <div style={{ fontWeight: 900, marginTop: -2 }}>{card.s}</div>
      </div>

      <div style={{ fontSize: 28, fontWeight: 900, color: col }}>{card.s}</div>
    </button>
  );
}

function CardBack({ label, onClick }: { label?: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...styles.realCardBack,
        cursor: onClick ? "pointer" : "default",
        outline: "none",
        border: "1px solid rgba(255,255,255,0.12)",
      }}
      title="Face-down"
    >
      <div style={styles.cardBackInner} />
      <div style={styles.cardBackText}>{label ?? "?"}</div>
    </button>
  );
}

export default function App() {
  const [status, setStatus] = useState<"disconnected" | "connected">(
    "disconnected"
  );

  const [name, setName] = useState("");
  const [code, setCode] = useState("");

  const [yourId, setYourId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [you, setYou] = useState<YouState | null>(null);
  const [gamePublic, setGamePublic] = useState<GamePublic | null>(null);

  // selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedSource, setSelectedSource] = useState<
    "hand" | "faceUp" | "faceDown"
  >("hand");
  const [selectedFaceDownIndex, setSelectedFaceDownIndex] = useState<
    number | null
  >(null);

  // setup selection
  const [picked, setPicked] = useState<string[]>([]);

  const isHost = useMemo(() => {
    return !!room && !!yourId && room.hostSocketId === yourId;
  }, [room, yourId]);

  const yourNameInRoom = useMemo(() => {
    if (!room || !yourId) return "?";
    return room.players.find((p) => p.id === yourId)?.name || "?";
  }, [room, yourId]);

  const isYourTurn = useMemo(() => {
    return !!gamePublic && !!yourId && gamePublic.currentPlayerId === yourId;
  }, [gamePublic, yourId]);

  useEffect(() => {
    const onConnect = () => setStatus("connected");
    const onDisconnect = () => setStatus("disconnected");
    const onRoomUpdate = (nextRoom: RoomPublic) => setRoom(nextRoom);

    const onPrivate = (payload: any) => {
      if (payload?.room) setRoom(payload.room);
      if (payload?.you) setYou(payload.you);
      if (payload?.gamePublic) setGamePublic(payload.gamePublic);
    };

    const onGameState = (payload: any) => {
      if (payload?.room) setRoom(payload.room);
      if (payload?.game) setGamePublic(payload.game);
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:update", onRoomUpdate);
    socket.on("game:private", onPrivate);
    socket.on("game:state", onGameState);

    if (socket.connected) setStatus("connected");

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:update", onRoomUpdate);
      socket.off("game:private", onPrivate);
      socket.off("game:state", onGameState);
    };
  }, []);

  function resetSelection() {
    setSelectedIds([]);
    setSelectedFaceDownIndex(null);
  }

  function createParty() {
    setError(null);
    socket.emit("room:create", { name }, (res: any) => {
      if (!res?.ok) return setError(res?.error || "Failed to create party");
      setYourId(res.yourId);
      setRoom(res.room);
      setYou(null);
      setGamePublic(null);
      setPicked([]);
      resetSelection();
    });
  }

  function joinParty() {
    setError(null);
    socket.emit("room:join", { code, name }, (res: any) => {
      if (!res?.ok) return setError(res?.error || "Failed to join party");
      setYourId(res.yourId);
      setRoom(res.room);
      setYou(null);
      setGamePublic(null);
      setPicked([]);
      resetSelection();
    });
  }

  function leave() {
    setRoom(null);
    setYourId(null);
    setError(null);
    setCode("");
    setYou(null);
    setGamePublic(null);
    setPicked([]);
    resetSelection();
  }

  function startGame() {
    if (!room) return;
    socket.emit("game:start", { code: room.code }, (res: any) => {
      if (!res?.ok) alert(res?.error || "Failed to start game");
    });
  }

  function togglePick(cardId: string) {
    setPicked((prev) => {
      if (prev.includes(cardId)) return prev.filter((x) => x !== cardId);
      if (prev.length >= 3) return prev;
      return [...prev, cardId];
    });
  }

  function lockInFaceUp() {
    if (!room) return;
    socket.emit(
      "setup:setFaceUp",
      { code: room.code, chosenCardIds: picked },
      (res: any) => {
        if (!res?.ok) alert(res?.error || "Failed to lock in");
      }
    );
  }

  // For hand/faceUp multi-select: enforce same rank
  function toggleSelectFrom(source: "hand" | "faceUp", card: Card) {
    setSelectedSource(source);
    setSelectedFaceDownIndex(null);

    setSelectedIds((prev) => {
      if (prev.length === 0) return [card.id];
      if (prev.includes(card.id)) return prev.filter((x) => x !== card.id);

      const allCards = source === "hand" ? you?.hand ?? [] : you?.faceUp ?? [];
      const first = allCards.find((c) => c.id === prev[0]);
      if (!first) return [card.id];
      if (card.r !== first.r) return prev;
      return [...prev, card.id];
    });
  }

  function selectFaceDown(idx: number) {
    setSelectedSource("faceDown");
    setSelectedIds([]);
    setSelectedFaceDownIndex(idx);
  }

  function playSelected() {
    if (!room) return;
    if (!isYourTurn) return;

    const payload: any = { code: room.code, source: selectedSource };

    if (selectedSource === "faceDown") {
      payload.faceDownIndex = selectedFaceDownIndex;
    } else {
      payload.cardIds = selectedIds;
    }

    socket.emit("play:cards", payload, (res: any) => {
      if (!res?.ok) alert(res?.error || "Play failed");
      resetSelection();
    });
  }

  function pickupPile() {
    if (!room) return;
    if (!isYourTurn) return;
    socket.emit("play:pickup", { code: room.code }, (res: any) => {
      if (!res?.ok) alert(res?.error || "Pickup failed");
      resetSelection();
    });
  }

  const opponents = useMemo(() => {
    if (!gamePublic || !yourId) return [];
    return gamePublic.players.filter((p) => p.id !== yourId);
  }, [gamePublic, yourId]);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.headerRow}>
          <div>
            <div style={styles.title}>Shithead Online</div>
            <div style={styles.sub}>
              Status:{" "}
              <span style={{ fontWeight: 800 }}>
                {status === "connected" ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          {room && (
            <button style={styles.secondaryBtn} onClick={leave}>
              Leave
            </button>
          )}
        </div>

        {!room ? (
          <>
            <div style={styles.sectionTitle}>Your name</div>
            <input
              style={styles.input}
              placeholder="e.g. Louis"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
            />

            <div style={{ height: 12 }} />

            <div style={styles.row}>
              <button
                style={styles.primaryBtn}
                onClick={createParty}
                disabled={!name.trim() || status !== "connected"}
              >
                Create Party
              </button>

              <div style={{ width: 12 }} />

              <input
                style={{ ...styles.input, flex: 1 }}
                placeholder="Party code (e.g. K7Q4)"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
              />

              <div style={{ width: 12 }} />

              <button
                style={styles.primaryBtn}
                onClick={joinParty}
                disabled={!name.trim() || !code.trim() || status !== "connected"}
              >
                Join Party
              </button>
            </div>

            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.hint}>Tip: open two browser tabs to test locally.</div>
          </>
        ) : (
          <>
            {/* SETUP SCREEN */}
            {you?.stage === "chooseFaceUp" ? (
              <>
                <div style={styles.sectionTitle}>Setup</div>

                <div style={styles.infoRow}>
                  <div style={styles.pill}>
                    Party: <b>{room.code}</b>
                  </div>
                  <div style={styles.pill}>
                    You: <b>{yourNameInRoom}</b>
                  </div>
                  <div style={styles.pill}>
                    Pick 3 face-up: <b>{picked.length}/3</b>
                  </div>
                </div>

                <div style={styles.setupGrid}>
                  <div style={styles.panel}>
                    <div style={styles.panelTitle}>Your face-down (hidden)</div>
                    <div style={styles.cardsRow}>
                      <CardBack label="1" />
                      <CardBack label="2" />
                      <CardBack label="3" />
                    </div>
                    <div style={styles.panelHint}>
                      These are played last (after face-up). You won’t know what they are.
                    </div>
                  </div>

                  <div style={styles.panel}>
                    <div style={styles.panelTitle}>Pick 3 to be face-up</div>
                    <div style={styles.cardsRow}>
                      {you.hand.map((c) => (
                        <CardFace
                          key={c.id}
                          card={c}
                          selected={picked.includes(c.id)}
                          onClick={() => togglePick(c.id)}
                        />
                      ))}
                    </div>

                    <button
                      style={{ ...styles.primaryBtn, marginTop: 12, width: "100%" }}
                      disabled={picked.length !== 3}
                      onClick={lockInFaceUp}
                    >
                      Lock In Face-up Cards
                    </button>

                    <div style={styles.panelHint}>Once everyone locks in, the game begins.</div>
                  </div>
                </div>
              </>
            ) : room.phase === "lobby" ? (
              <>
                <div style={styles.sectionTitle}>Lobby</div>

                <div style={styles.lobbyTop}>
                  <div style={styles.pill}>
                    Party Code: <span style={{ fontWeight: 900 }}>{room.code}</span>
                  </div>
                  <div style={styles.pill}>
                    You: <span style={{ fontWeight: 900 }}>{yourNameInRoom}</span>{" "}
                    {isHost ? "(Host)" : ""}
                  </div>
                </div>

                <div style={styles.list}>
                  {room.players.map((p) => (
                    <div key={p.id} style={styles.playerRow}>
                      <div style={{ fontWeight: 800 }}>{p.name}</div>
                      <div style={styles.small}>
                        {p.id === room.hostSocketId ? "Host" : ""}
                      </div>
                    </div>
                  ))}
                </div>

                {isHost && (
                  <button
                    style={{ ...styles.primaryBtn, marginTop: 12, width: "100%" }}
                    onClick={startGame}
                  >
                    Start Game
                  </button>
                )}

                <div style={styles.hint}>Host starts → everyone chooses 3 face-up.</div>
              </>
            ) : (
              <>
                {/* PLAY TABLE */}
                {room.phase === "ended" && gamePublic ? (
                  <div style={styles.endBox}>
                    <div style={styles.endTitle}>
                      {yourId === gamePublic.winnerId
                        ? "🏆 You Win!"
                        : yourId === gamePublic.loserId
                        ? "💀 You Lose!"
                        : "✅ Game Over"}
                    </div>

                    <div style={styles.endText}>
                      <div>
                        <b>Winner:</b>{" "}
                        {gamePublic.players.find((p) => p.id === gamePublic.winnerId)?.name ??
                          "?"}
                      </div>
                      <div>
                        <b>Shithead:</b>{" "}
                        {gamePublic.players.find((p) => p.id === gamePublic.loserId)?.name ??
                          "?"}
                      </div>
                    </div>

                    <div style={styles.hint}>The game has ended. Leave to return to the lobby.</div>
                  </div>
                ) : (
                  <>
                    <div style={styles.sectionTitle}>Table</div>

                    <div style={styles.tableTop}>
                      <div style={styles.pill}>
                        Party: <b>{room.code}</b>
                      </div>
                      <div style={styles.pill}>
                        Turn:{" "}
                        <b>
                          {gamePublic?.players.find(
                            (p) => p.id === gamePublic?.currentPlayerId
                          )?.name ?? "?"}
                        </b>
                      </div>
                      <div style={styles.pill}>
                        Top: <b>{gamePublic?.effectiveTop ?? "—"}</b>
                      </div>
                      <div style={styles.pill}>
                        Deck: <b>{gamePublic?.deckCount ?? 0}</b>
                      </div>
                      <div style={styles.pill}>
                        Pile: <b>{gamePublic?.pileCount ?? 0}</b>
                      </div>
                    </div>

                    <div style={styles.tableFelt}>
  {/* Opponents */}
  <div style={styles.oppTopRow}>
    {opponents.map((p) => (
      <div key={p.id} style={styles.seatBox}>
        <div style={styles.seatName}>
          {p.name} {gamePublic?.currentPlayerId === p.id ? "• TURN" : ""}
        </div>

        {/* Face-down base + Face-up aligned 1:1 */}
        <div style={styles.stackWrap}>
          {/* face-down base */}
          <div style={styles.slotRow}>
            {Array.from({ length: p.faceDownCount }).map((_, i) => (
  <div key={i} style={styles.slot}>
    <CardBack />
  </div>
))}

          </div>

          {/* face-up overlay */}
          <div style={styles.stackUpLayer}>
            {Array.from({ length: p.faceDownCount }).map((_, i) => {
  const c = p.faceUp[i];
  if (!c) return null;

  return (
    <div key={c.id} style={{ ...styles.slot, position: "absolute", left: i * 96, top: -14 }}>
      <CardFace card={c} />
    </div>
  );
})}

          </div>
        </div>

        {/* Hand backs */}
        <div style={styles.handBackRow}>
          {Array.from({ length: Math.min(6, p.handCount) }).map((_, i) => (
            <div key={i} style={{ transform: `rotate(${(i - 2.5) * 4}deg)` }}>
              <CardBack />
            </div>
          ))}
          {p.handCount > 6 && (
            <div style={{ marginLeft: 6, fontWeight: 900, opacity: 0.85 }}>
              +{p.handCount - 6}
            </div>
          )}
        </div>
      </div>
    ))}
  </div>

  {/* Centre pile */}
  <div style={styles.centerPileFloating}>
    <div style={{ fontWeight: 1000, marginBottom: 8 }}>Pile</div>
    <div style={styles.pileRow}>
      {gamePublic?.pile?.slice(-8).map((c, idx) => (
        <div key={c.id} style={{ transform: `rotate(${(idx - 3) * 2}deg)` }}>
          <CardFace card={c} />
        </div>
      ))}
      {!gamePublic?.pile?.length && <div style={styles.small}>Empty</div>}
    </div>
  </div>

  {/* You */}
  <div style={styles.youSeat}>
    <div style={styles.youHeader}>
      <div style={{ fontWeight: 1000 }}>
        You ({yourNameInRoom}) {isYourTurn ? "• YOUR TURN" : ""}
      </div>
      <div style={{ opacity: 0.85, fontWeight: 800, fontSize: 12 }}>
        Deck empty: Hand → Face-up → Face-down
      </div>
    </div>

    <div style={styles.youLayout}>
      {/* Table stack */}
      <div>
        <div style={styles.small}>Your table cards</div>

        <div style={styles.stackWrap}>
          {/* face-down base */}
          <div style={styles.slotRow}>

            {Array.from({ length: you?.faceDown?.length ?? 0 }).map((_, i) => (
  <div key={i} style={styles.slot}>
    <CardBack
      label={`${i + 1}`}
      onClick={isYourTurn ? () => selectFaceDown(i) : undefined}
    />
  </div>
))}

          </div>

          {/* face-up overlay */}
          <div style={styles.stackUpLayer}>
            {Array.from({ length: you?.faceDown?.length ?? 0 }).map((_, i) => {
  const c = (you?.faceUp ?? [])[i];
  if (!c) return null;

  return (
    <div key={c.id} style={{ ...styles.slot, position: "absolute", left: i * 96, top: -14 }}>
      <CardFace
        card={c}
        selected={selectedSource === "faceUp" && selectedIds.includes(c.id)}
        onClick={isYourTurn ? () => toggleSelectFrom("faceUp", c) : undefined}
      />
    </div>
  );
})}

          </div>
        </div>
      </div>

      {/* Hand */}
      <div style={{ flex: 1 }}>
        <div style={styles.small}>Your hand</div>

        <div style={styles.yourHandBig}>
          {(you?.hand ?? []).map((c) => (
            <CardFace
              key={c.id}
              card={c}
              selected={selectedSource === "hand" && selectedIds.includes(c.id)}
              onClick={isYourTurn ? () => toggleSelectFrom("hand", c) : undefined}
            />
          ))}
          {!you?.hand?.length && <div style={styles.small}>Hand empty</div>}
        </div>

        <div style={styles.actionsRowSingle}>
          <button
            style={{ ...styles.primaryBtn, opacity: isYourTurn ? 1 : 0.5, width: "100%" }}
            disabled={!isYourTurn}
            onClick={playSelected}
          >
            Play Selected
          </button>

          <button
            style={{ ...styles.secondaryBtn, opacity: isYourTurn ? 1 : 0.5, width: "100%" }}
            disabled={!isYourTurn}
            onClick={pickupPile}
          >
            Pick Up Pile
          </button>
        </div>

        <div style={styles.hint}>
          Rules implemented: 2/3/10 magic; 7 = next must go lower; 8 = skip;
          burn on 10 or 4-of-a-kind ignoring 3s (burn = play again).
          <br />
          Enforcement: while deck exists you play from hand; after deck empty you play hand → face-up → face-down.
        </div>
      </div>
    </div>
  </div>
</div>

                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "#0b1020",
    color: "white",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
  },
  card: {
    width: "min(1100px, 96vw)",
    background: "#121a33",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 18,
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  },
  headerRow: { display: "flex", justifyContent: "space-between", gap: 12 },
  title: { fontSize: 28, fontWeight: 900, letterSpacing: 0.2 },
  sub: { opacity: 0.85, marginTop: 6 },

  sectionTitle: { marginTop: 16, marginBottom: 8, fontWeight: 900 },
  row: { display: "flex", alignItems: "center" },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    outline: "none",
  },

  primaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#2b63ff",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  secondaryBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  error: {
    marginTop: 12,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,80,80,0.15)",
    border: "1px solid rgba(255,80,80,0.35)",
    color: "#ffd7d7",
    fontWeight: 800,
  },

  hint: { marginTop: 14, opacity: 0.85, lineHeight: 1.35 },

  lobbyTop: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 },
  infoRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 },
  pill: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    fontWeight: 800,
  },

  list: { marginTop: 10, display: "grid", gap: 8 },
  playerRow: {
    padding: "10px 12px",
    borderRadius: 12,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  small: { opacity: 0.75, fontSize: 12 },

  setupGrid: {
    marginTop: 12,
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 12,
  },
  panel: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 16,
    padding: 12,
    marginTop: 12,
  },
  panelTitle: { fontWeight: 900, marginBottom: 8 },
  panelHint: { marginTop: 10, opacity: 0.85, lineHeight: 1.35 },

  cardsRow: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },

  tableTop: { display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 },

  // --- Real card styles ---
  realCard: {
    position: "relative",
    width: 84,
    height: 118,
    borderRadius: 14,
    border: "1px solid rgba(0,0,0,0.12)",
    background: "linear-gradient(180deg, #ffffff, #f3f4f6)",
    color: "#111827",
    userSelect: "none",
  },
  corner: {
    position: "absolute",
    top: 8,
    left: 8,
    fontSize: 14,
    lineHeight: 1,
    textAlign: "left",
  },
  cornerBR: {
    top: "auto",
    left: "auto",
    bottom: 8,
    right: 8,
    transform: "rotate(180deg)",
    textAlign: "left",
  },

  realCardBack: {
    position: "relative",
    width: 84,
    height: 118,
    borderRadius: 14,
    background: "linear-gradient(180deg, #1d4ed8, #1e40af)",
    boxShadow: "0 6px 14px rgba(0,0,0,0.22)",
    overflow: "hidden",
  },
  cardBackInner: {
    position: "absolute",
    inset: 10,
    borderRadius: 10,
    border: "2px solid rgba(255,255,255,0.35)",
    background:
      "repeating-linear-gradient(45deg, rgba(255,255,255,0.14), rgba(255,255,255,0.14) 6px, rgba(255,255,255,0.08) 6px, rgba(255,255,255,0.08) 12px)",
  },
  cardBackText: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
    fontWeight: 900,
    fontSize: 22,
    color: "rgba(255,255,255,0.85)",
    textShadow: "0 2px 10px rgba(0,0,0,0.35)",
  },

  // --- New seamless table layout styles ---
 tableFelt: {
  marginTop: 12,
  borderRadius: 22,
  border: "1px solid rgba(255,255,255,0.10)",
  background:
    "radial-gradient(1200px 600px at 50% 20%, rgba(34,197,94,0.20), rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(16,185,129,0.08), rgba(0,0,0,0))",
  padding: 14,
  display: "grid",
  gridTemplateRows: "auto auto auto",
  gap: 12,
},


  oppTopRow: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 12,
  alignItems: "start",
},


  seatBox: {
    background: "rgba(0,0,0,0.20)",
    border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 16,
    padding: 10,
  },

  seatName: {
    fontWeight: 1000,
    fontSize: 13,
    marginBottom: 10,
    opacity: 0.95,
  },

  stackWrap: {
  position: "relative",
  height: 160,
  paddingTop: 22,
  overflow: "visible",
},



  stackDownRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },

  stackUpLayer: {
    position: "absolute",
    left: 0,
    top: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "auto",
  },

  handBackRow: {
    marginTop: 10,
    display: "flex",
    gap: 6,
    alignItems: "center",
  },

  centerPileFloating: {
  background: "rgba(0,0,0,0.20)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 18,
  padding: 12,
},


  pileRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "center",
  },

  youSeat: {
  background: "rgba(0,0,0,0.24)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 20,
  padding: 12,
},


  youHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 10,
  },

  youLayout: {
    display: "flex",
    gap: 14,
    alignItems: "flex-end",
  },

  yourHandBig: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
    transform: "scale(1.12)",
    transformOrigin: "left bottom",
    paddingBottom: 6,
  },

  actionsRowSingle: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginTop: 12,
  },

  endBox: {
    marginTop: 16,
    padding: 16,
    borderRadius: 16,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  endTitle: {
    fontSize: 34,
    fontWeight: 1000,
  },
  endText: {
    marginTop: 12,
    fontSize: 18,
    lineHeight: 1.5,
    opacity: 0.95,
  },
  slotRow: {
  display: "flex",
  gap: 12,
  alignItems: "center",
  position: "relative",
  height: 150,
},
slot: {
  width: 84,
  height: 118,
},


};
