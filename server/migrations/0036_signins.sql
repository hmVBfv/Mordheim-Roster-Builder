-- Where and with what a person signed in (wish #69, Rob, 24.10.2026), for the admin who has to tell a strange sign-in from the
-- usual ones. Kept small on purpose: the last few sign-ins of each person (`signins`, the rest is deleted as new ones come) and
-- the first time each of their devices was seen (`known_devices`, one row per device, so "new device" stays known long after
-- its sign-in has been dropped). `place` is a rough place (city, region, country) from a database on the Pi itself; '' when
-- there is none. Read by the admin only; never part of what a user reads of their own account.
CREATE TABLE signins (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     TEXT NOT NULL REFERENCES users (id),
  at          TEXT NOT NULL,
  device      TEXT NOT NULL,
  ip          TEXT NOT NULL,
  place       TEXT NOT NULL DEFAULT '',
  first_time  INTEGER NOT NULL DEFAULT 0 CHECK (first_time IN (0, 1))
) STRICT;
CREATE INDEX signins_user ON signins (user_id, id);

CREATE TABLE known_devices (
  user_id      TEXT NOT NULL REFERENCES users (id),
  device       TEXT NOT NULL,
  first_at     TEXT NOT NULL,
  first_ip     TEXT NOT NULL,
  first_place  TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, device)
) STRICT;
