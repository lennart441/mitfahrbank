import { pool } from "./db.js";

/** Suchende, zugewiesener Fahrer, oder registrierte Mitfahrer bei offener Anfrage */
export async function canAccessRideChat(
  rideId: number,
  userId: string,
): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT status, user_id, driver_id FROM ride_requests WHERE id = $1`,
    [rideId],
  );
  const ride = rows[0] as
    | { status: string; user_id: string; driver_id: string | null }
    | undefined;
  if (!ride) return false;
  if (ride.user_id === userId || ride.driver_id === userId) return true;
  if (ride.status === "waiting") {
    const { rows: notify } = await pool.query(
      `SELECT 1 FROM users WHERE id = $1 AND is_driver_notify = TRUE`,
      [userId],
    );
    return notify.length > 0;
  }
  return false;
}
