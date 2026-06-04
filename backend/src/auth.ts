import type { FastifyInstance, FastifyRequest } from "fastify";
import * as client from "openid-client";
import { config, oidcConfigured } from "./config.js";
import { pool, type User } from "./db.js";

declare module "@fastify/session" {
  interface FastifySessionObject {
    oauthState?: string;
    oauthNonce?: string;
    userId?: string;
  }
}

let oidcConfig: client.Configuration | null = null;

export async function getOidcConfig(): Promise<client.Configuration | null> {
  if (!oidcConfigured()) return null;
  if (!oidcConfig) {
    oidcConfig = await client.discovery(
      new URL(config.oidc.issuer),
      config.oidc.clientId,
      config.oidc.clientSecret,
    );
  }
  return oidcConfig;
}

export async function upsertUserFromClaims(
  sub: string,
  name: string,
): Promise<User> {
  const { rows } = await pool.query<User>(
    `INSERT INTO users (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    [sub, name],
  );
  return rows[0];
}

export async function getUserById(id: string): Promise<User | null> {
  const { rows } = await pool.query<User>(
    "SELECT * FROM users WHERE id = $1",
    [id],
  );
  return rows[0] ?? null;
}

export function requireAuth(
  request: FastifyRequest,
): { userId: string } | null {
  const userId = request.session.userId;
  if (!userId) return null;
  return { userId };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/auth/login", async (request, reply) => {
    const oidc = await getOidcConfig();
    if (!oidc) {
      return reply.redirect("/auth/dev-login");
    }

    const state = client.randomState();
    const nonce = client.randomNonce();
    request.session.oauthState = state;
    request.session.oauthNonce = nonce;

    const redirectTo = client.buildAuthorizationUrl(oidc, {
      redirect_uri: config.oidc.redirectUri,
      scope: "openid profile email",
      state,
      nonce,
    });

    return reply.redirect(redirectTo.href);
  });

  app.get("/auth/callback", async (request, reply) => {
    const oidc = await getOidcConfig();
    if (!oidc) {
      return reply.code(503).send({ error: "OIDC not configured" });
    }

    const url = new URL(`${config.publicUrl}${request.url}`);
    const state = request.session.oauthState;
    const nonce = request.session.oauthNonce;

    if (!state || !nonce) {
      return reply.code(400).send({ error: "Missing OAuth session" });
    }

    try {
      const tokens = await client.authorizationCodeGrant(oidc, url, {
        expectedState: state,
        expectedNonce: nonce,
      });
      const claims = tokens.claims();
      const sub = claims?.sub;
      const name =
        (claims?.name as string | undefined) ??
        (claims?.preferred_username as string | undefined) ??
        "Nutzer";

      if (!sub) {
        return reply.code(400).send({ error: "No subject in token" });
      }

      await upsertUserFromClaims(sub, name);
      request.session.userId = sub;
      delete request.session.oauthState;
      delete request.session.oauthNonce;

      return reply.redirect("/");
    } catch (err) {
      request.log.error(err);
      return reply.code(401).send({ error: "Login failed" });
    }
  });

  /** Dev-only login when Authentik is not configured */
  app.get("/auth/dev-login", async (request, reply) => {
    if (oidcConfigured()) {
      return reply.redirect("/auth/login");
    }
    const devId = "00000000-0000-4000-8000-000000000001";
    await upsertUserFromClaims(devId, "Entwickler (Demo)");
    request.session.userId = devId;
    return reply.redirect("/");
  });

  app.post("/auth/logout", async (request, reply) => {
    request.session.destroy();
    return reply.send({ ok: true });
  });
}
