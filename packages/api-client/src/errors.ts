export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    message: string,
    readonly status: number,
    readonly endpoint: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}
