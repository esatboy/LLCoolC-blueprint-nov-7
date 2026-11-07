export const MAX_PHOTO = 1600;
export const MAX_THUMB = 480;

export function canvasToBlob(c: HTMLCanvasElement, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not encode image'))), 'image/jpeg', quality),
  );
}

function scaled(source: CanvasImageSource, w: number, h: number, max: number): HTMLCanvasElement {
  const k = Math.min(1, max / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d')!.drawImage(source, 0, 0, c.width, c.height);
  return c;
}

/** Downscale a decoded image into the stored photo (<=1600px) and a grid thumbnail (<=480px). */
export async function makeVariants(source: CanvasImageSource, w: number, h: number): Promise<{ blob: Blob; thumb: Blob }> {
  const [blob, thumb] = await Promise.all([
    canvasToBlob(scaled(source, w, h, MAX_PHOTO), 0.85),
    canvasToBlob(scaled(source, w, h, MAX_THUMB), 0.8),
  ]);
  return { blob, thumb };
}

/** From a camera/gallery file. Respects EXIF orientation so phone photos aren't sideways. */
export async function fileToVariants(file: Blob): Promise<{ blob: Blob; thumb: Blob }> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    return await makeVariants(bmp, bmp.width, bmp.height);
  } finally {
    bmp.close();
  }
}

export async function blobToImage(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}
