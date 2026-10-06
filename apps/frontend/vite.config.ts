import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		// Must run before the React plugin so it sees the generated route code.
		tanstackRouter({
			target: "react",
			autoCodeSplitting: true,
			// Route tests live next to their routes.
			routeFileIgnorePattern: "\\.test\\.tsx?$",
		}),
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
	},
	test: {
		environment: "jsdom",
		include: ["src/**/*.test.{ts,tsx}"],
		setupFiles: ["src/test/setup.ts"],
		// jsdom enforces CORS on MSW's mocked responses too. CORS is the API's
		// job (covered in the backend's app.test.ts), so the tests serve the app
		// from the API's origin.
		environmentOptions: { jsdom: { url: "http://localhost:3333" } },
		// Dates render in the browser's time zone; tests pin one.
		env: { TZ: "UTC", VITE_API_URL: "http://localhost:3333/api/v1" },
	},
});
