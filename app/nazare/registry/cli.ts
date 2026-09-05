import {
	expandEntity,
	findEntities,
	inspectEntity,
	planCapabilityChange,
} from "./agent";
import type { RegistryEntityKind } from "./schema";

function print(value: unknown) {
	process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

const [command, ...args] = process.argv.slice(2);

switch (command) {
	case "find": {
		const [query, kind] = args;
		if (!query) throw new Error("Usage: nazare:registry find <query> [kind]");
		print(findEntities(query, kind as RegistryEntityKind | undefined));
		break;
	}
	case "inspect": {
		const [id] = args;
		if (!id) throw new Error("Usage: nazare:registry inspect <entity-id>");
		print(inspectEntity(id));
		break;
	}
	case "expand": {
		const [id] = args;
		if (!id) throw new Error("Usage: nazare:registry expand <entity-id>");
		print(expandEntity(id));
		break;
	}
	case "plan": {
		const [id, ...changeParts] = args;
		const requestedChange = changeParts.join(" ");
		if (!id || !requestedChange) {
			throw new Error(
				"Usage: nazare:registry plan <capability-id> <requested-change>",
			);
		}
		print(planCapabilityChange(id, requestedChange));
		break;
	}
	default:
		throw new Error("Usage: nazare:registry <find|inspect|expand|plan> ...");
}
