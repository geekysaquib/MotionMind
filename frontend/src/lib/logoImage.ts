/** A square picture of at most 512 px (centre-cropped), as a PNG: small enough to embed in every reel. */
export const LOGO_SIZE = 512;
export const MAX_LOGO_FILE_BYTES = 8 * 1024 * 1024;

async function resize(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const out = Math.min(LOGO_SIZE, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no canvas');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no blob'))), 'image/png'));
}

let prepare: (file: Blob) => Promise<Blob> = resize;
export const prepareLogo = (file: Blob) => prepare(file);
/** Tests replace the browser's image code with a stand-in. */
export function setLogoPreparer(fn: ((file: Blob) => Promise<Blob>) | null) {
  prepare = fn ?? resize;
}
