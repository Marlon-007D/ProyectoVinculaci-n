export const MEDIA_BUCKET = 'media';
export const DOCUMENTS_BUCKET = 'documents';

/** Use with upload/download; private documents require signed URLs or download(). */
export function tenantObjectPath(institutionId: string, relativePath: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(institutionId)) {
    throw new Error('Identificador de institucion invalido.');
  }
  if (!relativePath || relativePath.includes('\\')
    || relativePath.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error('Ruta de archivo invalida.');
  }
  return `${institutionId.toLowerCase()}/${relativePath}`;
}
