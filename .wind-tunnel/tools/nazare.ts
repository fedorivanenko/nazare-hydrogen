import { executeNazareOperation } from "../nazare-tools";

const marker = process.argv.indexOf("--wind-tunnel-tool");
if (marker < 0 || !process.argv[marker + 1])
	throw new Error("Expected --wind-tunnel-tool <operation>");
let input = "";
for await (const chunk of process.stdin) input += chunk;
const value = executeNazareOperation(
	process.argv[marker + 1],
	JSON.parse(input || "{}"),
);
process.stdout.write(`${JSON.stringify(value)}\n`);
