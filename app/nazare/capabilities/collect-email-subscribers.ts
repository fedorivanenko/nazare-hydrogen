import {
	createResendContact,
	type ResendConnectorEnv,
} from "../connectors/resend.server";
import { defineCapability } from "../registry/schema";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string) {
	return EMAIL_PATTERN.test(email);
}

export const collectEmailSubscribers = defineCapability({
	id: "collect-email-subscribers",
	intent: "Collect visitor email addresses for future marketing communication",
	keywords: ["email", "newsletter", "subscriber", "signup", "marketing"],

	surfaces: [
		{ type: "surface", id: "carcass.section.hero" },
	],

	providers: [
		{ type: "provider", id: "resend", action: "contacts.create" },
	],

	policies: [
		{
			id: "valid-email",
			description: "Only accept syntactically valid email addresses",
		},
	],

	evidence: [
		{
			id: "contact-created",
			type: "runtime",
			description: "Resend confirms that the contact was created",
		},
	],

	sourceFiles: [
		"app/nazare/capabilities/collect-email-subscribers.ts",
		"app/nazare/carcass/sections/Hero.tsx",
		"app/nazare/connectors/resend.server.ts",
	],

	policy: {
		validate: validateEmail,
	},

	async execute(email: string, env: ResendConnectorEnv) {
		if (!validateEmail(email)) {
			return { ok: false as const, error: "Enter a valid email address." };
		}

		await createResendContact(email, env);

		return {
			ok: true as const,
			evidence: {
				type: "connector-result",
				connector: "resend.contacts.create",
				result: "contact-created",
			},
		};
	},
});
