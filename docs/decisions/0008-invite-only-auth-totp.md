# 0008 – Anmeldung nur auf Einladung, TOTP
Status: angenommen · Datum: 2026-09-27

## Kontext
Der Server ist aus dem Internet erreichbar. Nutzer sind eine kleine
Spielgruppe; E-Mail-Versand gibt es nicht. Leiter und Admin sehen mehr als
Spieler.

## Entscheidung
- Konten nur über einmalige Einladungslinks; keine offene Registrierung.
- Benutzername und Passwort (scrypt oder argon2id), Sitzungs-Cookie
  (`HttpOnly`, `Secure`, `SameSite=Lax`), 90 Tage, pro Gerät widerrufbar.
- **Authenticator-App (TOTP)** ist Pflicht für Admin und Leiter, optional für
  Spieler; Wiederherstellungscodes beim Einrichten.
- Passwort vergessen: Reset-Link vom Admin.
- Bremse für Login-Versuche und Fail2Ban-Regel.

## Folgen
- Für den Admin selbst gibt es einen Notweg über `roster-cli` auf dem Pi.

## Verworfen
- Passkeys als zweiter Faktor: bequemer auf Android, aber Rob bevorzugt den
  Authenticator. Kann später ergänzt werden.
- Login über GitHub/Google: Mitspieler bräuchten passende Konten; externe
  Abhängigkeit.
