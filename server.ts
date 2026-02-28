import { createServer } from "node:http";
import { mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import next from "next";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./src/lib/socket-handlers.ts";
import { initDatabase } from "./src/lib/board-cache.ts";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// Next.js uses "localhost" for internal URL resolution,
// but we bind the HTTP server to "0.0.0.0" so phones on LAN can connect.
const app = next({ dev, hostname: "localhost", port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  // Initialize SQLite database for board caching
  const dbPath = process.env.JEOPARDY_DB_PATH || resolve("data", "jeopardy.db");
  mkdirSync(dirname(dbPath), { recursive: true });
  const db = initDatabase(dbPath);
  (globalThis as Record<string, unknown>).__jeopardy_db__ = db;
  console.log(`> SQLite board cache initialized at ${dbPath}`);

  const httpServer = createServer(handler);

  const corsOrigin = dev
    ? "*"
    : process.env.NEXT_PUBLIC_URL
      ? [process.env.NEXT_PUBLIC_URL]
      : "*";

  const io = new Server(httpServer, {
    cors: {
      origin: corsOrigin,
    },
  });

  // Store io globally so game-manager can broadcast when background generation completes
  (globalThis as Record<string, unknown>).__jeopardy_io__ = io;

  registerSocketHandlers(io);

  httpServer
    .once("error", (err: Error) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, "0.0.0.0", () => {
      console.log(`> Ready on http://0.0.0.0:${port}`);
    });
});
