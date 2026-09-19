import {
	createResendContact,
	type ResendConnectorEnv,
} from "../connectors/resend.server";
import { collectEmailSubscribersDefinition } from "../registry/definitions";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateSubscriberEmail(email: string) {
	return EMAIL_PATTERN.test(email);
}

function createInvalidEmailResult() {
	return { ok: false as const, error: "Enter a valid email address." };
}

function createSubscriberCollectedResult() {
	return {
		ok: true as const,
		evidence: {
			type: "connector-result",
			connector: "provider.resend.contacts.create",
			result: "contact-created",
		},
	};
}

async function collectEmailSubscriber(email: string, env: ResendConnectorEnv) {
	if (!validateSubscriberEmail(email)) {
		return createInvalidEmailResult();
	}

	await createResendContact(email, env);
	return createSubscriberCollectedResult();
}

const policyImplementations = {
	"valid-email": validateSubscriberEmail,
} satisfies Record<
	(typeof collectEmailSubscribersDefinition.policies)[number]["id"],
	(email: string) => boolean
>;

export const collectEmailSubscribers = {
	...collectEmailSubscribersDefinition,
	policy: policyImplementations,
	execute: collectEmailSubscriber,
};
