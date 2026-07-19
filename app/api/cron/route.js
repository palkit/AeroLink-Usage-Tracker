import { NextResponse } from 'next/server';
import { checkKey, WINDOW_MS } from '../../../lib/checker.js';
import { getAccounts, getStatus, setStatus } from '../../../lib/storage.js';

export const dynamic = 'force-dynamic';

const GREEN_INTERVAL = 5 * 60 * 1000; // check green keys every 5 min
const RED_INTERVAL = 2 * 60 * 1000;   // check red keys every 2 min

// Called frequently (every ~1 min by Vercel Cron or an external pinger).
// Only actually pings a key when its interval has elapsed — so green keys
// hit the API every 5 min and red keys every 2 min, saving quota.
async function handle(req) {
  // optional auth: set CRON_SECRET in env, pass ?secret= or Bearer header
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const url = new URL(req.url);
    const q = url.searchParams.get('secret');
    const auth = req.headers.get('authorization');
    const ok = q === secret || auth === `Bearer ${secret}`;
    if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const accounts = await getAccounts();
  const status = await getStatus();
  const now = Date.now();
  let checked = 0;

  for (const acc of accounts) {
    const prev = status[acc.id] || {};
    const wasRed = prev.state === 'red';
    const interval = wasRed ? RED_INTERVAL : GREEN_INTERVAL;
    const due = !prev.checkedAt || now - prev.checkedAt >= interval;
    if (!due) continue;

    checked++;
    const result = await checkKey(acc.key);

    let redSince = prev.redSince || null;
    let estReset = null;
    if (result.state === 'red') {
      if (!redSince || prev.window !== result.window) redSince = now;
      const dur = WINDOW_MS[result.window];
      if (dur) estReset = redSince + dur;
    } else {
      redSince = null;
    }

    status[acc.id] = {
      state: result.state,
      window: result.window,
      usedAllowance: result.usedAllowance,
      message: result.message,
      redSince,
      estReset,
      checkedAt: now,
    };
  }

  if (checked > 0) await setStatus(status);
  return NextResponse.json({ ok: true, checked, total: accounts.length });
}

export async function GET(req) { return handle(req); }
export async function POST(req) { return handle(req); }
