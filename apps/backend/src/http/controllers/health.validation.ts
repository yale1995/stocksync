import { z } from "zod";

export const healthSchema = z
	.strictObject({ status: z.literal("ok") })
	.meta({ id: "Health" });
