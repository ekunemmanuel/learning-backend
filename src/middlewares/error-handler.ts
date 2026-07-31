import type { Hook } from "@hono/zod-openapi";
import type { ErrorHandler } from "hono";

import { HTTPException } from "hono/http-exception";
import * as HttpStatusCodes from "stoker/http-status-codes";
import * as HttpStatusPhrases from "stoker/http-status-phrases";

import { AppError } from "@/lib/errors";

export const errorHandler: ErrorHandler = (err, c) => {
  // Always log the full error with stack trace for backend observability
  const logger = c.get("logger") || console;
  logger.error(err);

  if (err instanceof AppError) {
    return c.json(
      {
        message: err.message,
        success: false,
      },
      err.statusCode,
    );
  }

  if (err.name === "PrismaClientKnownRequestError") {
    const prismaError = err as any;
    switch (prismaError.code) {
      case "P2025": // Record not found
        return c.json(
          {
            message: HttpStatusPhrases.NOT_FOUND,
            success: false,
          },
          HttpStatusCodes.NOT_FOUND,
        );
      case "P2002": { // Unique constraint failed
        const target = prismaError.meta?.target ? (prismaError.meta.target as string[]).join(", ") : "field";
        return c.json(
          {
            message: `A record with this ${target} already exists`,
            success: false,
          },
          HttpStatusCodes.CONFLICT,
        );
      }
      case "P2003": // Foreign key constraint failed
        return c.json(
          {
            message: "The referenced record does not exist or is still in use",
            success: false,
          },
          HttpStatusCodes.UNPROCESSABLE_ENTITY,
        );
      case "P2014": // Relation violation
        return c.json(
          {
            message: "This action would violate a required relationship between records",
            success: false,
          },
          HttpStatusCodes.CONFLICT,
        );
      // Other Prisma errors will fall through to the 500 handler
    }
  }

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.json(
    {
      message: HttpStatusPhrases.INTERNAL_SERVER_ERROR,
      success: false,
    },
    HttpStatusCodes.INTERNAL_SERVER_ERROR,
  );
};

export const validationHook: Hook<any, any, any, any> = (result, c) => {
  if (!result.success) {
    return c.json(
      {
        message: "Validation Error",
        success: false,
        errors: result.error.issues.map(issue => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      },
      HttpStatusCodes.UNPROCESSABLE_ENTITY,
    );
  }
};
