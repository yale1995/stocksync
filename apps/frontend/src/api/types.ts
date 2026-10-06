export type ErrorCode =
	| "VALIDATION_ERROR"
	| "UNAUTHORIZED"
	| "FORBIDDEN"
	| "NOT_FOUND"
	| "CONFLICT"
	| "INTERNAL_SERVER_ERROR";

export interface ApiErrorBody {
	error: { code: ErrorCode; message: string };
}

export type UserRole = "admin" | "operator";

export interface CurrentUser {
	id: string;
	email: string;
	role: UserRole;
	tenant: { id: string; name: string };
}

export interface Page<T> {
	data: T[];
	meta: { page: number; limit: number; total: number };
}

export interface Product {
	id: string;
	sku: string;
	name: string;
	priceCents: number;
	stock: number;
	createdAt: string;
	updatedAt: string;
}

export interface SaleItem {
	productId: string;
	sku: string;
	name: string;
	quantity: number;
	unitPriceCents: number;
}

export interface Sale {
	id: string;
	items: SaleItem[];
	totalCents: number;
	createdAt: string;
	user: { id: string; email: string };
}

export type SyncEventTrigger =
	| "product_created"
	| "stock_changed"
	| "price_changed"
	| "product_deleted";

export interface FailedSyncEvent {
	id: string;
	productId: string;
	sku: string;
	trigger: SyncEventTrigger;
	attempts: number;
	lastError: string | null;
	updatedAt: string;
}

export interface SyncStatus {
	pending: number;
	sent: number;
	failed: number;
	superseded: number;
	lastSuccessfulSyncAt: string | null;
	failedEvents: FailedSyncEvent[];
}
