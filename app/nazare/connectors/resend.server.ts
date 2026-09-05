export type ResendConnectorEnv = {
	RESEND_API_KEY?: string;
};

export async function createResendContact(
	email: string,
	env: ResendConnectorEnv,
) {
	if (!env.RESEND_API_KEY) {
		throw new Error("RESEND_API_KEY is not configured");
	}

	const response = await fetch("https://api.resend.com/contacts", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${env.RESEND_API_KEY}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			email,
			unsubscribed: false,
		}),
	});

	if (!response.ok) {
		const details = await response.text();
		throw new Error(`Resend contact creation failed: ${response.status} ${details}`);
	}

	return response.json() as Promise<{ id: string }>;
}
