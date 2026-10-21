export const MAX_PORTAL_IMAGE_BYTES = 5 * 1024 * 1024;
export const PORTAL_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

/** Reject mislabeled files before decoding or sending them to public storage. */
export function validateImageHeader(type: string, size: number, bytes: Uint8Array): string {
  if (!PORTAL_IMAGE_TYPES.includes(type) || size <= 0 || size > MAX_PORTAL_IMAGE_BYTES)
    throw new Error('Selecciona una imagen PNG, JPG o WebP de hasta 5 MB.');
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value);
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if ((type === 'image/png' && png) || (type === 'image/jpeg' && jpeg) || (type === 'image/webp' && webp))
    return type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
  throw new Error('El contenido del archivo no corresponde a una imagen admitida.');
}
