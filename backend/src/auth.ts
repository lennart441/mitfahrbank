import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import * as client from "openid-client";
import { config, oidcConfigured } from "./config.js";
import { pool, type User } from "./db.js";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_NONCE_COOKIE = "oauth_nonce";

function oauthCookieOptions() {
  return {
    httpOnly: true,
    secure: config.publicUrl.startsWith("https"),
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600,
    signed: true,
  };
}

function readSignedOAuthCookie(
  request: FastifyRequest,
  name: string,
): string | null {
  const raw = request.cookies[name];
  if (!raw) return null;
  const { valid, value } = request.unsignCookie(raw);
  return valid && value ? value : null;
}

function clearOAuthCookies(reply: FastifyReply) {
  const opts = { path: "/" };
  reply.clearCookie(OAUTH_STATE_COOKIE, opts);
  reply.clearCookie(OAUTH_NONCE_COOKIE, opts);
}

function storeOAuthInCookies(
  reply: FastifyReply,
  state: string,
  nonce: string,
) {
  const opts = oauthCookieOptions();
  reply.setCookie(OAUTH_STATE_COOKIE, state, opts);
  reply.setCookie(OAUTH_NONCE_COOKIE, nonce, opts);
}

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
    storeOAuthInCookies(reply, state, nonce);
    await request.session.save();

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
    const state =
      readSignedOAuthCookie(request, OAUTH_STATE_COOKIE) ??
      request.session.oauthState;
    const nonce =
      readSignedOAuthCookie(request, OAUTH_NONCE_COOKIE) ??
      request.session.oauthNonce;

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
      clearOAuthCookies(reply);
      await request.session.save();

      return reply.redirect("/");
    } catch (err) {
      clearOAuthCookies(reply);
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
