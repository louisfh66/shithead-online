import { io } from "socket.io-client";

const URL = (import.meta as any).env?.VITE_SERVER_URL || "http://localhost:3001";

export const socket = io(URL, {
  transports: ["websocket", "polling"], // allow fallback
});
