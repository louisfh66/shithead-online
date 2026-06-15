import { useState } from "react";
import socket from "../socket";

function Card({ card, selected, onClick }) {
  const isRed = ["♥","♦"].includes(card.suit);
  return (
    <div
      onClick={onClick}
      style={{
        width: 70, height: 100,
        borderRadius: 8,
        background: "#FAFAF8",
        border: selected ? "2px solid #C9A84C" : "1px solid rgba(0,0,0,0.15)",
        boxShadow: selected
          ? "0 0 16px rgba(201,168,76,0.5), 0 4px 12px rgba(0,0,0,0.4)"
          : "0 4px 12px rgba(0,0,0,0.4)",
        transform: selected ? "translateY(-12px)" : "none",
        transition: "all 0.15s",
        cursor: "pointer",
        display: "flex", flexDirection: "column",
        justifyContent: "space-between",
        padding: "6px 8px",
        userSelect: "none",
        flexShrink: 0,
      }}
    >
      <div style={{ color: isRed ? "#C0392B" : "#0a0a0a", fontSize: 16, fontWeight: 700, fontFamily: "serif", lineHeight: 1 }}>
        {card.rank}<br/><span style={{ fontSize: 12 }}>{card.suit}</span>
      </div>
      <div style={{ color: isRed ? "#C0392B" : "#0a0a0a", fontSize: 16, fontWeight: 700, fontFamily: "serif", lineHeight: 1, transform: "rotate(180deg)", alignSelf: "flex-end" }}>
        {card.rank}<br/><span style={{ fontSize: 12 }}>{card.suit}</span>
      </div>
    </div>
  );
}

export default function Setup({ gameState }) {
  const [selected, setSelected] = useState([]);

  if (!gameState) return null;
  const { myHand, players, myId } = gameState;
  const me = players.find(p => p.id === myId);
  const allReady = players.every(p => p.faceUp && p.faceUp.length === 3);

  function toggle(cardId) {
    setSelected(prev => {
      if (prev.includes(cardId)) return prev.filter(id => id !== cardId);
      if (prev.length >= 3) return prev;
      return [...prev, cardId];
    });
  }

  function confirm() {
    if (selected.length !== 3) return;
    socket.emit("confirmSetup", { cardIds: selected });
  }

  const myFaceUpDone = me?.faceUp?.length === 3;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 80% 60% at 50% 40%, #0F4A35 0%, #090C0B 70%)",
      display: "flex", flexDirection: "column",
      alignItems: "center",
      padding: "40px 24px",
    }}>
      <div style={{ fontFamily: "Georgia, serif", fontSize: 24, fontWeight: 900, color: "#C9A84C", marginBottom: 6, letterSpacing: 2 }}>
        SETUP
      </div>
      <div style={{ fontSize: 14, color: "#7A9E8E", marginBottom: 32, textAlign: "center", lineHeight: 1.6 }}>
        {myFaceUpDone
          ? "Waiting for other players…"
          : <>Choose <strong style={{ color: "#C9A84C" }}>3 cards</strong> to place face-up on the table.<br/>These are played after your hand runs out.</>
        }
      </div>

      {/* Player ready status */}
      <div style={{ display: "flex", gap: 12, marginBottom: 32, flexWrap: "wrap", justifyContent: "center" }}>
        {players.map(p => (
          <div key={p.id} style={{
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            background: p.faceUp?.length === 3 ? "rgba(201,168,76,0.12)" : "rgba(255,255,255,0.04)",
            border: `1px solid ${p.faceUp?.length === 3 ? "rgba(201,168,76,0.4)" : "rgba(255,255,255,0.08)"}`,
            color: p.faceUp?.length === 3 ? "#C9A84C" : "#4a7a6a",
          }}>
            {p.faceUp?.length === 3 ? "✓ " : ""}{p.name} {p.id === myId ? "(you)" : ""}
          </div>
        ))}
      </div>

      {/* Hand cards */}
      {!myFaceUpDone && (
        <>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 }}>
            {myHand?.map(card => (
              <Card
                key={card.id}
                card={card}
                selected={selected.includes(card.id)}
                onClick={() => toggle(card.id)}
              />
            ))}
          </div>

          <div style={{ fontSize: 13, color: "#7A9E8E", marginBottom: 20 }}>
            {selected.length}/3 selected
          </div>

          <button
            onClick={confirm}
            disabled={selected.length !== 3}
            style={{
              padding: "14px 48px",
              background: selected.length === 3 ? "#C9A84C" : "rgba(255,255,255,0.04)",
              color: selected.length === 3 ? "#090C0B" : "#3a5a4a",
              border: selected.length === 3 ? "none" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 10, fontSize: 15, fontWeight: 700,
              fontFamily: "Georgia, serif", letterSpacing: 2,
              cursor: selected.length === 3 ? "pointer" : "default",
            }}
          >
            CONFIRM
          </button>
        </>
      )}
    </div>
  );
}
