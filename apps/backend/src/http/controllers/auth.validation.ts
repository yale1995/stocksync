import { z } from "zod";
import { userRole } from "../../infra/schemas/users.js";

export const loginSchema = z.object({
	email: z.email(),
	password: z.string().min(1),
});

export const currentUserSchema = z
	.strictObject({
		id: z.uuid(),
		email: z.email(),
		role: z.enum(userRole.enumValues),
		tenant: z.strictObject({ id: z.uuid(), name: z.string() }),
	})
	.meta({ id: "CurrentUser" });
