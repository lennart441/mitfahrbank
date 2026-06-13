export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: "unauthorized" | "network" | "server",
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiError(err: unknown, code?: ApiError["code"]): err is ApiError {
  return err instanceof ApiError && (code == null || err.code === code);
}
