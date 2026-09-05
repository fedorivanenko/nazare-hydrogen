import * as build from "virtual:react-router/server-build";
import { createRequestHandler } from "@shopify/hydrogen";

export type Env = {
	RESEND_API_KEY?: string;
};

export default {
	async fetch(request: Request, env: Env) {
		const handleRequest = createRequestHandler({
			build,
			getLoadContext: () => ({ env }),
		});

		return handleRequest(request);
	},
};
