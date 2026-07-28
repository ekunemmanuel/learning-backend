import { z } from "@hono/zod-openapi";

export const listExamplesSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  done: z.boolean(),
  createdAt: z.union([z.string(), z.date()]).transform((val) => new Date(val).toISOString()),
  updatedAt: z.union([z.string(), z.date()]).transform((val) => new Date(val).toISOString()),
});

export const createExamplesSchema = z.object({
  name: z.string().min(1).max(500),
  done: z.boolean(),
});

export const updateExamplesSchema = createExamplesSchema.partial();

// types
export type ListExamples = z.infer<typeof listExamplesSchema>;
export type CreateExamples = z.infer<typeof createExamplesSchema>;
export type UpdateExamples = z.infer<typeof updateExamplesSchema>;
