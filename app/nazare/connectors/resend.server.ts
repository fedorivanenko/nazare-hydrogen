export { resendDefinition as resendConnector } from "../registry/definitions";

export type ResendConnectorEnv = {
	RESEND_API_KEY?: string;
};

type ResendContact = {
	id: string;
};

/**
 * @nazare-id fn_8f469915c8414defa17333532177e0af
 * @responsibility email.address.transform
 */
function normalizeEmailAddress(email: string) {
	return email.trim();
}

/**
 * @nazare-id fn_51beddd26c404b43af91304d3945b961
 * @responsibility contact.json.transform
 */
function serializeResendContact(email: string) {
	return JSON.stringify({
		email,
		unsubscribed: false,
	});
}

/**
 * @nazare-id fn_98ff2832fc9943829a21cc53bf0fc347
 * @responsibility resend.header.create
 */
function createResendHeaders(apiKey: string) {
	return {
		Authorization: `Bearer ${apiKey}`,
		"Content-Type": "application/json",
	};
}

/**
 * @nazare-id fn_9e78a85c36c54f71ab9492e86f4b07d0
 * @responsibility resend.failure.read
 */
async function readResendFailure(response: Response) {
	const details = await response.text();
	return `Resend contact creation failed: ${response.status} ${details}`;
}

/**
 * @nazare-id fn_aec7a9c1ad2b442bbf402693a28714b1
 * @responsibility resend.contact.transform
 */
async function parseResendContact(response: Response) {
	return response.json() as Promise<ResendContact>;
}

/**
 * @nazare-id fn_4c68682c89fe48cba1e1f1ecc5fdfc00
 * @responsibility resend.contact.create
 */
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
