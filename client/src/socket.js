import { io } from "socket.io-client";
const URL = import.meta.env.PROD
  ? "https://shithead-server-eb9f.onrender.com"
  : "http://localhost:3001";
export const socket = io(URL);
export default socket;