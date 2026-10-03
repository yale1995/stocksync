import { z } from "zod";

const envSchema = z.object({
	PORT: z.string().transform(Number).pipe(z.number().int().positive()),
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
