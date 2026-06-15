import socket from "../socket";

export default function Results({ gameState }) {
  if (!gameState) return null;
  const { players, finishOrder, shitheadId, myId, hostId } = gameState;
  const isHost = myId === hostId;
  const amShithead = myId === shitheadId;

  // Build ranked list
  const ranked = finishOrder.map(id => players.find(p => p.id === id)).filter(Boolean);

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 80% 60% at 50% 40%, #0F4A35 0%, #090C0B 70%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      {/* Result for me */}
      <div style={{ fontSize: 72, marginBottom: 12 }}>{amShithead ? "💀" : "🏆"}</div>
      <div style={{
        fontFamily: "Georgia, serif", fontSize: 36, fontWeight: 900,
        color: amShithead ? "#C0392B" : "#C9A84C",
        letterSpacing: 2, marginBottom: 8,
      }}>
        {amShithead ? "SHITHEAD" : "YOU WIN"}
      </div>
      <div style={{ fontSize: 14, color: "#7A9E8E", marginBottom: 40, textAlign: "center" }}>
        {amShithead ? "You were the last one holding cards." : "You escaped before the rest."}
      </div>

      {/* Rankings */}
      <div style={{
        width: "100%", maxWidth: 380,
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: 12, padding: 24, marginBottom: 28,
      }}>
        <div style={{ fontSize: 12, color: "#7A9E8E", letterSpacing: 3, textTransform: "uppercase", marginBottom: 16 }}>Final Rankings</div>
        {ranked.map((p, i) => {
          const isShithead = p.id === shitheadId;
          const isMe = p.id === myId;
          return (
            <div key={p.id} style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "12px 0",
              borderBottom: i < ranked.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: isShithead ? "rgba(192,57,43,0.15)" : i === 0 ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isShithead ? "rgba(192,57,43,0.4)" : i === 0 ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 14,
                color: isShithead ? "#C0392B" : i === 0 ? "#C9A84C" : "#7A9E8E",
                flexShrink: 0,
              }}>
                {isShithead ? "💩" : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontWeight: isMe ? 700 : 400,
                  color: isMe ? "#F5F0E8" : "#7A9E8E",
                  fontSize: 15,
                }}>
                  {p.name} {isMe ? "(you)" : ""}
                </div>
                {p.shitheadCount > 0 && (
                  <div style={{ fontSize: 11, color: "#3a5a4a" }}>
                    {"💩".repeat(p.shitheadCount)} {p.shitheadCount}× Shithead this game
                  </div>
                )}
              </div>
              <div style={{ fontSize: 13, color: isShithead ? "#C0392B" : "#3a5a4a", fontWeight: isShithead ? 700 : 400 }}>
                {isShithead ? "SHITHEAD" : `#${i + 1}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* New round / waiting */}
      {isHost ? (
        <button
          onClick={() => socket.emit("newRound")}
          style={{
            padding: "15px 48px",
            background: "#C9A84C", color: "#090C0B",
            border: "none", borderRadius: 10,
            fontSize: 15, fontWeight: 700,
            fontFamily: "Georgia, serif", letterSpacing: 2,
            cursor: "pointer",
          }}
        >
          NEW ROUND
        </button>
      ) : (
        <div style={{ fontSize: 13, color: "#3a5a4a" }}>Waiting for host to start a new round…</div>
      )}
    </div>
  );
}
