-- english-tracker · esquema inicial
-- Tandas, tareas, estado por fase e histórico de comentarios por fase.

CREATE TABLE IF NOT EXISTS batches (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  position   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE TABLE IF NOT EXISTS tasks (
  id              TEXT PRIMARY KEY,
  batch_id        TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  work_type       TEXT,
  scope           TEXT,
  effort          TEXT,
  owner           TEXT,
  minutes         REAL,
  priority        TEXT,
  source_note     TEXT,
  production_note TEXT,
  position        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  updated_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_batch ON tasks(batch_id, position);

CREATE TABLE IF NOT EXISTS phase_states (
  task_id  TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  phase    TEXT NOT NULL,
  done     INTEGER NOT NULL DEFAULT 0,
  done_at  TEXT,
  done_by  TEXT,
  PRIMARY KEY (task_id, phase)
);

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT PRIMARY KEY,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  phase      TEXT NOT NULL,
  author     TEXT,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_task ON comments(task_id, created_at);
