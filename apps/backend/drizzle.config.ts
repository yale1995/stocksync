import { defineConfig } from "drizzle-kit";
import { env } from "./src/infra/env.js";

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/infra/schemas",
	out: "./src/infra/migrations",
	casing: "snake_case",
	dbCredentials: { url: env.DATABASE_URL },
});
