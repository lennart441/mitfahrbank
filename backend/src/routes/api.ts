import type { FastifyInstance } from "fastify";
import { config } from "../config.js";
import { pool, type RideRequest, type ShoppingRequest, type User } from "../db.js";
import { getUserById, requireAuth } from "../auth.js";
import { reverseGeocode, searchPlaces } from "../geocode.js";
import {
  deletePushSubscription,
  notifyDriversWebPush,
  pushEnabled,
  upsertPushSubscription,
} from "../push.js";
import { canAccessRideChat } from "../rides.js";

type RideWithNames = RideRequest & {
  seeker_name: string;
  seeker_phone: string | null;
  seeker_phone_public: boolean;
  driver_name: string | null;
  driver_phone: string | null;
  driver_phone_public: boolean;
};

async function deleteChatForContext(
  contextType: string,
  contextId: number,
) {
  await pool.query(
    "DELETE FROM chat_messages WHERE context_type = $1 AND context_id = $2",
    [contextType, contextId],
  );
}

export async function registerApiRoutes(app: FastifyInstance) {
  app.get("/api/config", async () => ({
    destinations: config.destinations,
    map: config.map,
    push: {
      enabled: pushEnabled(),
      vapidPublicKey: config.push.publicKey || null,
    },
  }));

  app.get("/api/geocode", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const q = (request.query as { q?: string }).q?.trim();
    if (!q || q.length < 3) {
      return reply.code(400).send({ error: "q must be at least 3 characters" });
    }

    try {
      const results = await searchPlaces(q);
      return results;
    } catch {
      return reply.code(502).send({ error: "Geocoding unavailable" });
    }
  });

  app.get("/api/reverse-geocode", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const query = request.query as { lat?: string; lon?: string };
    const lat = Number(query.lat);
    const lon = Number(query.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return reply.code(400).send({ error: "lat and lon required" });
    }

    try {
      return await reverseGeocode(lat, lon);
    } catch {
      return reply.code(502).send({ error: "Reverse geocoding unavailable" });
    }
  });

  app.get("/api/me", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const user = await getUserById(auth.userId);
    if (!user) return reply.code(404).send({ error: "User not found" });
    return user;
  });

  app.patch("/api/me", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const body = request.body as Record<string, unknown>;

    const sets: string[] = [];
    const params: unknown[] = [auth.userId];

    const add = (col: string, key: string, nullable = false) => {
      if (!(key in body)) return;
      params.push(body[key] ?? (nullable ? null : body[key]));
      sets.push(`${col} = $${params.length}`);
    };

    add("phone_number", "phone_number", true);
    add("is_phone_public", "is_phone_public");
    add("name", "name", true);
    add("is_driver_notify", "is_driver_notify");
    add("notify_all_destinations", "notify_all_destinations");
    add("notify_center_lat", "notify_center_lat", true);
    add("notify_center_lon", "notify_center_lon", true);
    add("notify_radius_km", "notify_radius_km", true);
    add("notify_preset_ids", "notify_preset_ids", true);
    add("notify_time_start", "notify_time_start", true);
    add("notify_time_end", "notify_time_end", true);
    add("notify_days", "notify_days", true);

    if (!sets.length) {
      return reply.code(400).send({ error: "No fields to update" });
    }

    const { rows } = await pool.query<User>(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $1 RETURNING *`,
      params,
    );
    return rows[0];
  });

  app.post("/api/push/subscribe", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });
    if (!pushEnabled()) {
      return reply.code(503).send({ error: "Web push not configured" });
    }

    const body = request.body as {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    };
    if (!body?.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
      return reply.code(400).send({ error: "Invalid subscription" });
    }

    await upsertPushSubscription(auth.userId, body);
    return { ok: true };
  });

  app.delete("/api/push/subscribe", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const endpoint = (request.body as { endpoint?: string })?.endpoint;
    await deletePushSubscription(auth.userId, endpoint);
    return { ok: true };
  });

  app.post("/api/ride-requests", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const { destination, dest_lat, dest_lon } = request.body as {
      destination: string;
      dest_lat?: number | null;
      dest_lon?: number | null;
    };
    if (!destination?.trim()) {
      return reply.code(400).send({ error: "destination required" });
    }

    const lat =
      dest_lat != null && Number.isFinite(dest_lat) ? dest_lat : null;
    const lon =
      dest_lon != null && Number.isFinite(dest_lon) ? dest_lon : null;

    const { rows } = await pool.query<RideRequest>(
      `INSERT INTO ride_requests (user_id, destination, dest_lat, dest_lon)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [auth.userId, destination.trim(), lat, lon],
    );

    const seeker = await getUserById(auth.userId);
    void notifyDriversWebPush(
      "Neue Mitfahranfrage",
      `${seeker?.name ?? "Jemand"} möchte nach: ${destination.trim()}`,
      "/",
      lat,
      lon,
      destination.trim(),
      auth.userId,
    );

    app.broadcast?.({ type: "ride_requests_changed" });
    return rows[0];
  });

  app.get("/api/ride-requests", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const query = request.query as {
      role?: string;
      mine?: string;
      archive?: string;
    };
    const isArchive = query.archive === "1";

    let sql = `
      SELECT r.*,
        s.name AS seeker_name,
        s.phone_number AS seeker_phone,
        s.is_phone_public AS seeker_phone_public,
        d.name AS driver_name,
        d.phone_number AS driver_phone,
        d.is_phone_public AS driver_phone_public
      FROM ride_requests r
      JOIN users s ON s.id = r.user_id
      LEFT JOIN users d ON d.id = r.driver_id
    `;
    const params: unknown[] = [];

    if (isArchive) {
      if (query.role === "driver") {
        sql += ` WHERE r.driver_id = $1 AND r.archived_at IS NOT NULL`;
        params.push(auth.userId);
      } else if (query.mine === "1") {
        sql += ` WHERE (r.user_id = $1 OR r.driver_id = $1) AND r.archived_at IS NOT NULL`;
        params.push(auth.userId);
      } else {
        sql += ` WHERE r.user_id = $1 AND r.archived_at IS NOT NULL`;
        params.push(auth.userId);
      }
      sql += ` ORDER BY r.archived_at DESC NULLS LAST, r.updated_at DESC LIMIT 100`;
    } else if (query.mine === "1") {
      sql += ` WHERE (r.user_id = $1 OR r.driver_id = $1) AND r.archived_at IS NULL`;
      params.push(auth.userId);
    } else if (query.role === "driver") {
      sql += ` WHERE r.status IN ('waiting', 'driving') AND r.archived_at IS NULL`;
    } else {
      sql += ` WHERE r.user_id = $1 AND r.archived_at IS NULL`;
      params.push(auth.userId);
    }

    if (!isArchive) {
      sql += ` ORDER BY r.created_at DESC LIMIT 50`;
    }

    const { rows } = await pool.query<RideWithNames>(sql, params);
    return rows;
  });

  app.post("/api/ride-requests/:id/claim", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const id = Number((request.params as { id: string }).id);
    const { rows } = await pool.query<RideRequest>(
      `UPDATE ride_requests
       SET status = 'driving', driver_id = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'waiting'
       RETURNING *`,
      [id, auth.userId],
    );

    if (!rows[0]) {
      return reply.code(409).send({ error: "Already claimed or not found" });
    }

    app.broadcast?.({ type: "ride_requests_changed" });
    return rows[0];
  });

  app.patch("/api/ride-requests/:id", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const id = Number((request.params as { id: string }).id);
    const { status } = request.body as { status: string };
    const allowed = ["completed", "cancelled", "waiting"];
    if (!allowed.includes(status)) {
      return reply.code(400).send({ error: "Invalid status" });
    }

    const { rows } = await pool.query<RideRequest>(
      `UPDATE ride_requests
       SET status = $3,
           updated_at = CURRENT_TIMESTAMP,
           archived_at = CASE
             WHEN $3 IN ('completed', 'cancelled') THEN CURRENT_TIMESTAMP
             ELSE archived_at
           END
       WHERE id = $1 AND (user_id = $2 OR driver_id = $2) AND archived_at IS NULL
       RETURNING *`,
      [id, auth.userId, status],
    );

    if (!rows[0]) {
      return reply.code(404).send({ error: "Not found" });
    }

    if (status === "completed" || status === "cancelled") {
      await deleteChatForContext("ride", id);
    }

    app.broadcast?.({ type: "ride_requests_changed" });
    return rows[0];
  });

  app.get("/api/shopping-requests", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const { rows } = await pool.query<
      ShoppingRequest & { creator_name: string; helper_name: string | null }
    >(
      `SELECT sh.*, c.name AS creator_name, h.name AS helper_name
       FROM shopping_requests sh
       JOIN users c ON c.id = sh.creator_id
       LEFT JOIN users h ON h.id = sh.helper_id
       WHERE sh.status != 'done' OR sh.creator_id = $1 OR sh.helper_id = $1
       ORDER BY sh.created_at DESC
       LIMIT 50`,
      [auth.userId],
    );
    return rows;
  });

  app.post("/api/shopping-requests", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const { items, store_name } = request.body as {
      items: string;
      store_name?: string;
    };
    if (!items?.trim()) {
      return reply.code(400).send({ error: "items required" });
    }

    const { rows } = await pool.query<ShoppingRequest>(
      `INSERT INTO shopping_requests (creator_id, items, store_name)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [auth.userId, items.trim(), store_name?.trim() ?? null],
    );

    app.broadcast?.({ type: "shopping_requests_changed" });
    return rows[0];
  });

  app.post("/api/shopping-requests/:id/claim", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const id = Number((request.params as { id: string }).id);
    const { rows } = await pool.query<ShoppingRequest>(
      `UPDATE shopping_requests
       SET status = 'claimed', helper_id = $2
       WHERE id = $1 AND status = 'open'
       RETURNING *`,
      [id, auth.userId],
    );

    if (!rows[0]) {
      return reply.code(409).send({ error: "Already claimed" });
    }

    app.broadcast?.({ type: "shopping_requests_changed" });
    return rows[0];
  });

  app.patch("/api/shopping-requests/:id", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const id = Number((request.params as { id: string }).id);
    const { status } = request.body as { status: string };

    const { rows } = await pool.query<ShoppingRequest>(
      `UPDATE shopping_requests
       SET status = $3
       WHERE id = $1 AND (creator_id = $2 OR helper_id = $2)
       RETURNING *`,
      [id, auth.userId, status],
    );

    if (!rows[0]) return reply.code(404).send({ error: "Not found" });

    if (status === "done") {
      await deleteChatForContext("shopping", id);
    }

    app.broadcast?.({ type: "shopping_requests_changed" });
    return rows[0];
  });

  app.get("/api/chat/:contextType/:contextId", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const { contextType, contextId } = request.params as {
      contextType: string;
      contextId: string;
    };

    if (contextType === "ride") {
      const ok = await canAccessRideChat(Number(contextId), auth.userId);
      if (!ok) return reply.code(403).send({ error: "Forbidden" });
    }

    const { rows } = await pool.query(
      `SELECT m.*, u.name AS sender_name
       FROM chat_messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.context_type = $1 AND m.context_id = $2
       ORDER BY m.created_at ASC`,
      [contextType, Number(contextId)],
    );
    return rows;
  });

  app.post("/api/chat/:contextType/:contextId", async (request, reply) => {
    const auth = requireAuth(request);
    if (!auth) return reply.code(401).send({ error: "Unauthorized" });

    const { contextType, contextId } = request.params as {
      contextType: string;
      contextId: string;
    };
    const { body: text } = request.body as { body: string };
    if (!text?.trim()) {
      return reply.code(400).send({ error: "body required" });
    }

    if (contextType === "ride") {
      const ok = await canAccessRideChat(Number(contextId), auth.userId);
      if (!ok) return reply.code(403).send({ error: "Forbidden" });
    }

    const { rows } = await pool.query(
      `INSERT INTO chat_messages (context_type, context_id, sender_id, body)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [contextType, Number(contextId), auth.userId, text.trim()],
    );

    app.broadcast?.({
      type: "chat",
      contextType,
      contextId: Number(contextId),
    });
    return rows[0];
  });
}

declare module "fastify" {
  interface FastifyInstance {
    broadcast?: (payload: object) => void;
  }
}
