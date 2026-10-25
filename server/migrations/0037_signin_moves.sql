-- A session used from another place (wish #69, Rob, 24.10.2026: "Wechsel erfassen"): a person who stays signed in for weeks
-- makes no new sign-in when the app is used from somewhere else – and a stolen session would not show. So when a running
-- session (at most once an hour, as it is renewed) is used from a place or an address other than the one it had, the change
-- is kept in the same list with kind 'moved'. The last 20 of each kind are kept; a move is no sign-in and never marks a first time.
ALTER TABLE signins ADD COLUMN kind TEXT NOT NULL DEFAULT 'signin' CHECK (kind IN ('signin', 'moved'));
