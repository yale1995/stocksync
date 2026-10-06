import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";

// Moves focus to the new page's heading so keyboard and screen reader users
// land on the content after a client-side navigation.
export function RouteFocus() {
	const router = useRouter();

	useEffect(
		() =>
			router.subscribe("onRendered", (event) => {
				if (!event.fromLocation || !event.pathChanged) return;
				document.querySelector<HTMLElement>("h1")?.focus();
			}),
		[router],
	);

	return null;
}
