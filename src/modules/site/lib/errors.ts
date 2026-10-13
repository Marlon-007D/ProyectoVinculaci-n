export class ServiceError extends Error {
  readonly code?: string;
  constructor(message: string, code?: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export function toServiceError(err: unknown, userMessage: string): ServiceError {
  const code =
    typeof err === "object" && err !== null && "code" in err
      ? String((err as { code: unknown }).code)
      : undefined;
  return new ServiceError(userMessage, code, { cause: err });
}
