import { createApp } from "./app.js";
import { env } from "./infra/env.js";
import { logger } from "./infra/logger.js";

createApp().listen(env.PORT, () => {
	logger.info({ port: env.PORT }, "stocksync-api listening");
});
