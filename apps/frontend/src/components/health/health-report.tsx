import type { ReactNode } from "react";
import type { Health } from "@/api/types";
import { useNow } from "@/hooks/use-now";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

const EMPTY = "—";

const componentStatusLabels = { up: "Up", down: "Down" } as const;

export function HealthReport({ health }: { health: Health }) {
	const { server, database, sync } = health;

	return (
		<div className="flex flex-col gap-8">
			<Section id="health-server" title="Server">
				<Field label="Status">
					<ComponentStatus status={server.status} />
				</Field>
				<Field label="Version">{server.version}</Field>
				<Field label="Node.js">{server.nodeVersion}</Field>
				<Field label="Environment">{server.environment}</Field>
				<Field label="Provider">{server.provider}</Field>
			</Section>

			<Section id="health-database" title="Database">
				<Field label="Status">
					<ComponentStatus status={database.status} />
				</Field>
				<Field label="Version">{database.version ?? EMPTY}</Field>
				<Field label="Latency">
					{database.latencyMs === null ? EMPTY : `${database.latencyMs} ms`}
				</Field>
				<Field label="Connections">
					{database.openConnections === null || database.maxConnections === null
						? EMPTY
						: `${database.openConnections} of ${database.maxConnections}`}
				</Field>
			</Section>

			<Section id="health-sync" title="Sync queue">
				{sync ? (
					<SyncQueue sync={sync} />
				) : (
					<p className="px-5 py-4 text-sm text-muted-foreground">
						Unavailable while the database is down.
					</p>
				)}
			</Section>
		</div>
	);
}

function SyncQueue({ sync }: { sync: NonNullable<Health["sync"]> }) {
	const now = useNow(10_000);

	return (
		<>
			<Field label="Pending">{sync.pending}</Field>
			<Field
				label="Failed"
				valueClassName={cn(sync.failed > 0 && "text-destructive")}
			>
				{sync.failed}
			</Field>
			<Field label="Oldest pending">
				<Moment iso={sync.oldestPendingAt} now={now} fallback="None" />
			</Field>
			<Field label="Last successful sync">
				<Moment iso={sync.lastSuccessfulSyncAt} now={now} fallback="Never" />
			</Field>
		</>
	);
}

function Section({
	id,
	title,
	children,
}: {
	id: string;
	title: string;
	children: ReactNode;
}) {
	return (
		<section aria-labelledby={id} className="flex flex-col gap-3">
			<h2 id={id} className="text-base font-semibold tracking-tight">
				{title}
			</h2>
			<dl className="divide-y overflow-hidden rounded-lg border bg-card shadow-xs">
				{children}
			</dl>
		</section>
	);
}

function Field({
	label,
	valueClassName,
	children,
}: {
	label: string;
	valueClassName?: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3 text-sm">
			<dt className="text-muted-foreground">{label}</dt>
			<dd
				className={cn(
					"flex flex-wrap items-baseline gap-x-2 font-medium tabular-nums",
					valueClassName,
				)}
			>
				{children}
			</dd>
		</div>
	);
}

function ComponentStatus({ status }: { status: "up" | "down" }) {
	return (
		<span className={cn(status === "down" && "text-destructive-ink")}>
			{componentStatusLabels[status]}
		</span>
	);
}

function Moment({
	iso,
	now,
	fallback,
}: {
	iso: string | null;
	now: number;
	fallback: string;
}) {
	if (!iso) return fallback;
	return (
		<>
			<span>{formatRelative(iso, now)}</span>
			<time dateTime={iso} className="font-normal text-muted-foreground">
				{formatDateTime(iso)}
			</time>
		</>
	);
}
