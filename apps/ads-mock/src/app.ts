import { setTimeout as sleep } from "node:timers/promises";
import express, {
	type ErrorRequestHandler,
	type Express,
	type RequestHandler,
} from "express";
import { z } from "zod";
import { createRateLimiter } from "./rate-limiter.js";

export type AppOptions = {
	apiKey: string;
	failureRate: number;
	rateLimitPerSecond: number;
	timeoutDelayMs: number;
	random?: () => number;
	now?: () => number;
};

type Ad = {
	sku: string;
	stock: number;
	priceCents: number;
	version: number;
	updatedAt: string;
};

const updatesSchema = z.object({
	tenantId: z.uuid(),
	items: z
		.array(
			z.object({
				sku: z.string().min(1),
				stock: z.number().int().min(0),
				priceCents: z.number().int().min(0),
				version: z.number().int().positive(),
			}),
		)
		.min(1)
		.max(100),
});

type Updates = z.infer<typeof updatesSchema>;

const adsQuerySchema = z.object({ tenantId: z.uuid() });

type FailureMode = "error" | "timeout" | "apply-then-error";

const FAILURE_MODES: FailureMode[] = ["error", "timeout", "apply-then-error"];

export function createApp({
	apiKey,
	failureRate,
	rateLimitPerSecond,
	timeoutDelayMs,
	random = Math.random,
	now = Date.now,
}: AppOptions): Express {
	const adsByTenant = new Map<string, Map<string, Ad>>();
	const takeRateLimitToken = createRateLimiter(rateLimitPerSecond, now);

	function apply({ tenantId, items }: Updates) {
		let ads = adsByTenant.get(tenantId);
		if (!ads) {
			ads = new Map();
			adsByTenant.set(tenantId, ads);
		}
		let applied = 0;
		for (const item of items) {
			const current = ads.get(item.sku);
			if (current && item.version <= current.version) continue;
			ads.set(item.sku, {
				...item,
				updatedAt: new Date(now()).toISOString(),
			});
			applied++;
		}
		return { applied, ignored: items.length - applied };
	}

	function pickFailure(): FailureMode | undefined {
		if (random() >= failureRate) return undefined;
		const index = Math.min(
			Math.floor(random() * FAILURE_MODES.length),
			FAILURE_MODES.length - 1,
		);
		return FAILURE_MODES[index];
	}

	const requireApiKey: RequestHandler = (req, res, next) => {
		if (req.get("X-Api-Key") !== apiKey) {
			res.status(401).json({ error: "Invalid API key" });
			return;
		}
		next();
	};

	const rateLimit: RequestHandler = (_req, res, next) => {
		const result = takeRateLimitToken();
		if (!result.allowed) {
			res
				.status(429)
				.set("Retry-After", String(result.retryAfterSeconds))
				.json({ error: "Too many requests" });
			return;
		}
		next();
	};

	const app = express();
	app.use(requireApiKey);
	app.use(express.json());

	app.post("/updates", rateLimit, async (req, res) => {
		const result = updatesSchema.safeParse(req.body);
		if (!result.success) {
			res.status(400).json({ error: z.prettifyError(result.error) });
			return;
		}

		const failure = pickFailure();
		if (failure === "error") {
			res.status(500).json({ error: "Internal error" });
			return;
		}
		if (failure === "timeout") {
			await sleep(timeoutDelayMs);
			res.status(500).json({ error: "Upstream timeout" });
			return;
		}
		// Applied, but the caller sees a failure and retries: this is how the
		// same update reaches the service twice.
		const outcome = apply(result.data);
		if (failure === "apply-then-error") {
			res.status(500).json({ error: "Internal error" });
			return;
		}
		res.json(outcome);
	});

	app.get("/ads", (req, res) => {
		const result = adsQuerySchema.safeParse(req.query);
		if (!result.success) {
			res.status(400).json({ error: z.prettifyError(result.error) });
			return;
		}
		const ads = [...(adsByTenant.get(result.data.tenantId)?.values() ?? [])];
		res.json({
			ads: ads.toSorted((a, b) => (a.sku < b.sku ? -1 : 1)),
		});
	});

	const invalidJson: ErrorRequestHandler = (err, _req, res, next) => {
		if (err?.type === "entity.parse.failed") {
			res.status(400).json({ error: "Invalid JSON body" });
			return;
		}
		next(err);
	};
	app.use(invalidJson);

	return app;
}
