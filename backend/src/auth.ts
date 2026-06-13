import type {
  FastifyInstance,
  FastifyReply,
  FastifyRequest,
} from "fastify";
import { randomUUID } from "node:crypto";
import * as client from "openid-client";
import { config, oidcConfigured } from "./config.js";
import { pool, type User } from "./db.js";

const OAUTH_STATE_COOKIE = "oauth_state";
const OAUTH_NONCE_COOKIE = "oauth_nonce";
const MOBILE_AUTH_SCHEME = "de.stocksee.mitfahrbank";

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
    oauthNative?: boolean;
    oauthBrowser?: boolean;
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

function isNativeRequest(request: FastifyRequest): boolean {
  return (
    request.session.oauthNative === true ||
    (request.query as { native?: string }).native === "1"
  );
}

function isBrowserRequest(request: FastifyRequest): boolean {
  return (
    request.session.oauthBrowser === true ||
    (request.query as { browser?: string }).browser === "1"
  );
}

async function createMobileAuthToken(userId: string): Promise<string> {
  const token = randomUUID();
  await pool.query(
    `INSERT INTO mobile_auth_tokens (token, user_id, expires_at)
     VALUES ($1, $2, now() + interval '5 minutes')`,
    [token, userId],
  );
  return token;
}

async function consumeMobileAuthToken(token: string): Promise<string | null> {
  const { rows } = await pool.query<{ user_id: string }>(
    `DELETE FROM mobile_auth_tokens
     WHERE token = $1 AND expires_at > now()
     RETURNING user_id`,
    [token],
  );
  return rows[0]?.user_id ?? null;
}

async function finishLogin(
  request: FastifyRequest,
  reply: FastifyReply,
  userId: string,
): Promise<void> {
  const native = isNativeRequest(request);
  const browser = isBrowserRequest(request);
  delete request.session.oauthNative;
  delete request.session.oauthBrowser;

  if (native && browser) {
    const token = await createMobileAuthToken(userId);
    return reply.redirect(
      `${MOBILE_AUTH_SCHEME}://auth/success?token=${encodeURIComponent(token)}`,
    );
  }

  if (native) {
    return reply.redirect("/index.html");
  }

  return reply.redirect("/");
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get("/auth/login", async (request, reply) => {
    const oidc = await getOidcConfig();
    const native = (request.query as { native?: string }).native === "1";
    const browser = (request.query as { browser?: string }).browser === "1";

    if (!oidc) {
      const qs = new URLSearchParams();
      if (native) qs.set("native", "1");
      if (browser) qs.set("browser", "1");
      const suffix = qs.toString() ? `?${qs}` : "";
      return reply.redirect(`/auth/dev-login${suffix}`);
    }

    const state = client.randomState();
    const nonce = client.randomNonce();
    request.session.oauthState = state;
    request.session.oauthNonce = nonce;
    request.session.oauthNative = native;
    request.session.oauthBrowser = browser;
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

      return finishLogin(request, reply, sub);
    } catch (err) {
      clearOAuthCookies(reply);
      request.log.error(err);
      return reply.code(401).send({ error: "Login failed" });
    }
  });

  /** Dev-only login when Authentik is not configured */
  app.get("/auth/dev-login", async (request, reply) => {
    if (oidcConfigured()) {
      const qs = new URLSearchParams();
      const q = request.query as { native?: string; browser?: string };
      if (q.native === "1") qs.set("native", "1");
      if (q.browser === "1") qs.set("browser", "1");
      const suffix = qs.toString() ? `?${qs}` : "";
      return reply.redirect(`/auth/login${suffix}`);
    }

    const devId = "00000000-0000-4000-8000-000000000001";
    await upsertUserFromClaims(devId, "Entwickler (Demo)");
    request.session.userId = devId;
    request.session.oauthNative =
      (request.query as { native?: string }).native === "1";
    request.session.oauthBrowser =
      (request.query as { browser?: string }).browser === "1";
    await request.session.save();
    return finishLogin(request, reply, devId);
  });

  app.post("/auth/mobile-exchange", async (request, reply) => {
    const token = (request.body as { token?: string })?.token?.trim();
    if (!token) {
      return reply.code(400).send({ error: "token required" });
    }

    const userId = await consumeMobileAuthToken(token);
    if (!userId) {
      return reply.code(401).send({ error: "Invalid or expired token" });
    }

    request.session.userId = userId;
    await request.session.save();
    return { ok: true };
  });

  app.post("/auth/logout", async (request, reply) => {
    request.session.destroy();
    return reply.send({ ok: true });
  });
}
