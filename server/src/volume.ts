/* The marker file on the SSD (docs/operations.md, "SSD-Übung"). If the SSD is
   not mounted after a reboot, /mnt/ssd/roster/data is an empty directory on
   the SD card; a server that started there would create an empty database
   and players would see their campaign gone. So nothing opens the database
   unless <DATA_DIR>/.roster-volume exists – the server and roster-cli alike. */
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MARKER = '.roster-volume';

export class VolumeError extends Error {
  override name = 'VolumeError';
}

export function assertVolume(dataDir: string): void {
  const marker = join(dataDir, MARKER);
  if (!existsSync(marker) || !statSync(marker).isFile()) {
    throw new VolumeError(
      `${marker} is missing: the data volume is not mounted (or not prepared). ` +
        'Refusing to start, so no empty database is created in its place. See docs/operations.md, SSD.',
    );
  }
}
