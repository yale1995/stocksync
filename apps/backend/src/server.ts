import { createApp } from "./app.js";
import { env } from "./infra/env.js";

createApp().listen(env.PORT, () => {
	console.log(`stocksync-api listening on port ${env.PORT}`);
});
