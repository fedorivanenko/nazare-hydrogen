import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { listCapabilities, listEntities } from "../app/nazare/registry/index";

const outputPath = path.resolve(process.cwd(), ".wind-tunnel/generated/subject.json");
const entities = listEntities();
const capabilities = listCapabilities();

const sourceFiles = Array.from(
  new Set(
    entities.flatMap((entity) => entity.sourceFiles ?? []),
  ),
).sort();

const compiled = {
  version: 1,
  generatedAt: new Date().toISOString(),
  capabilities,
  entities,
  sourceFiles,
};

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, "utf8");
process.stdout.write(JSON.stringify({ outputPath: ".wind-tunnel/generated/subject.json", capabilityCount: capabilities.length, entityCount: entities.length, sourceFileCount: sourceFiles.length }));
