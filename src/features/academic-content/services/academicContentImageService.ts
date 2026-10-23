import type { SupabaseClient } from '@supabase/supabase-js'

const acceptedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])
const maxImageSize = 5 * 1024 * 1024

export interface AcademicContentImageUploader {
  upload(input: { institutionId: string; publicationId: string; file: File }): Promise<string>
}

export function createAcademicContentImageUploader(client: SupabaseClient): AcademicContentImageUploader {
  return {
    async upload({ institutionId, publicationId, file }) {
      if (!acceptedImageTypes.has(file.type) || file.size > maxImageSize) {
        throw new Error('La foto debe ser PNG, JPG o WebP y pesar máximo 5 MB.')
      }
      const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const path = `${institutionId}/news/${publicationId}/${crypto.randomUUID()}.${extension}`
      const { error } = await client.storage.from('media').upload(path, file, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      })
      if (error) throw new Error('No se pudo subir la foto. Verifica tus permisos e inténtalo de nuevo.')
      return client.storage.from('media').getPublicUrl(path).data.publicUrl
    },
  }
}
