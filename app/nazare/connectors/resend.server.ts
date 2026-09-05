import { defineProvider } from "../registry/schema";

export const resendConnector = defineProvider({
	id: "provider.resend",
	kind: "provider",
	intent: "Email delivery and audience management through Resend",
	keywords: ["resend", "email", "contacts", "audience"],
	actions: [
		{
			id: "contacts.create",
			intent: "Create a contact in Resend",
		},
	],
	sourceFiles: ["app/nazare/connectors/resend.server.ts"],
});

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
		throw new Error(
			`Resend contact creation failed: ${response.status} ${details}`,
		);
	}

	return response.json() as Promise<{ id: string }>;
}
