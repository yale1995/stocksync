import { z } from "zod";

const envSchema = z.object({
	PORT: z.string().transform(Number).pipe(z.number().int().positive()),
	DATABASE_URL: z.url(),
	JWT_SECRET: z.string().min(32),
	CORS_ORIGIN: z.url(),
	NODE_ENV: z
		.enum(["development", "test", "production"])
		.default("development"),
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
