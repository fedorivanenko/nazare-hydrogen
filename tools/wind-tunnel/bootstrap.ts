import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';

const ROOT_DIR = process.env.WIND_TUNNEL_ROOT ?? '/workspace';
const REPO_DIR = process.env.WIND_TUNNEL_REPO_DIR ?? path.join(ROOT_DIR, 'nazare-hydrogen');
const BASELINE_MARKER_PATH = path.join(ROOT_DIR, '.wind-tunnel-baseline-sha');
const DEPLOYED_SOURCE_SHA = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.WIND_TUNNEL_SOURCE_SHA;

async function readMarker() {
  try {
    return (await readFile(BASELINE_MARKER_PATH, 'utf8')).trim() || null;
  } catch {
    return null;
  }
}

async function refreshPersistentBaselineIfNeeded() {
  await mkdir(ROOT_DIR, {recursive: true});
  if (!DEPLOYED_SOURCE_SHA) {
    console.log('Wind tunnel bootstrap: no deployed source SHA; keeping persistent workspace as-is');
    return;
  }

  const baselineSourceSha = await readMarker();
  if (baselineSourceSha === DEPLOYED_SOURCE_SHA) {
    console.log(`Wind tunnel bootstrap: baseline already matches ${DEPLOYED_SOURCE_SHA}`);
    return;
  }

  console.log(`Wind tunnel bootstrap: refreshing baseline ${baselineSourceSha ?? '<none>'} -> ${DEPLOYED_SOURCE_SHA}`);
  await rm(REPO_DIR, {recursive: true, force: true});
  await writeFile(BASELINE_MARKER_PATH, `${DEPLOYED_SOURCE_SHA}\n`, 'utf8');
}

await refreshPersistentBaselineIfNeeded();
await import('./oauth-gateway.ts');
