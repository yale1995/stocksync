import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

if (existsSync(".env")) {
	process.loadEnvFile(".env");
}

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/infra/schemas",
	out: "./src/infra/migrations",
	casing: "snake_case",
	dbCredentials: {
		url: process.env.DATABASE_URL,
	},
});
