export class ServiceError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

function hintFor(code: string | undefined, text: string): string | undefined {
  const t = text.toLowerCase();
  if (code === "PGRST205" || code === "42P01" || t.includes("could not find the table") || t.includes("does not exist"))
    return "Las tablas no existen en tu Supabase: ejecuta database/script.sql (y luego superadmin.sql) en el SQL Editor de Supabase.";
  if (code === "42501" || t.includes("permission denied"))
    return "El rol anon no tiene permiso de lectura: ejecuta database/script.sql (y luego superadmin.sql) en el SQL Editor de Supabase.";
  if (code === "42703" || t.includes("column"))
    return "Falta una columna en la tabla: ejecuta database/script.sql (y luego superadmin.sql) en el SQL Editor de Supabase.";
  if (t.includes("failed to fetch") || t.includes("networkerror") || t.includes("load failed"))
    return "No hay conexión con Supabase: revisa VITE_SUPABASE_URL, tu internet y que el proyecto no esté pausado (dashboard de Supabase → Restore).";
  if (code === "PGRST301" || t.includes("jwt") || t.includes("api key") || t.includes("apikey"))
    return "La clave VITE_SUPABASE_ANON_KEY es incorrecta o está incompleta.";
  return undefined;
}

export function toServiceError(err: unknown, userMessage: string): ServiceError {
  const code =
    typeof err === "object" && err !== null && "code" in err && (err as { code: unknown }).code
      ? String((err as { code: unknown }).code)
      : undefined;
  const raw =
    typeof err === "object" && err !== null && "message" in err
      ? String((err as { message: unknown }).message)
      : err
        ? String(err)
        : "";
  if (err) console.error(`[portal] ${userMessage}`, err);
  const hint = hintFor(code, raw);
  const detail = [code ? `[${code}]` : "", raw].filter(Boolean).join(" ");
  const message = [userMessage, detail && `Detalle: ${detail}`, hint].filter(Boolean).join(" ");
  return new ServiceError(message, code, { cause: err });
}
