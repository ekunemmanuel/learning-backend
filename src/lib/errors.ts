import type { ContentfulStatusCode } from "hono/utils/http-status";

export class AppError extends Error {
  public statusCode: ContentfulStatusCode;

  constructor(statusCode: ContentfulStatusCode, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}
