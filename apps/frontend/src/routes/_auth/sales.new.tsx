import {
	skipToken,
	type UseQueryResult,
	useMutation,
	useQueries,
	useQueryClient,
} from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useRef } from "react";
import { ApiError } from "@/api/client";
import { productKeys, productQuery } from "@/api/products";
import { createSale, type SaleItemInput } from "@/api/sales";
import type { Product } from "@/api/types";
import { PageHeader } from "@/components/page-header";
import {
	type LineView,
	SaleLinesCard,
} from "@/components/sales/sale-lines-card";
import { SaleFailure, SaleSummary } from "@/components/sales/sale-outcome";
import { useSaleForm, validateLine } from "@/components/sales/use-sale-form";
import { Button } from "@/components/ui/button";
import { formatCents } from "@/lib/format";

export const Route = createFileRoute("/_auth/sales/new")({
	component: NewSalePage,
});

function NewSalePage() {
	const [form, dispatch] = useSaleForm();
	const queryClient = useQueryClient();
	const submitting = useRef(false);
	const mutation = useMutation({
		mutationFn: (input: { items: SaleItemInput[]; idempotencyKey: string }) =>
			createSale(input.items, input.idempotencyKey),
		onSuccess: () => {
			dispatch({ type: "reset" });
			void queryClient.invalidateQueries({ queryKey: productKeys.all });
		},
		onError: (error) => {
			// Stock moved or a product disappeared: show the current values.
			if (error.status === 409 || error.status === 404) {
				void queryClient.invalidateQueries({ queryKey: productKeys.all });
			}
		},
		onSettled: () => {
			submitting.current = false;
		},
	});
	// The skipToken entries for empty lines widen the inferred result type.
	const details = useQueries({
		queries: form.lines.map((line) =>
			line.product
				? productQuery(line.product.id, line.product)
				: { queryKey: ["sale-line", line.id], queryFn: skipToken },
		),
	}) as UseQueryResult<Product>[];

	const views: LineView[] = form.lines.map((line, index) => {
		const detail = details[index];
		const unavailable =
			detail?.error instanceof ApiError && detail.error.status === 404;
		const product = line.product && (detail?.data ?? line.product);
		return {
			line,
			product,
			status: validateLine(
				line,
				unavailable ? "unavailable" : product && { stock: product.stock },
			),
			excludedIds: form.lines.flatMap((other) =>
				other !== line && other.product ? [other.product.id] : [],
			),
		};
	});

	const allValid = views.every((view) => view.status.valid);

	function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		// A ref, not mutation state: a double click fires before React re-renders.
		if (!allValid || submitting.current) return;
		const items = views.flatMap(({ product, status }) =>
			product && status.valid
				? [{ productId: product.id, quantity: status.quantity }]
				: [],
		);
		submitting.current = true;
		mutation.mutate({ items, idempotencyKey: form.idempotencyKey });
	}
	const total = views.reduce((sum, { line, product }) => {
		const quantity = Number(line.quantity);
		return product && Number.isInteger(quantity) && quantity > 0
			? sum + product.priceCents * quantity
			: sum;
	}, 0);

	return (
		<>
			<PageHeader
				title="New sale"
				description="Add products and quantities. Stock is checked when you submit."
			/>
			{mutation.isSuccess && <SaleSummary sale={mutation.data} />}
			{mutation.isError && <SaleFailure error={mutation.error} />}
			<form noValidate onSubmit={handleSubmit}>
				<SaleLinesCard lines={views} dispatch={dispatch} />
				<div className="mt-4 flex items-center justify-end gap-4">
					<p className="flex items-baseline gap-2">
						<span className="text-sm text-muted-foreground">Total</span>
						<span data-testid="sale-total" className="text-2xl font-semibold">
							{formatCents(total)}
						</span>
					</p>
					<Button
						type="submit"
						size="lg"
						disabled={!allValid || mutation.isPending}
					>
						{mutation.isPending ? "Registering…" : "Register sale"}
					</Button>
				</div>
			</form>
		</>
	);
}
