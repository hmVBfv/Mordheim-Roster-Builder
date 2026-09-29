# 0007 – SQLite und Backups
Status: angenommen · Datum: 2026-09-27

## Kontext
Wenige Nutzer, kleine Datenmengen, ein Pi mit SSD. Datenverlust wäre für das
Epos schmerzhaft, echte Hochverfügbarkeit für eine Spielgruppe übertrieben.

## Entscheidung
- SQLite im WAL-Modus auf der SSD.
- Backups mit restic (verschlüsselt): nächtlich, vor jedem Deploy, nach jeder
  abgeschlossenen Schlacht. Ziel ist das restic-Repo auf der SSD; eine Kopie
  geht über den bestehenden `rsync`-Job auf den Desktop.
- **Keine Kopie außer Haus** (Entscheidung Rob).
- Nächtlicher automatischer Wiederherstellungstest über die Testinstanz.
- Keine zweite Instanz; stattdessen Offline-App, Server-Epoche, Notbetrieb
  auf dem Desktop (amd64-Image), SD-Klon.

## Folgen
- Gegen Brand, Diebstahl oder gleichzeitigen Ausfall von Pi und Desktop gibt
  es keinen Schutz. Bewusst in Kauf genommen.
- Ohne laufenden Desktop liegt nur eine Kopie auf der SSD.

## Verworfen
- PostgreSQL: mehr Last und Pflege ohne Nutzen bei dieser Größe.
- Storage Box oder Cloud-Ziel: nicht gewollt.
- Litestream (laufende Replikation): unnötig, weil die Geräte neuere Einträge
  nach einer Wiederherstellung nachliefern.
