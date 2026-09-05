import { resendConnector } from "../connectors/resend.server";

const providers = [resendConnector] as const;

export const providerRegistry = new Map(
	providers.map((provider) => [provider.id, provider]),
);

export function getProvider(id: string) {
	return providerRegistry.get(id) ?? null;
}
