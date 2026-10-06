import { env } from "@/env";

export function apiUrl(path: string) {
	return `${env.VITE_API_URL}${path}`;
}
