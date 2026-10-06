import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { CircleAlert, Clock } from "lucide-react";
import { type FormEvent, useState } from "react";
import { z } from "zod";
import { type Credentials, login, meQuery } from "@/api/auth";
import { BrandMark } from "@/components/brand-mark";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSearchSchema = z.object({
	redirect: z.string().optional().catch(undefined),
	reason: z.literal("expired").optional().catch(undefined),
});

export const Route = createFileRoute("/login")({
	validateSearch: loginSearchSchema,
	beforeLoad: async ({ context }) => {
		const user = await context.queryClient
			.ensureQueryData(meQuery)
			.catch(() => undefined);
		if (user) throw redirect({ to: "/products" });
	},
	component: LoginPage,
});

type FieldErrors = Partial<Record<keyof Credentials, string>>;

function validate({ email, password }: Credentials): FieldErrors {
	const errors: FieldErrors = {};
	if (!email) errors.email = "Enter your email";
	else if (!/^[^\s@]+@[^\s@]+$/.test(email)) {
		errors.email = "Enter a valid email address";
	}
	if (!password) errors.password = "Enter your password";
	return errors;
}

// Only same-origin paths: "//host" and absolute URLs would leave the app.
function internalPath(target: string | undefined) {
	return target?.startsWith("/") && !target.startsWith("//")
		? target
		: "/products";
}

function LoginPage() {
	const search = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

	const mutation = useMutation({
		mutationFn: login,
		onSuccess: (user) => {
			queryClient.setQueryData(meQuery.queryKey, user);
			void navigate({ href: internalPath(search.redirect) });
		},
	});

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const credentials = {
			email: String(form.get("email") ?? "").trim(),
			password: String(form.get("password") ?? ""),
		};
		const errors = validate(credentials);
		setFieldErrors(errors);
		if (Object.keys(errors).length > 0) return;
		mutation.mutate(credentials);
	}

	return (
		<main className="grid min-h-svh place-items-center px-4 py-12">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<div className="flex items-center gap-2.5 self-center">
					<BrandMark />
					<span className="text-base font-semibold tracking-tight">
						StockSync
					</span>
				</div>

				<Card className="shadow-sm">
					<CardHeader>
						<CardTitle>
							<h1
								className="text-xl font-semibold tracking-tight"
								tabIndex={-1}
							>
								Log in
							</h1>
						</CardTitle>
						<CardDescription>
							Use the account your store admin gave you.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							noValidate
							onSubmit={handleSubmit}
							className="flex flex-col gap-5"
						>
							{search.reason === "expired" && !mutation.error && (
								<Alert>
									<Clock />
									<AlertTitle>Session expired</AlertTitle>
									<AlertDescription>
										Your session has expired. Please log in again.
									</AlertDescription>
								</Alert>
							)}
							{mutation.error && (
								<Alert variant="destructive">
									<CircleAlert />
									<AlertTitle>Could not log in</AlertTitle>
									<AlertDescription>{mutation.error.message}</AlertDescription>
								</Alert>
							)}

							<Field
								name="email"
								label="Email"
								type="email"
								autoComplete="username"
								error={fieldErrors.email}
							/>
							<Field
								name="password"
								label="Password"
								type="password"
								autoComplete="current-password"
								error={fieldErrors.password}
							/>

							<Button
								type="submit"
								className="w-full"
								disabled={mutation.isPending}
							>
								{mutation.isPending ? "Logging in…" : "Log in"}
							</Button>
						</form>
					</CardContent>
				</Card>
			</div>
		</main>
	);
}

interface FieldProps {
	name: keyof Credentials;
	label: string;
	type: "email" | "password";
	autoComplete: string;
	error: string | undefined;
}

function Field({ name, label, type, autoComplete, error }: FieldProps) {
	const errorId = `${name}-error`;
	return (
		<div className="flex flex-col gap-2">
			<Label htmlFor={name}>{label}</Label>
			<Input
				id={name}
				name={name}
				type={type}
				autoComplete={autoComplete}
				aria-invalid={error ? true : undefined}
				aria-describedby={error ? errorId : undefined}
			/>
			{error && (
				<p id={errorId} className="text-sm text-destructive">
					{error}
				</p>
			)}
		</div>
	);
}
