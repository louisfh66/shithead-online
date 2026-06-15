import { useState, useEffect } from "react";
import socket from "./socket";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Setup from "./pages/Setup";
import Game from "./pages/Game";
import Results from "./pages/Results";

export default function App() {
  const [screen, setScreen] = useState("connecting");
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Connection status
    socket.on("connect", () => {
      setScreen(prev => prev === "connecting" ? "home" : prev);
    });

    socket.on("disconnect", () => {
      // Don't boot them to connecting screen mid-game
    });

    socket.on("connect_error", () => {
      setScreen("connecting");
    });

    socket.on("partyCreated", () => setScreen("lobby"));
    socket.on("joinedParty", () => setScreen("lobby"));

    socket.on("gameState", (state) => {
      setGameState(state);
      if (state.phase === "lobby")   setScreen("lobby");
      if (state.phase === "setup")   setScreen("setup");
      if (state.phase === "game")    setScreen("game");
      if (state.phase === "results") setScreen("results");
    });

    socket.on("error", (msg) => {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    });

    // If already connected (fast load)
    if (socket.connected) setScreen("home");

    return () => {
      socket.off("connect");
      socket.off("disconnect");
      socket.off("connect_error");
      socket.off("partyCreated");
      socket.off("joinedParty");
      socket.off("gameState");
      socket.off("error");
    };
  }, []);

  if (screen === "connecting") {
    return (
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse 80% 60% at 50% 60%, #0F4A35 0%, #090C0B 70%)",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        gap: 20,
      }}>
        <div style={{ fontFamily: "Georgia, serif", fontSize: 48, fontWeight: 900, letterSpacing: -1 }}>
          <span style={{ color: "#C0392B" }}>SHIT</span>
          <span style={{ color: "#F5F0E8" }}>HEAD</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#7A9E8E", fontSize: 14 }}>
          <div style={{
            width: 16, height: 16, borderRadius: "50%",
            border: "2px solid #7A9E8E",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }}/>
          Connecting to server…
        </div>
        <div style={{ fontSize: 11, color: "#3a5a4a", maxWidth: 260, textAlign: "center", lineHeight: 1.6 }}>
          First load may take up to 30 seconds while the server wakes up.
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#090C0B", color: "#F5F0E8", fontFamily: "system-ui, sans-serif" }}>
      {error && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#C0392B", color: "#fff", padding: "10px 24px",
          borderRadius: 8, fontSize: 14, zIndex: 999, fontWeight: 600,
          boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
        }}>
          {error}
        </div>
      )}
      {screen === "home"    && <Home />}
      {screen === "lobby"   && <Lobby gameState={gameState} />}
      {screen === "setup"   && <Setup gameState={gameState} />}
      {screen === "game"    && <Game gameState={gameState} />}
      {screen === "results" && <Results gameState={gameState} />}
    </div>
  );
}
