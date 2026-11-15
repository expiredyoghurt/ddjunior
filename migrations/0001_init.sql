-- Dialogue Dash Junior 0.2.0. Safe to run more than once.
CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  sess_ver INTEGER NOT NULL DEFAULT 1,      -- bump to sign every pupil in the class out
  archived INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

-- Pupils have no username and no password: a device holds the class code, the child taps their name tile.
CREATE TABLE IF NOT EXISTS pupils (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id INTEGER NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE,
  created_at INTEGER NOT NULL,
  last_seen INTEGER
);
CREATE UNIQUE INDEX IF NOT EXISTS pupils_class_name ON pupils(class_id, name);

-- One saved copy of each pupil's progress (stars, stickers, missed items), merged so nothing is ever lost.
CREATE TABLE IF NOT EXISTS progress (
  pupil_id INTEGER PRIMARY KEY,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- One row per finished round. rid is made on the device, so a retry after bad wifi is counted once.
CREATE TABLE IF NOT EXISTS rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rid TEXT NOT NULL UNIQUE,
  pupil_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  mode TEXT NOT NULL,                       -- level | practise | write
  level INTEGER NOT NULL DEFAULT 0,
  stars INTEGER NOT NULL DEFAULT 0,
  first_right INTEGER NOT NULL DEFAULT 0,
  items INTEGER NOT NULL DEFAULT 0,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS rounds_pupil ON rounds(pupil_id, ts);
CREATE INDEX IF NOT EXISTS rounds_class ON rounds(class_id);

-- One row per item in a round. level is the rule the item teaches (1 to 5).
CREATE TABLE IF NOT EXISTS answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rid TEXT NOT NULL,
  pupil_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  first_ok INTEGER NOT NULL,
  revealed INTEGER NOT NULL DEFAULT 0,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS answers_pupil ON answers(pupil_id, level);

CREATE TABLE IF NOT EXISTS teachers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  pass_salt TEXT NOT NULL,
  pass_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  sess_ver INTEGER NOT NULL DEFAULT 0,      -- bumped on password reset or switching off
  created_at INTEGER NOT NULL,
  last_login INTEGER
);
CREATE TABLE IF NOT EXISTS teacher_classes (
  teacher_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  PRIMARY KEY (teacher_id, class_id)
);
CREATE INDEX IF NOT EXISTS teacher_classes_class ON teacher_classes(class_id);

-- The teacher who made a class owns it and can delete it. Classes made by the admin have no owner.
CREATE TABLE IF NOT EXISTS class_owners (
  class_id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS class_owners_teacher ON class_owners(teacher_id);

INSERT INTO meta (k, v) VALUES ('schema_version', 1) ON CONFLICT(k) DO UPDATE SET v = 1;
