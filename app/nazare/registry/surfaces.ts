import { getEntity, listCarcass } from "./index";

export function listSurfaces() {
	return listCarcass();
}

export function getSurface(id: string) {
	const entity = getEntity(id);
	return entity?.kind === "carcass" ? entity : null;
}
