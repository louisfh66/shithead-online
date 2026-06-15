import socket from "../socket";

export default function Lobby({ gameState }) {
  if (!gameState) return null;
  const { players, myId, hostId, code } = gameState;
  const isHost = myId === hostId;
  const canStart = players.length >= 2;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 80% 60% at 50% 40%, #0F4A35 0%, #090C0B 70%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 28, fontWeight: 900, color: "#C9A84C", marginBottom: 4, letterSpacing: 2 }}>
        LOBBY
      </div>
      <div style={{ fontSize: 13, color: "#7A9E8E", marginBottom: 32 }}>
        Share this code with your friends
      </div>

      {/* Game code */}
      <div style={{
        background: "rgba(201,168,76,0.08)",
        border: "1px solid rgba(201,168,76,0.3)",
        borderRadius: 12, padding: "20px 48px",
        marginBottom: 32, textAlign: "center",
      }}>
        <div style={{ fontSize: 11, color: "#7A9E8E", letterSpacing: 4, textTransform: "uppercase", marginBottom: 8 }}>Game Code</div>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 48, fontWeight: 900, color: "#C9A84C", letterSpacing: 12 }}>
          {code}
        </div>
      </div>

      {/* Players list */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: 24,
        marginBottom: 24,
      }}>
        <div style={{ fontSize: 12, color: "#7A9E8E", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>
          Players ({players.length}/5)
        </div>
        {players.map((p, i) => (
          <div key={p.id} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 0",
            borderBottom: i < players.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: p.id === myId ? "rgba(201,168,76,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${p.id === myId ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: p.id === myId ? "#C9A84C" : "#7A9E8E",
              }}>
                {p.name[0].toUpperCase()}
              </div>
              <span style={{ color: p.id === myId ? "#F5F0E8" : "#7A9E8E", fontWeight: p.id === myId ? 600 : 400 }}>
                {p.name} {p.id === myId ? "(you)" : ""}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#3a5a4a" }}>
              {p.id === hostId ? "HOST" : ""}
            </div>
          </div>
        ))}
        {players.length < 2 && (
          <div style={{ fontSize: 13, color: "#3a5a4a", textAlign: "center", marginTop: 12 }}>
            Waiting for at least 1 more player…
          </div>
        )}
      </div>

      {/* Start button (host only) */}
      {isHost && (
        <button
          onClick={() => socket.emit("startGame")}
          disabled={!canStart}
          style={{
            width: "100%", maxWidth: 380,
            padding: "16px",
            background: canStart ? "#C9A84C" : "rgba(255,255,255,0.04)",
            color: canStart ? "#090C0B" : "#3a5a4a",
            border: canStart ? "none" : "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, fontSize: 15, fontWeight: 700,
            fontFamily: "Georgia, serif", letterSpacing: 2,
            cursor: canStart ? "pointer" : "default",
          }}
        >
          START GAME
        </button>
      )}
      {!isHost && (
        <div style={{ fontSize: 13, color: "#3a5a4a" }}>Waiting for host to start…</div>
      )}
    </div>
  );
}
