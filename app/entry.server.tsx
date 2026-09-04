import { renderToReadableStream } from "react-dom/server";
import { type EntryContext, ServerRouter } from "react-router";

export default async function handleRequest(
	request: Request,
	status: number,
	headers: Headers,
	context: EntryContext,
) {
	const body = await renderToReadableStream(
		<ServerRouter context={context} url={request.url} />,
		{ signal: request.signal },
	);

	headers.set("Content-Type", "text/html");
	return new Response(body, { status, headers });
}
