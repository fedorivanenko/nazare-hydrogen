import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Type } from "typebox";
import {
	compileCapabilityTask,
	expandEntity,
	findEntities,
	inspectEntity,
} from "../app/nazare/registry/agent";

function result(value: unknown) {
	return {
		content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
		details: { value },
	};
}

type ToolRegistrar = { registerTool(definition: unknown): void };

type PendingFile = { path: string; content: string | null };

type NazareOperationInput = {
	query?: string;
	kind?: string;
	id?: string;
	expand?: boolean;
	capabilityId?: string;
	requestedChange?: string;
	patch?: string;
};

export async function executeNazareOperation(
	operation: string,
	input: NazareOperationInput,
) {
	if (operation === "find")
		return findEntities(
			String(input.query ?? ""),
			input.kind as "capability" | "carcass" | "provider" | undefined,
		);
	if (operation === "inspect")
		return input.expand
			? expandEntity(String(input.id ?? ""))
			: inspectEntity(String(input.id ?? ""));
	if (operation === "compile")
		return compileCapabilityTask(
			String(input.capabilityId ?? ""),
			String(input.requestedChange ?? ""),
		);
	if (operation === "apply_patch") {
		const patch = String(input.patch ?? "");
		if (Buffer.byteLength(patch) > 100_000)
			throw new Error("Patch exceeds 100000 bytes");
		const files = await applyPatchText(process.cwd(), patch);
		const validation = spawnSync(
			"pnpm",
			["exec", "tsx", "app/nazare/lint/cli.ts"],
			{
				cwd: process.cwd(),
				encoding: "utf8",
				timeout: 5_000,
			},
		);
		const diagnostics =
			`${validation.stdout ?? ""}${validation.stderr ?? ""}`.trim();
		return {
			applied: true,
			files,
			contractValidation: {
				passed: validation.status === 0,
				diagnostics,
			},
			...(validation.status === 0
				? {}
				: {
						next: "Repair contract validation diagnostics before calling finish_run.",
					}),
		};
	}
	throw new Error(`Unknown Nazare operation: ${operation}`);
}

function safePath(root: string, relativePath: string) {
	const rootPath = realpathSync(root);
	const parts = relativePath.split(/[\\/]/);
	if (parts.includes(".git"))
		throw new Error(
			`Patch path targets forbidden git metadata: ${relativePath}`,
		);
	const absolutePath = path.resolve(rootPath, relativePath);
	if (!absolutePath.startsWith(`${rootPath}${path.sep}`))
		throw new Error(`Patch path escapes repository: ${relativePath}`);
	let current = rootPath;
	for (const part of parts) {
		current = path.join(current, part);
		if (existsSync(current) && lstatSync(current).isSymbolicLink())
			throw new Error(`Patch path traverses symbolic link: ${relativePath}`);
	}
	return absolutePath;
}

function replaceHunk(
	content: string,
	oldText: string,
	newText: string,
	relativePath: string,
) {
	const first = content.indexOf(oldText);
	if (first >= 0) {
		if (content.indexOf(oldText, first + 1) >= 0)
			throw new Error(
				`Update hunk matched multiple locations in ${relativePath}`,
			);
		return (
			content.slice(0, first) + newText + content.slice(first + oldText.length)
		);
	}
	const contentLines = content.split("\n");
	const oldLines = oldText.split("\n");
	const newLines = newText.split("\n");
	const candidates = [];
	for (let index = 0; index <= contentLines.length - oldLines.length; index++)
		if (
			oldLines.every(
				(line, offset) => contentLines[index + offset].trim() === line.trim(),
			)
		)
			candidates.push(index);
	if (candidates.length !== 1)
		throw new Error(`Update hunk did not match ${relativePath}`);
	const index = candidates[0];
	const patchIndent = /^\s*/.exec(oldLines[0])?.[0] ?? "";
	const actualIndent = /^\s*/.exec(contentLines[index])?.[0] ?? "";
	const delta = actualIndent.length - patchIndent.length;
	const adjusted = newLines.map((line) => {
		if (!line.trim()) return line;
		if (delta >= 0) return actualIndent.slice(0, delta) + line;
		const indentation = /^\s*/.exec(line)?.[0] ?? "";
		return line.slice(Math.min(indentation.length, -delta));
	});
	contentLines.splice(index, oldLines.length, ...adjusted);
	return contentLines.join("\n");
}

