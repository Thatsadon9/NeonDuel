-- Leaderboard: one row per finished run. Screenshots live in object storage; the row keeps the key.
CREATE TABLE IF NOT EXISTS runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 16),
  score       integer     NOT NULL CHECK (score >= 0),
  stage       smallint    NOT NULL CHECK (stage BETWEEN 0 AND 10),
  won         boolean     NOT NULL,
  hard        boolean     NOT NULL DEFAULT false,
  weapon      text        NOT NULL CHECK (weapon IN ('katana', 'daggers', 'hammer')),
  time_s      real        NOT NULL CHECK (time_s >= 0),
  kills       integer     NOT NULL DEFAULT 0,
  parries     integer     NOT NULL DEFAULT 0,
  perfects    integer     NOT NULL DEFAULT 0,
  executions  integer     NOT NULL DEFAULT 0,
  max_combo   integer     NOT NULL DEFAULT 0,
  best_rank   smallint    NOT NULL DEFAULT 0 CHECK (best_rank BETWEEN 0 AND 6),
  shot_key    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- leaderboard query: top scores per difficulty
CREATE INDEX IF NOT EXISTS runs_hard_score_idx ON runs (hard, score DESC, created_at);
