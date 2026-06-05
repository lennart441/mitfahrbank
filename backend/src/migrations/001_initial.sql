-- Profile (id = OIDC 'sub', format varies by IdP)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(30),
    is_phone_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ride_requests (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    destination VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'waiting',
    driver_id TEXT REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS shopping_requests (
    id SERIAL PRIMARY KEY,
    creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    helper_id TEXT REFERENCES users(id),
    store_name VARCHAR(100),
    items TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    context_type VARCHAR(20) NOT NULL,
    context_id INTEGER NOT NULL,
    sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ride_requests_status ON ride_requests(status);
CREATE INDEX IF NOT EXISTS idx_shopping_requests_status ON shopping_requests(status);
CREATE INDEX IF NOT EXISTS idx_chat_context ON chat_messages(context_type, context_id);
