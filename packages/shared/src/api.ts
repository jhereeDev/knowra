import { z } from 'zod';

export const healthResponseSchema = z.object({
  ok: z.literal(true),
  service: z.literal('knowra-web'),
  version: z.string(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
