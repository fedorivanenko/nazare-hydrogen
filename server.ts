import * as build from "virtual:react-router/server-build";
import { createRequestHandler } from "@shopify/hydrogen";

const handleRequest = createRequestHandler({ build });

export default { fetch: handleRequest };
