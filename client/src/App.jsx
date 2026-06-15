import { useState, useEffect } from "react";
import socket from "./socket";
import Home from "./pages/Home";
import Lobby from "./pages/Lobby";
import Setup from "./pages/Setup";
import Game from "./pages/Game";
import Results from "./pages/Results";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [gameState, setGameState] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    socket.on("partyCreated", ({ code }) => {
      setScreen("lobby");
    });

    socket.on("joinedParty", ({ code }) => {
      setScreen("lobby");
    });

    socket.on("gameState", (state) => {
      setGameState(state);
      if (state.phase === "lobby") setScreen("lobby");
      if (state.phase === "setup") setScreen("setup");
      if (state.phase === "game") setScreen("game");
      if (state.phase === "results") setScreen("results");
    });

    socket.on("error", (msg) => {
      setError(msg);
      setTimeout(() => setError(null), 3000);
    });

    return () => {
      socket.off("partyCreated");
      socket.off("joinedParty");
      socket.off("gameState");
      socket.off("error");
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#090C0B", color: "#F5F0E8", fontFamily: "system-ui, sans-serif" }}>
      {error && (
        <div style={{
          position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
          background: "#C0392B", color: "#fff", padding: "10px 24px",
          borderRadius: 8, fontSize: 14, zIndex: 999, fontWeight: 600,
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
