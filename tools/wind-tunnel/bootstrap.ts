import {mkdir} from 'node:fs/promises';

const APP_DIR = process.env.WIND_TUNNEL_APP_DIR ?? '/app';
const ROOT_DIR = process.env.WIND_TUNNEL_ROOT ?? '/workspace';
const SOURCE_SHA = process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.WIND_TUNNEL_SOURCE_SHA ?? 'local';

if (!process.env.WIND_TUNNEL_TOKEN) {
  throw new Error('WIND_TUNNEL_TOKEN is required');
}
if (process.env.RAILWAY_ENVIRONMENT && !process.env.RAILWAY_GIT_COMMIT_SHA) {
  throw new Error('RAILWAY_GIT_COMMIT_SHA is required in Railway; refusing an unverifiable deployment');
}

await mkdir(ROOT_DIR, {recursive: true});

process.env.WIND_TUNNEL_APP_DIR = APP_DIR;
process.env.WIND_TUNNEL_ROOT = ROOT_DIR;
process.env.WIND_TUNNEL_SOURCE_SHA = SOURCE_SHA;

console.log(`Wind Tunnel source: ${SOURCE_SHA}`);
console.log(`Immutable app snapshot: ${APP_DIR}`);
console.log(`OAuth state root: ${ROOT_DIR}`);
console.log('Experiment state lives in Postgres; artifacts live in S3; worker workspaces are disposable');

await import('./oauth-gateway.ts');
