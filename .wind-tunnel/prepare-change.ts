import { readFile } from "node:fs/promises";
import path from "node:path";
import {
	compileCapabilityTask,
	findEntities,
} from "../app/nazare/registry/agent";

const input = JSON.parse(
	await new Promise<string>((resolve, reject) => {
		let value = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			value += chunk;
		});
		process.stdin.on("end", () => resolve(value));
		process.stdin.on("error", reject);
	}),
) as { task?: unknown };

const task = typeof input.task === "string" ? input.task.trim() : "";
if (!task) throw new Error("Bootstrap input.task must be a non-empty string");
const capability = findEntities(task, "capability")[0];
if (!capability || capability.kind !== "capability")
	throw new Error("No Nazare capability matched requested change");
const compiled = compileCapabilityTask(capability.id, task);
if (!compiled.ok) throw new Error(compiled.error);

const relatedTestFiles = ["app/nazare/registry/index.test.ts"];
const contextFiles = Array.from(
	new Set([...compiled.sourceFiles, ...relatedTestFiles]),
);
let remainingExcerptBytes = 18_000;
const sourceExcerpts = [];
for (const sourceFile of contextFiles) {
	if (remainingExcerptBytes <= 0) break;
	const absolutePath = path.resolve(process.cwd(), sourceFile);
	if (!absolutePath.startsWith(`${path.resolve(process.cwd())}${path.sep}`))
		continue;
	try {
		const content = await readFile(absolutePath, "utf8");
		const excerpt = content.slice(0, Math.min(6_000, remainingExcerptBytes));
		remainingExcerptBytes -= Buffer.byteLength(excerpt);
		sourceExcerpts.push({
			path: sourceFile,
			content: excerpt,
			truncated: excerpt.length < content.length,
		});
	} catch {}
}

process.stdout.write(
	JSON.stringify({
		selectedCapability: { id: capability.id, intent: capability.intent },
		mutationSet: compiled.mutationSet,
		verificationPlan: compiled.verificationPlan,
		compiledContext: compiled,
		sourceExcerpts,
		relatedTestFiles,
		evaluatorVerification: [
			"pnpm lint",
			"pnpm test",
			"pnpm typecheck",
			"pnpm build",
		],
	}),
);
