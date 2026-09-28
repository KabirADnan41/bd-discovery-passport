-- Accounts for Bangladesh Discovery Passport.
-- Stored per person: a username, a password verifier (HMAC of a browser-side PBKDF2 key; never the
-- password), and the list of discovered district ids. No email, no real names, no raw IP addresses.

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  verifier TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE passports (
  user_id INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  discovered TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);

-- Only a SHA-256 of each session token is stored, so a database leak does not leak live sessions.
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_by_user ON sessions (user_id);

-- Fixed-window counters for failed sign-ins and sign-ups. Keys hold HMACs of the IP and username, never either value.
CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  window_start INTEGER NOT NULL
);
