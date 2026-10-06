import { z } from "zod";

const envSchema = z.object({
	PORT: z.coerce.number().int().positive().default(4000),
	API_KEY: z.string().min(1),
	FAILURE_RATE: z.coerce.number().min(0).max(1).default(0.2),
	RATE_LIMIT_PER_SECOND: z.coerce.number().int().positive().default(5),
	TIMEOUT_DELAY_MS: z.coerce.number().int().min(0).default(5000),
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
	LOG_LEVEL: z
		.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
		.default("info"),
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
