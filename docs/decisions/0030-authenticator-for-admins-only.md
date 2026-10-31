# 0030 – Der Authenticator nur für Admins; jeder kann eine Kampagne leiten
Status: angenommen (Rob, 30.10.2026, Wunsch #168) · Datum: 2026-10-30 · ersetzt Teile von [0008](0008-invite-only-auth-totp.md), [0022](0022-hidden-npc-values-in-scenarios.md), [0027](0027-hidden-npc-warbands.md)

## Kontext
ADR 0008 machte den Zweiten Faktor (Authenticator-App, TOTP) für **Admin und Leiter** zur Pflicht, ein Leiter konnte also nur mit
Authenticator eine Kampagne anlegen und als Leiter handeln. ADR 0022 und 0027 bauten darauf: Die versteckten Werte der NPCs eines Szenarios
und die versteckten NPC-Warbands sehen nur „Leiter mit Authenticator“, der Hintergrund, die Entwürfe, die Pläne und anderes ebenso.
Im Betrieb ist das für eine Gruppe von Freunden zu viel: Wer eine Kampagne leiten will, soll es einfach können, mit allem, was dazugehört.

## Entscheidung (Rob, 30.10.2026)
- Der **Authenticator ist nur noch für Admins Pflicht** (und für alles, was die Website als Betreiber verwaltet: Nutzer, Einladungen,
  Meldungen, Sicherungen). Für alle anderen ist er freiwillig, wie bisher für Spieler.
- **Jeder kann eine Kampagne anlegen und leiten** – anlegen darf jedes Konto, wer anlegt, leitet. Ein Leiter hat alles, was zur Leitung gehört,
  **auch die versteckten Inhalte** (Hintergrund, versteckte Werte der NPCs, versteckte NPC-Warbands, Entwürfe, Pläne, Stilvorgaben,
  verschlossene Notizen der Leiter), mit oder ohne Authenticator.
- Die Sichtbarkeit bleibt serverseitig (ADR 0011): Spieler, Zuschauer und Außenstehende sehen davon weiterhin nichts. Geändert hat sich nur,
  wer als „Leiter“ zählt: jedes Mitglied mit der Rolle `leader`.

## Folgen
- `server/src/policy.ts`: `campaigns.create` ist `user` statt `totp`; ein Ziel „Leiter“ verlangt nur noch die Rolle. Der Admin mit Pflicht-Authenticator
  (`mustSetUpTotp`) bleibt.
- Die Kampagnenansicht trägt kein `canLead` mehr; die App fragt `user.totp` bei keiner Kampagnenfunktion mehr.
- Die Leak-Matrix und die Tests sind angepasst (`server/test/leaders-no-factor.test.ts`): ein Leiter ohne Authenticator liest und schreibt, ein
  Spieler und ein Zuschauer nicht.
- **Was damit verloren geht:** Ein gestohlenes Passwort eines Leiters reicht jetzt, um die versteckten Inhalte der Kampagne zu lesen. Das nimmt Rob
  in Kauf; wer den Schutz will, richtet den Authenticator freiwillig ein (Account → Authenticator). Eine spätere Option „Authenticator für
  die Leiter dieser Kampagne verlangen“ wäre möglich, ist aber nicht gebaut.
