import { createMiddleware } from "hono/factory";

export const responseFormatter = createMiddleware(async (c, next) => {
  const originalJson = c.json as any;

  (c as any).json = (data: any, status?: any, headers?: any) => {
    // If it's already formatted (like from the error handler), leave it alone
    if (data && typeof data === "object" && "success" in data) {
      return originalJson.call(c, data, status, headers);
    }

    // Ignore OpenAPI routes and documentation to prevent breaking them
    const path = c.req.path;
    if (path.includes("/openapi") || path.includes("/doc") || path.includes("/reference") || path.includes("/ui/queues")) {
      return originalJson.call(c, data, status, headers);
    }

    let message = "Request successful";
    let responseData = data;

    // If data is an object with a message property, extract it to the top level
    if (data && typeof data === "object" && !Array.isArray(data)) {
      if (data.message) {
        message = data.message;
        const { message: _, ...rest } = data;
        responseData = Object.keys(rest).length > 0 ? rest : null;
      }
    }

    // Standardized response format
    const formattedResponse = {
      success: true,
      message,
      data: responseData ?? null,
    };

    return originalJson.call(c, formattedResponse, status, headers);
  };

  await next();
});
