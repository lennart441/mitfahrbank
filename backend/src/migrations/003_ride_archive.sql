ALTER TABLE ride_requests
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMP;

UPDATE ride_requests
SET archived_at = updated_at
WHERE status IN ('completed', 'cancelled') AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ride_requests_archived ON ride_requests(archived_at);
