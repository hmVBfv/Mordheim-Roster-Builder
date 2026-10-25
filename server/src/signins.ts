/* Where and with what a person signed in (wish #69): the last few sign-ins and the first time of each device. See migration 36.
   Read by the admin only (policy: admin.signins.read); nothing of it reaches a user's own screens. */
import type { DB } from './db.ts';

/** How many sign-ins are kept for each person; older ones are deleted as new ones come. */
export const KEEP_SIGNINS = 20;

export interface SignIn { at: string; kind: 'signin' | 'moved'; device: string; place: string; ip: string; firstTime: boolean }
export interface KnownDevice { device: string; firstAt: string; firstIp: string; firstPlace: string }

/** Notes a sign-in that is complete (password, and the code where there is one). Whether it is the first time this device was seen. */
export function recordSignIn(db: DB, s: { userId: string; device: string; ip: string; place: string }, now: Date): boolean {
  const at = now.toISOString();
  return db.transaction(() => {
    const known = db.prepare('SELECT 1 FROM known_devices WHERE user_id = ? AND device = ?').get(s.userId, s.device);
    if (!known) db.prepare('INSERT INTO known_devices (user_id, device, first_at, first_ip, first_place) VALUES (?, ?, ?, ?, ?)').run(s.userId, s.device, at, s.ip, s.place);
    db.prepare("INSERT INTO signins (user_id, at, kind, device, ip, place, first_time) VALUES (?, ?, 'signin', ?, ?, ?, ?)").run(s.userId, at, s.device, s.ip, s.place, known ? 0 : 1);
    prune(db, s.userId, 'signin');
    return !known;
  })();
}

const prune = (db: DB, userId: string, kind: 'signin' | 'moved') =>
  db.prepare('DELETE FROM signins WHERE user_id = ? AND kind = ? AND id NOT IN (SELECT id FROM signins WHERE user_id = ? AND kind = ? ORDER BY id DESC LIMIT ?)').run(userId, kind, userId, kind, KEEP_SIGNINS);

/** A running session is used from another place (or, where no place is known, another address) than it had: noted as a move, and
    as such it is no sign-in and no first time. Whether it was noted. */
export function recordMove(db: DB, s: { userId: string; device: string; ip: string; place: string; prevIp: string; prevPlace: string }, now: Date): boolean {
  const moved = s.place || s.prevPlace ? s.place !== s.prevPlace : s.ip !== s.prevIp;
  if (!moved) return false;
  db.transaction(() => {
    db.prepare("INSERT INTO signins (user_id, at, kind, device, ip, place, first_time) VALUES (?, ?, 'moved', ?, ?, ?, 0)").run(s.userId, now.toISOString(), s.device, s.ip, s.place);
    prune(db, s.userId, 'moved');
  })();
  return true;
}

/** The kept sign-ins, newest first, and the devices by when they were first seen. */
export function listSignIns(db: DB, userId: string): { signins: SignIn[]; devices: KnownDevice[] } {
  const signins = (db.prepare('SELECT * FROM signins WHERE user_id = ? ORDER BY id DESC').all(userId) as { at: string; kind: 'signin' | 'moved'; device: string; ip: string; place: string; first_time: number }[])
    .map((r) => ({ at: r.at, kind: r.kind, device: r.device, place: r.place, ip: r.ip, firstTime: r.first_time === 1 }));
  const devices = (db.prepare('SELECT * FROM known_devices WHERE user_id = ? ORDER BY first_at, device').all(userId) as { device: string; first_at: string; first_ip: string; first_place: string }[])
    .map((r) => ({ device: r.device, firstAt: r.first_at, firstIp: r.first_ip, firstPlace: r.first_place }));
  return { signins, devices };
}
