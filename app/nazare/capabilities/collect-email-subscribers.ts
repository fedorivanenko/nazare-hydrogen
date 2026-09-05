import {
	createResendContact,
	type ResendConnectorEnv,
} from "../connectors/resend.server";
import { collectEmailSubscribersDefinition } from "../registry/definitions";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(email: string) {
	return EMAIL_PATTERN.test(email);
}

const policyImplementations = {
	"valid-email": validateEmail,
} satisfies Record<
	(typeof collectEmailSubscribersDefinition.policies)[number]["id"],
	(email: string) => boolean
>;

export const collectEmailSubscribers = {
	...collectEmailSubscribersDefinition,
	policy: policyImplementations,

	async execute(email: string, env: ResendConnectorEnv, firstName?: string) {
		if (!policyImplementations["valid-email"](email)) {
			return { ok: false as const, error: "Enter a valid email address." };
		}

		await createResendContact(email, env, firstName);

		return {
			ok: true as const,
			evidence: {
				type: "connector-result",
				connector: "provider.resend.contacts.create",
				result: "contact-created",
			},
		};
	},
};
