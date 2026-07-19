import { NextResponse } from 'next/server';
import { getAccounts } from '../../../../lib/storage.js';

export const dynamic = 'force-dynamic';

// Returns the FULL key for one account, so the dashboard can copy it.
// Optional protection: if PANEL_PASSWORD is set, require ?pw= to match.
export async function GET(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const pw = url.searchParams.get('pw');

  if (process.env.PANEL_PASSWORD && pw !== process.env.PANEL_PASSWORD) {
    return NextResponse.json({ error: 'locked' }, { status: 401 });
  }

  const accounts = await getAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ id: acc.id, name: acc.name, key: acc.key });
}
