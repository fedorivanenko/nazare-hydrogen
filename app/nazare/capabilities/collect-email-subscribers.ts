import {
	createResendContact,
	type ResendConnectorEnv,
} from "../connectors/resend.server";
import { collectEmailSubscribersDefinition } from "../registry/definitions";

/** @nazare-id const_e2a14bee6fed49658dd6f1cd0e72fce4 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * @nazare-id fn_6c0a6726c74543f0954a32ad2eb881e4
 * @responsibility email.address.validate
 */
function validateSubscriberEmail(email: string) {
	return EMAIL_PATTERN.test(email);
}

/**
 * @nazare-id fn_04d1075829844cadb488f5ac48bb1749
 * @responsibility email.result.create
 */
function createInvalidEmailResult() {
	return { ok: false as const, error: "Enter a valid email address." };
}

/**
 * @nazare-id fn_2ff996dfc8ed41d385256e2c5622e379
 * @responsibility subscriber.result.create
 */
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

/**
 * @nazare-id fn_35916af3e4624ff69dd7943893dd36fd
 * @responsibility email.subscriber.create
 */
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

/** @nazare-id const_af2ed2d12f58475c8de954d0c938b239 */
export const collectEmailSubscribers = {
	...collectEmailSubscribersDefinition,
	policy: policyImplementations,
	execute: collectEmailSubscriber,
};
