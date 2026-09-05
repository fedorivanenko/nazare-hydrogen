import {
	createResendContact,
	type ResendConnectorEnv,
} from "../connectors/resend.server";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const collectEmailSubscribers = {
	id: "collect-email-subscribers",
	intent: "Collect visitor email addresses for future marketing communication",

	policy: {
		validate(email: string) {
			return EMAIL_PATTERN.test(email);
		},
	},

	implementation: {
		surfaces: ["carcass.section.hero"],
		connectors: ["resend.contacts.create"],
	},

	async execute(email: string, env: ResendConnectorEnv) {
		if (!this.policy.validate(email)) {
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
};