export async function applyPatchText(root: string, patchText: string) {
	const lines = patchText.replace(/\r\n/g, "\n").trimEnd().split("\n");
	if (lines[0] !== "*** Begin Patch" || lines.at(-1) !== "*** End Patch")
		throw new Error("Patch must use *** Begin Patch / *** End Patch format");
	const pending: PendingFile[] = [];
	let index = 1;
	while (index < lines.length - 1) {
		const header = lines[index++];
		const match = /^\*\*\* (Update|Add|Delete) File: (.+)$/.exec(header);
		if (!match) throw new Error(`Expected file operation, received: ${header}`);
		const operation = match[1];
		const relativePath = match[2];
		const absolutePath = safePath(root, relativePath);
		const section: string[] = [];
		while (index < lines.length - 1 && !lines[index].startsWith("*** "))
			section.push(lines[index++]);
		if (operation === "Delete") {
			await readFile(absolutePath);
			pending.push({ path: absolutePath, content: null });
			continue;
		}
		if (operation === "Add") {
			if (section.some((line) => line && !line.startsWith("+")))
				throw new Error(`Added file lines must start with +: ${relativePath}`);
			pending.push({
				path: absolutePath,
				content: section
					.map((line) => (line.startsWith("+") ? line.slice(1) : line))
					.join("\n"),
			});
			continue;
		}
		let content = await readFile(absolutePath, "utf8");
		const hunks: Array<string[]> = [];
		let hunk: string[] | null = null;
		for (const line of section) {
			if (line.startsWith("@@")) {
				if (hunk) hunks.push(hunk);
				hunk = [];
			} else if (hunk) hunk.push(line);
			else if (line.trim())
				throw new Error(`Update hunk missing @@ marker: ${relativePath}`);
		}
		if (hunk) hunks.push(hunk);
		if (!hunks.length)
			throw new Error(`No update hunks supplied: ${relativePath}`);
		for (const lines of hunks) {
			const oldText = lines
				.filter((line) => line.startsWith(" ") || line.startsWith("-"))
				.map((line) => line.slice(1))
				.join("\n");
			const newText = lines
				.filter((line) => line.startsWith(" ") || line.startsWith("+"))
				.map((line) => line.slice(1))
				.join("\n");
			if (!oldText)
				throw new Error(
					`Update hunk has no context or removed lines: ${relativePath}`,
				);
			content = replaceHunk(content, oldText, newText, relativePath);
		}
		pending.push({ path: absolutePath, content });
	}
	for (const file of pending) {
		if (file.content === null) await rm(file.path);
		else {
			await mkdir(path.dirname(file.path), { recursive: true });
			await writeFile(file.path, file.content);
		}
	}
	return pending.map((file) => path.relative(realpathSync(root), file.path));
}

export default function registerNazareTools(pi: ToolRegistrar) {
	pi.registerTool({
		name: "apply_patch",
		label: "Apply Patch",
		description:
			"Apply the model-native *** Begin Patch format to one or more repository files. Supports *** Update File, *** Add File, and *** Delete File sections with @@ update hunks.",
		promptSnippet:
			"Use apply_patch for coordinated or multi-file edits; use *** Begin Patch, file-operation headers, @@ hunks, then *** End Patch",
		parameters: Type.Object({
			patch: Type.String({
				description:
					"Patch using *** Begin Patch, *** Update/Add/Delete File headers, @@ hunks, and *** End Patch",
			}),
		}),
		async execute(_toolCallId: string, params: { patch: string }) {
			if (Buffer.byteLength(params.patch) > 100_000)
				throw new Error("Patch exceeds 100000 bytes");
			const files = await applyPatchText(process.cwd(), params.patch);
			return {
				content: [
					{
						type: "text" as const,
						text: `Patch applied successfully to ${files.join(", ")}.`,
					},
				],
				details: { applied: true, files },
			};
		},
	});

	pi.registerTool({
		name: "nazare_find",
		label: "Nazare Find",
		description:
			"Search the pinned Nazare architecture registry for capabilities, surfaces, providers, and source boundaries.",
		promptSnippet:
			"Search the Nazare registry before broad repository exploration",
		parameters: Type.Object({
			query: Type.String({
				description: "Behavior, capability, surface, or provider to find",
			}),
			kind: Type.Optional(
				Type.String({
					description:
						"Optional registry kind: capability, carcass, or provider",
				}),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { query: string; kind?: string },
		) {
			return result(executeNazareOperation("find", params));
		},
	});

	pi.registerTool({
		name: "nazare_inspect",
		label: "Nazare Inspect",
		description:
			"Inspect one registry entity or expand its directly connected executable neighborhood.",
		promptSnippet: "Inspect or expand a Nazare registry entity by exact ID",
		parameters: Type.Object({
			id: Type.String({ description: "Exact registry entity ID" }),
			expand: Type.Optional(
				Type.Boolean({
					description: "Include directly connected entities and bindings",
				}),
			),
		}),
		async execute(
			_toolCallId: string,
			params: { id: string; expand?: boolean },
		) {
			return result(executeNazareOperation("inspect", params));
		},
	});

	pi.registerTool({
		name: "nazare_compile",
		label: "Nazare Compile",
		description:
			"Compile a requested capability change into pinned source files, bindings, policies, evidence, and verification requirements.",
		promptSnippet:
			"Compile a capability change before editing implementation files",
		parameters: Type.Object({
			capabilityId: Type.String({ description: "Exact capability ID" }),
			requestedChange: Type.String({
				description: "Requested behavior change",
			}),
		}),
		async execute(
			_toolCallId: string,
			params: { capabilityId: string; requestedChange: string },
		) {
			return result(executeNazareOperation("compile", params));
		},
	});
}
