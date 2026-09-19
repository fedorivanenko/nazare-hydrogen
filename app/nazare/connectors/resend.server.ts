export { resendDefinition as resendConnector } from "../registry/definitions";

export type ResendConnectorEnv = {
	RESEND_API_KEY?: string;
};

type ResendContact = {
	id: string;
};

function normalizeEmailAddress(email: string) {
	return email.trim();
}

function serializeResendContact(email: string) {
	return JSON.stringify({
		email,
		unsubscribed: false,
	});
}

function createResendHeaders(apiKey: string) {
	return {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	};
}

async function readResendFailure(response: Response) {
	const details = await response.text();
	return `Resend contact creation failed: ${response.status} ${details}`;
}

async function parseResendContact(response: Response) {
	return response.json() as Promise<ResendContact>;
}

export async function createResendContact(
	email: string,
	env: ResendConnectorEnv,
) {
	if (!env.RESEND_API_KEY) {
		throw new Error("RESEND_API_KEY is not configured");
	}

	const normalizedEmail = normalizeEmailAddress(email);
	const body = serializeResendContact(normalizedEmail);
	const headers = createResendHeaders(env.RESEND_API_KEY);
	const response = await fetch("https://api.resend.com/contacts", {
		method: "POST",
		headers,
		body,
	});

	if (!response.ok) {
		throw new Error(await readResendFailure(response));
	}

	return parseResendContact(response);
}
