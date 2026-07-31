CREATE TABLE feedback_receipts (
  report_id TEXT PRIMARY KEY NOT NULL,
  token_digest TEXT NOT NULL,
  issue_number INTEGER UNIQUE NOT NULL,
  submitted_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
