const usd = new Intl.NumberFormat("en-US", {
	style: "currency",
	currency: "USD",
});

export function formatCents(cents: number) {
	return usd.format(cents / 100);
}

const dateTime = new Intl.DateTimeFormat("en-US", {
	dateStyle: "medium",
	timeStyle: "medium",
});

export function formatDateTime(iso: string) {
	return dateTime.format(new Date(iso));
}

const time = new Intl.DateTimeFormat("en-US", { timeStyle: "short" });

export function formatTime(iso: string) {
	return time.format(new Date(iso));
}

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const units = [
	{ unit: "day", seconds: 86_400 },
	{ unit: "hour", seconds: 3_600 },
	{ unit: "minute", seconds: 60 },
] as const;

export function formatRelative(iso: string, now = Date.now()) {
	const seconds = Math.trunc((Date.parse(iso) - now) / 1000);
	// Whole units, truncated: 90 minutes ago reads "1 hour ago".
	for (const { unit, seconds: size } of units) {
		if (Math.abs(seconds) >= size) {
			return relative.format(Math.trunc(seconds / size), unit);
		}
	}
	return relative.format(seconds, "second");
}
