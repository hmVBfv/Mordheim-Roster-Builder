/* A picture made ready to send (phase 4a3, part 2; docs/security.md
   "Uploads"): read by the browser, drawn anew at most 1600 pixels on its
   long side and encoded anew – WebP where the browser can, else JPEG. What
   leaves the device is only the pixels: EXIF data, GPS coordinates and
   whatever else the file carried stay behind. */

export const MAX_SIDE = 1600;
/** The server takes at most 5 MB; well below that is the aim. */
export const MAX_BYTES = 5 * 1024 * 1024;

export interface Shrunk { bytes: ArrayBuffer; mime: 'image/webp' | 'image/jpeg'; width: number; height: number }

const encode = (c: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob | null>((resolve) => c.toBlob(resolve, type, quality));

export async function shrink(file: Blob): Promise<Shrunk> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  let side = MAX_SIDE;
  for (const quality of [0.85, 0.7, 0.55]) {
    const scale = Math.min(1, side / Math.max(bmp.width, bmp.height));
    const width = Math.max(1, Math.round(bmp.width * scale));
    const height = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, width, height);
    let blob = await encode(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await encode(canvas, 'image/jpeg', quality);
    if (!blob) throw new Error('This picture cannot be read here.');
    if (blob.size <= MAX_BYTES) return { bytes: await blob.arrayBuffer(), mime: blob.type as Shrunk['mime'], width, height };
    side = Math.round(side * 0.75);
  }
  throw new Error('This picture is too large, even made smaller.');
}
