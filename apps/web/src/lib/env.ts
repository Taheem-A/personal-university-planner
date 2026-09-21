import { z } from "zod";

const appEnvironmentSchema = z.enum(["development", "preview", "production", "test"]);

const deploymentSecretsSchema = z.object({
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
});

export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

function inferAppEnvironment(source: NodeJS.ProcessEnv): AppEnvironment {
  const candidate =
    source.APP_ENV ?? source.VERCEL_ENV ?? (source.NODE_ENV === "test" ? "test" : "development");
  return appEnvironmentSchema.parse(candidate);
}

export function readEnvironment(source: NodeJS.ProcessEnv = process.env) {
  const appEnvironment = inferAppEnvironment(source);
  const publicEnvironment = appEnvironmentSchema.parse(
    source.NEXT_PUBLIC_APP_ENV ?? appEnvironment,
  );

  if (publicEnvironment !== appEnvironment) {
    throw new Error("APP_ENV and NEXT_PUBLIC_APP_ENV must describe the same deployment boundary.");
  }

  if (appEnvironment === "preview" || appEnvironment === "production") {
    deploymentSecretsSchema.parse(source);
  }

  return {
    appEnvironment,
    publicEnvironment,
    appUrl: z
      .string()
      .url()
      .parse(source.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
    sentryEnabled: Boolean(source.SENTRY_DSN || source.NEXT_PUBLIC_SENTRY_DSN),
  } as const;
}
