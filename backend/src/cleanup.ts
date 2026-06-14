import { pool } from "./db.js";

async function deleteChatForContext(contextType: string, contextId: number) {
  await pool.query(
    "DELETE FROM chat_messages WHERE context_type = $1 AND context_id = $2",
    [contextType, contextId],
  );
}

export async function runStaleDataCleanup() {
  const staleRides = await pool.query<{ id: number }>(
    `SELECT id FROM ride_requests
     WHERE status != 'completed'
       AND created_at < NOW() - INTERVAL '14 days'`,
  );

  for (const row of staleRides.rows) {
    await deleteChatForContext("ride", row.id);
  }

  if (staleRides.rows.length > 0) {
    await pool.query(
      `DELETE FROM ride_requests
       WHERE status != 'completed'
         AND created_at < NOW() - INTERVAL '14 days'`,
    );
  }

  const staleShopping = await pool.query<{ id: number }>(
    `SELECT id FROM shopping_requests
     WHERE created_at < NOW() - INTERVAL '28 days'`,
  );

  for (const row of staleShopping.rows) {
    await deleteChatForContext("shopping", row.id);
  }

  if (staleShopping.rows.length > 0) {
    await pool.query(
      `DELETE FROM shopping_requests
       WHERE created_at < NOW() - INTERVAL '28 days'`,
    );
  }

  return {
    ridesDeleted: staleRides.rows.length,
    shoppingDeleted: staleShopping.rows.length,
  };
}

const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

export function scheduleStaleDataCleanup() {
  void runStaleDataCleanup().catch((err) => {
    console.error("Stale data cleanup failed:", err);
  });

  setInterval(() => {
    void runStaleDataCleanup().catch((err) => {
      console.error("Stale data cleanup failed:", err);
    });
  }, CLEANUP_INTERVAL_MS);
}
