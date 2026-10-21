import {supabase} from '../../core/supabaseClient';
import {validateImageHeader} from './assetValidation';

export async function uploadPortalImage(institutionId: string, file: File): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(institutionId)) throw new Error('Selecciona una institución válida.');
  const extension = validateImageHeader(file.type, file.size, new Uint8Array(await file.slice(0, 12).arrayBuffer()));
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('No se pudo abrir la imagen. Exporta una copia PNG o JPG y vuelve a intentarlo.'); }
  const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 6000 && bitmap.height <= 6000;
  bitmap.close();
  if (!valid) throw new Error('La imagen debe medir como máximo 6000 × 6000 píxeles.');
  const path = `${institutionId}/${crypto.randomUUID()}.${extension}`;
  const {error} = await supabase.storage.from('portal-assets').upload(path, file, {contentType: file.type, cacheControl: '3600', upsert: false});
  if (error) throw new Error('No se pudo subir la imagen. Comprueba tu conexión y el permiso de carga de la institución.');
  return supabase.storage.from('portal-assets').getPublicUrl(path).data.publicUrl;
}
