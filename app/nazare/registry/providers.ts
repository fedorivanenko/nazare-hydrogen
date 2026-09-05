import { getEntity, listProviders } from "./index";

export function getProvider(id: string) {
	const entity = getEntity(id);
	return entity?.kind === "provider" ? entity : null;
}

export { listProviders };
