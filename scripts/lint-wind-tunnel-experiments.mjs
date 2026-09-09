import {readFile, readdir, stat} from 'node:fs/promises';
import path from 'node:path';

const MAX_TIMEOUT_MS = 15 * 60_000;
const root = process.cwd();
const requestedPath = process.argv[2];

function fail(file, message) {
  return `${file}: ${message}`;
}

function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && !path.isAbsolute(value) && !value.split(/[\\/]/).includes('..');
}

function validate(definition, file) {
  const errors = [];
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) return [fail(file, 'must contain a JSON object')];
  if (typeof definition.id !== 'string' || !definition.id.trim()) errors.push(fail(file, 'id must be a non-empty string'));
  if (!safeRelative(definition.taskFile)) errors.push(fail(file, 'taskFile must be a safe repo-relative path'));

  const agent = definition.agent;
  if (!agent || typeof agent !== 'object' || Array.isArray(agent)) {
    errors.push(fail(file, 'agent is required'));
  } else {
    if (typeof agent.provider !== 'string' || !agent.provider.trim()) errors.push(fail(file, 'agent.provider is required'));
    if (typeof agent.model !== 'string' || !agent.model.trim()) errors.push(fail(file, 'agent.model is required'));
    if (agent.thinking != null && (typeof agent.thinking !== 'string' || !agent.thinking.trim())) errors.push(fail(file, 'agent.thinking must be a non-empty string when provided'));
    if (!Number.isInteger(agent.timeoutMs) || agent.timeoutMs < 1_000 || agent.timeoutMs > MAX_TIMEOUT_MS) errors.push(fail(file, `agent.timeoutMs must be an integer from 1000 to ${MAX_TIMEOUT_MS}`));
  }

  const tools = definition.tools;
  if (tools != null) {
    if (!tools || typeof tools !== 'object' || Array.isArray(tools)) errors.push(fail(file, 'tools must be an object'));
    if (tools?.allow != null && (!Array.isArray(tools.allow) || tools.allow.length === 0 || tools.allow.some((name) => typeof name !== 'string' || !name.trim()))) errors.push(fail(file, 'tools.allow must be a non-empty array of tool names'));
    if (tools?.extensions != null && (!Array.isArray(tools.extensions) || tools.extensions.some((extension) => !safeRelative(extension)))) errors.push(fail(file, 'tools.extensions must contain safe repo-relative paths'));
  }

  if (!Array.isArray(definition.verification) || definition.verification.length === 0) {
    errors.push(fail(file, 'verification must be a non-empty array'));
  } else {
    definition.verification.forEach((item, index) => {
      if (typeof item === 'string') {
        if (!item.trim()) errors.push(fail(file, `verification[${index}] must not be empty`));
        return;
      }
      if (!item || typeof item !== 'object' || typeof item.command !== 'string' || !item.command.trim()) errors.push(fail(file, `verification[${index}].command is required`));
      if (item?.timeoutMs != null && (!Number.isInteger(item.timeoutMs) || item.timeoutMs < 1_000)) errors.push(fail(file, `verification[${index}].timeoutMs must be an integer >= 1000`));
      if (item?.required != null && typeof item.required !== 'boolean') errors.push(fail(file, `verification[${index}].required must be boolean`));
    });
  }

  return errors;
}

async function collectJson(dir) {
  const entries = await readdir(dir, {withFileTypes:true});
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await collectJson(absolute));
    else if (entry.isFile() && entry.name.endsWith('.json') && entry.name.startsWith('experiment-')) files.push(absolute);
  }
  return files;
}

const files = requestedPath
  ? [path.resolve(root, requestedPath)]
  : await collectJson(path.join(root, 'experiments'));

const errors = [];
for (const absolute of files) {
  const relative = path.relative(root, absolute);
  try {
    const info = await stat(absolute);
    if (!info.isFile()) throw new Error('not a file');
    const definition = JSON.parse(await readFile(absolute, 'utf8'));
    errors.push(...validate(definition, relative));
    for (const referencedPath of [definition.taskFile, ...(definition.tools?.extensions ?? [])]) {
      if (!safeRelative(referencedPath)) continue;
      const target = path.resolve(root, referencedPath);
      if (!target.startsWith(`${root}${path.sep}`)) errors.push(fail(relative, `${referencedPath} resolves outside repository`));
      else {
        try { if (!(await stat(target)).isFile()) throw new Error('not a file'); }
        catch { errors.push(fail(relative, `referenced file does not exist: ${referencedPath}`)); }
      }
    }
  } catch (error) {
    errors.push(fail(relative, error instanceof Error ? error.message : String(error)));
  }
}

if (errors.length) {
  console.error(`Wind Tunnel experiment lint failed (${errors.length} error${errors.length === 1 ? '' : 's'}):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log(`Wind Tunnel experiment lint passed (${files.length} experiment${files.length === 1 ? '' : 's'}).`);
