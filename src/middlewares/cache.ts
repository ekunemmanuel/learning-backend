import { LRUCache } from "lru-cache";
import type { Context, Next } from "hono";

// A simple in-memory cache for GET requests
const routeCache = new LRUCache<string, any>({
  max: 500, // Maximum number of items
  ttl: 1000 * 60 * 5, // 5 minutes time to live
});

export const cacheMiddleware = (options?: { ttl?: number }) => {
  return async (c: Context, next: Next) => {
    // We only cache GET requests
    if (c.req.method !== "GET") {
      await next();
      return;
    }

    const key = c.req.url;

    // Check if we have a cached response
    const cachedResponse = routeCache.get(key);
    if (cachedResponse) {
      c.header("X-Cache", "HIT");
      return c.json(cachedResponse);
    }

    await next();

    // After the handler runs, if it was successful, we cache the result.
    if (c.res.status === 200) {
      // Clone the response so we can read its body without consuming the original
      const clonedRes = c.res.clone();
      
      try {
        const body = await clonedRes.json();
        const ttl = options?.ttl || 1000 * 60 * 5;
        routeCache.set(key, body, { ttl });
        c.header("X-Cache", "MISS");
      } catch (err) {
        // Not JSON or unable to parse, do not cache
      }
    }
  };
};
