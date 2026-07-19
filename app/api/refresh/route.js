import { NextResponse } from 'next/server';
import { runCheck } from '../../../lib/runCheck.js';

export const dynamic = 'force-dynamic';

// Manual "check now" from the dashboard. Optional ?id= to check one account.
export async function POST(req) {
  let id = null;
  try {
    const body = await req.json();
    id = body.id || null;
  } catch {}
  const status = await runCheck(id);
  return NextResponse.json({ ok: true, status });
}
