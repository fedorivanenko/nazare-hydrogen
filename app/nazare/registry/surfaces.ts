import { heroContract } from "../carcass/sections/Hero";

const surfaces = [heroContract] as const;

export const surfaceRegistry = new Map(
	surfaces.map((surface) => [surface.id, surface]),
);

export function getSurface(id: string) {
	return surfaceRegistry.get(id) ?? null;
}
