-- The device of each sign-in try (wish #72, Rob, 25.10.2026): the admin's log of tries shows with what each one was made,
-- as the list of recent sign-ins of a person already does. The same short label (browser and system, 80 characters at most);
-- tries from before this stay empty. Kept as long as the tries themselves, 180 days.
ALTER TABLE login_attempts ADD COLUMN device TEXT NOT NULL DEFAULT '';
