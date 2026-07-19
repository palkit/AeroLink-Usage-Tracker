// Storage abstraction: uses Upstash Redis in production (when env vars exist),
// otherwise falls back to a local JSON file so it runs on your machine too.
import fs from 'fs/promises';
import path from 'path';

const HAS_REDIS =
  !!process.env.UPSTASH_REDIS_REST_URL && !!process.env.UPSTASH_REDIS_REST_TOKEN;
const LOCAL_FILE = path.join(process.cwd(), '.data', 'store.json');

let _redis = null;
async function getRedis() {
  if (_redis) return _redis;
  const { Redis } = await import('@upstash/redis');
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

async function readLocal() {
  try {
    const raw = await fs.readFile(LOCAL_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { accounts: [], status: {} };
  }
}

async function writeLocal(data) {
  await fs.mkdir(path.dirname(LOCAL_FILE), { recursive: true });
  await fs.writeFile(LOCAL_FILE, JSON.stringify(data, null, 2));
}

export async function getAccounts() {
  if (HAS_REDIS) return (await (await getRedis()).get('accounts')) || [];
  return (await readLocal()).accounts;
}

export async function setAccounts(accounts) {
  if (HAS_REDIS) return (await getRedis()).set('accounts', accounts);
  const data = await readLocal();
  data.accounts = accounts;
  await writeLocal(data);
}

export async function getStatus() {
  if (HAS_REDIS) return (await (await getRedis()).get('status')) || {};
  return (await readLocal()).status;
}

export async function setStatus(status) {
  if (HAS_REDIS) return (await getRedis()).set('status', status);
  const data = await readLocal();
  data.status = status;
  await writeLocal(data);
}
