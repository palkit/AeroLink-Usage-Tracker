import { NextResponse } from 'next/server';
import { getAccounts, getStatus } from '../../../lib/storage.js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const accounts = await getAccounts();
  const status = await getStatus();
  const data = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    startAt: a.startAt || null,
    resetAt: a.resetAt || null,
    ...(status[a.id] || { state: 'unknown', message: 'Not checked yet' }),
  }));
  return NextResponse.json({ accounts: data, serverNow: Date.now() });
}
