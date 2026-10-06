import { z } from "zod";

export const envSchema = z.object({
	PORT: z.string().transform(Number).pipe(z.number().int().positive()),
	DATABASE_URL: z.url(),
	JWT_SECRET: z.string().min(32),
	CORS_ORIGIN: z.url(),
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
		.default("info"),
	ADS_API_URL: z.url(),
	ADS_API_KEY: z.string().min(1),
	SYNC_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(50),
	SYNC_RATE_LIMIT_PER_SECOND: z.coerce.number().int().positive().default(5),
	SYNC_REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
	SYNC_MAX_ATTEMPTS: z.coerce.number().int().positive().default(5),
	SYNC_BACKOFF_BASE_MS: z.coerce.number().int().positive().default(1000),
	SYNC_BACKOFF_MAX_MS: z.coerce.number().int().positive().default(60000),
	SYNC_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
});

export type Env = z.infer<typeof envSchema>;

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	console.error(
		`Invalid environment variables:\n${z.prettifyError(parsedEnv.error)}`,
	);

	process.exit(1);
}

export const env: Env = parsedEnv.data;
