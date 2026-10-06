import { screen, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { currentUser } from "@/test/fixtures";
import { emptyProducts, signedIn, signedOut } from "@/test/handlers";
import { renderApp } from "@/test/render";
import { server } from "@/test/server";

const invalidCredentials = {
	error: { code: "UNAUTHORIZED", message: "Invalid email or password" },
};

function acceptLogin() {
	const requests: unknown[] = [];
	server.use(
		http.post("/api/v1/auth/login", async ({ request }) => {
			requests.push(await request.json());
			return HttpResponse.json(currentUser);
		}),
	);
	return requests;
}

async function fillAndSubmit(
	user: ReturnType<typeof renderApp>["user"],
	email = "operator@acme.test",
	password = "secret-password",
) {
	const submit = await screen.findByRole("button", { name: "Log in" });
	if (email) await user.type(screen.getByLabelText("Email"), email);
	if (password) await user.type(screen.getByLabelText("Password"), password);
	await user.click(submit);
}

beforeEach(() => {
	emptyProducts();
});

describe("login page", () => {
	it("has labelled email and password inputs and a Log in button", async () => {
		signedOut();
		renderApp("/login");

		expect(await screen.findByLabelText("Email")).toHaveAttribute(
			"type",
			"email",
		);
		expect(screen.getByLabelText("Password")).toHaveAttribute(
			"type",
			"password",
		);
		expect(screen.getByRole("button", { name: "Log in" })).toBeEnabled();
	});

	it("disables the submit button while the login request is pending", async () => {
		signedOut();
		let respond: () => void = () => {};
		server.use(
			http.post(
				"/api/v1/auth/login",
				() =>
					new Promise<Response>((resolve) => {
						respond = () => resolve(HttpResponse.json(currentUser));
					}),
			),
		);
		const { user } = renderApp("/login");

		await fillAndSubmit(user);

		await waitFor(() =>
			expect(screen.getByRole("button", { name: /log/i })).toBeDisabled(),
		);
		respond();
	});

	it("sends the credentials and navigates to an internal redirect target", async () => {
		signedOut();
		const requests = acceptLogin();
		const { user, router } = renderApp("/login?redirect=%2Fsync");

		await fillAndSubmit(user);

		await waitFor(() => expect(router.state.location.pathname).toBe("/sync"));
		expect(requests).toEqual([
			{ email: "operator@acme.test", password: "secret-password" },
		]);
	});

	it.each([
		{ case: "no redirect", path: "/login" },
		{
			case: "a protocol-relative redirect",
			path: "/login?redirect=%2F%2Fevil.example",
		},
		{
			case: "an absolute URL redirect",
			path: "/login?redirect=https%3A%2F%2Fevil.example%2F",
		},
	])("navigates to /products after login with $case", async ({ path }) => {
		signedOut();
		acceptLogin();
		const { user, router } = renderApp(path);

		await fillAndSubmit(user);

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/products"),
		);
		expect(router.state.location.href).toBe("/products");
	});

	it("shows the API message in an alert on 401", async () => {
		signedOut();
		server.use(
			http.post("/api/v1/auth/login", () =>
				HttpResponse.json(invalidCredentials, { status: 401 }),
			),
		);
		const { user, router } = renderApp("/login");

		await fillAndSubmit(user, "operator@acme.test", "wrong");

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Invalid email or password",
		);
		expect(router.state.location.pathname).toBe("/login");
	});

	it("shows the network message when the API is unreachable", async () => {
		signedOut();
		server.use(http.post("/api/v1/auth/login", () => HttpResponse.error()));
		const { user } = renderApp("/login");

		await fillAndSubmit(user);

		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Could not reach the server. Check your connection and try again.",
		);
	});

	it.each([
		{
			case: "empty fields",
			email: "",
			password: "",
			errors: { Email: "Enter your email", Password: "Enter your password" },
		},
		{
			case: "an email without @",
			email: "operator.acme.test",
			password: "secret-password",
			errors: { Email: "Enter a valid email address" },
		},
	])(
		"shows field errors for $case without calling the API",
		async ({ email, password, errors }) => {
			signedOut();
			const requests = acceptLogin();
			const { user } = renderApp("/login");

			await fillAndSubmit(user, email, password);

			for (const label of ["Email", "Password"] as const) {
				const input = screen.getByLabelText(label);
				const message = errors[label as keyof typeof errors];
				if (message) {
					expect(input).toHaveAttribute("aria-invalid", "true");
					expect(input).toHaveAccessibleDescription(message);
				} else {
					expect(input).not.toHaveAttribute("aria-invalid", "true");
				}
			}
			expect(requests).toHaveLength(0);
		},
	);

	it("redirects a signed-in user to /products", async () => {
		signedIn();
		const { router } = renderApp("/login");

		await waitFor(() =>
			expect(router.state.location.pathname).toBe("/products"),
		);
	});
});
