import Fastify from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import session from "@fastify/session";
import staticFiles from "@fastify/static";
import websocket from "@fastify/websocket";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerAuthRoutes } from "./auth.js";
import { config, oidcConfigured } from "./config.js";
import { registerApiRoutes } from "./routes/api.js";
import { runMigrations } from "./run-migrations.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

const app = Fastify({ logger: true });

const wsClients = new Set<{ send: (data: string) => void }>();

app.decorate("broadcast", (payload: object) => {
  const msg = JSON.stringify(payload);
  for (const client of wsClients) {
    try {
      client.send(msg);
    } catch {
      /* disconnected */
    }
  }
});

await app.register(cookie);
await app.register(cors, {
  origin: config.frontendUrl,
  credentials: true,
});
await app.register(session, {
  secret: config.sessionSecret,
  cookie: {
    secure: config.publicUrl.startsWith("https"),
    maxAge: 60 * 60 * 24 * 7,
    sameSite: "lax",
    path: "/",
  },
});

await app.register(websocket);

app.get("/ws", { websocket: true }, (socket) => {
  const client = {
    send: (data: string) => socket.send(data),
  };
  wsClients.add(client);
  socket.on("close", () => wsClients.delete(client));
});

await registerAuthRoutes(app);
await registerApiRoutes(app);

app.get("/api/health", async () => ({
  ok: true,
  oidc: oidcConfigured(),
}));

if (existsSync(publicDir)) {
  await app.register(staticFiles, {
    root: publicDir,
    prefix: "/",
  });

  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api") || request.url.startsWith("/auth")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

async function start() {
  await runMigrations();
  await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`Mitfahrbank API on ${config.publicUrl}`);
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
