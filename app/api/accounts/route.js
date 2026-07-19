import { NextResponse } from 'next/server';
import { getAccounts, setAccounts, getStatus, setStatus } from '../../../lib/storage.js';

export const dynamic = 'force-dynamic';

// Simple id generator (no external dep)
function makeId() {
  return 'acc_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// Never send full keys to the browser — mask them.
function mask(key) {
  if (!key) return '';
  if (key.length <= 12) return key.slice(0, 4) + '****';
  return key.slice(0, 10) + '****' + key.slice(-4);
}

export async function GET() {
  const accounts = await getAccounts();
  const safe = accounts.map((a) => ({ id: a.id, name: a.name, keyMasked: mask(a.key), startAt: a.startAt || null }));
  return NextResponse.json({ accounts: safe });
}

export async function POST(req) {
  const { name, key, startAt } = await req.json();
  if (!name || !key) {
    return NextResponse.json({ error: 'name and key required' }, { status: 400 });
  }
  const accounts = await getAccounts();
  const acc = { id: makeId(), name: name.trim(), key: key.trim(), startAt: startAt || null };
  accounts.push(acc);
  await setAccounts(accounts);
  return NextResponse.json({ id: acc.id, name: acc.name, keyMasked: mask(acc.key), startAt: acc.startAt });
}

// Update an account's start date/time (or name)
export async function PATCH(req) {
  const { id, startAt, name } = await req.json();
  const accounts = await getAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (startAt !== undefined) acc.startAt = startAt || null;
  if (name !== undefined && name.trim()) acc.name = name.trim();
  await setAccounts(accounts);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { id } = await req.json();
  const accounts = await getAccounts();
  const next = accounts.filter((a) => a.id !== id);
  await setAccounts(next);
  const status = await getStatus();
  delete status[id];
  await setStatus(status);
  return NextResponse.json({ ok: true });
}
