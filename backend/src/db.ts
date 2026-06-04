import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://mitfahrbank:change-me@localhost:5432/mitfahrbank",
});

export type User = {
  id: string;
  name: string;
  phone_number: string | null;
  is_phone_public: boolean;
  is_driver_notify: boolean;
  ntfy_topic: string | null;
  created_at: Date;
};

export type RideRequest = {
  id: number;
  user_id: string;
  destination: string;
  dest_lat: number | null;
  dest_lon: number | null;
  status: string;
  driver_id: string | null;
  archived_at: Date | null;
  created_at: Date;
  updated_at: Date;
};

export type ShoppingRequest = {
  id: number;
  creator_id: string;
  helper_id: string | null;
  store_name: string | null;
  items: string;
  status: string;
  created_at: Date;
};
