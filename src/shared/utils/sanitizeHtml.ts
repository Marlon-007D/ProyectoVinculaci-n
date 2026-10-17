
import DOMPurify from 'dompurify'

const FORBIDDEN_CHARACTERS =
  /[<>"'`\u00ab\u00bb\u2018-\u201f\u2039\u203a\u2e42\u300c-\u300f\u301d-\u301f\ufe41-\ufe44\uff02\uff07]/gu

const INVISIBLE_CHARACTERS =
  /[\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/gu

const CONTROL_CHARACTERS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu

export function sanitizeHtml(
  html: string,
  maxLength = 500
): string {
  if (typeof html !== 'string') {
    return ''
  }

  const safeMaxLength = Math.max(
    0,
    Math.min(
      Number.isFinite(maxLength) ? Math.trunc(maxLength) : 500,
      10000
    )
  )

  const normalized = html.normalize('NFKC')

  const sanitized = DOMPurify.sanitize(normalized, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    ALLOW_DATA_ATTR: false,
    RETURN_TRUSTED_TYPE: false,
  })

  const text = new DOMParser()
    .parseFromString(sanitized, 'text/html')
    .body.textContent ?? ''

  return Array.from(
    text
      .normalize('NFKC')
      .replace(FORBIDDEN_CHARACTERS, '')
      .replace(INVISIBLE_CHARACTERS, '')
      .replace(CONTROL_CHARACTERS, '')
      .replace(/\s+/gu, ' ')
      .trim()
  )
    .slice(0, safeMaxLength)
    .join('')
}
