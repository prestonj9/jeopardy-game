import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";
import { registerSocketHandlers } from "./src/lib/socket-handlers.ts";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// Next.js uses "localhost" for internal URL resolution,
// but we bind the HTTP server to "0.0.0.0" so phones on LAN can connect.
const app = next({ dev, hostname: "localhost", port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
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
