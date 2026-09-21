import { z } from "zod";

export const appEnvironmentSchema = z.enum(["development", "preview", "production"]);

export const serverEnvironmentSchema = z.object({
  APP_ENV: appEnvironmentSchema.default("development"),
  DATABASE_URL: z.string().min(1).optional(),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional().or(z.literal("")),
});

export const publicEnvironmentSchema = z.object({
  NEXT_PUBLIC_APP_ENV: appEnvironmentSchema.default("development"),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional().or(z.literal("")),
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;
export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function parseServerEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): ServerEnvironment {
  return serverEnvironmentSchema.parse(source);
}

export function parsePublicEnvironment(
  source: Record<string, string | undefined> = {
    NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
): PublicEnvironment {
  return publicEnvironmentSchema.parse(source);
}
