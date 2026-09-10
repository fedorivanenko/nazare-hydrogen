import { writeFile } from "node:fs/promises";
import { listCapabilities, listEntities } from "../app/nazare/registry/index";

const outputPath = process.env.WIND_TUNNEL_SUBJECT_OUTPUT ?? "/workspace/.wind-tunnel-subject.json";
const entities = listEntities();
const capabilities = listCapabilities();

const sourceFiles = Array.from(
  new Set(entities.flatMap((entity) => entity.sourceFiles ?? [])),
).sort();

const compiled = {
  version: 1,
  generatedAt: new Date().toISOString(),
  capabilities,
  entities,
  sourceFiles,
};

await writeFile(outputPath, `${JSON.stringify(compiled, null, 2)}\n`, "utf8");
process.stdout.write(
  JSON.stringify({
    outputPath,
    capabilityCount: capabilities.length,
    entityCount: entities.length,
    sourceFileCount: sourceFiles.length,
  }),
);
