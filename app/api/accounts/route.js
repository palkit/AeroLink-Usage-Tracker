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

// Password required to add/edit/delete. Set PANEL_PASSWORD in env to override.
const PASSWORD = process.env.PANEL_PASSWORD || 'chut';
function checkPw(pw) {
  return pw === PASSWORD;
}

export async function GET() {
  const accounts = await getAccounts();
  const safe = accounts.map((a) => ({
    id: a.id, name: a.name, keyMasked: mask(a.key),
    startAt: a.startAt || null, resetAt: a.resetAt || null,
  }));
  return NextResponse.json({ accounts: safe });
}

export async function POST(req) {
  const { name, key, startAt, resetAt, password } = await req.json();
  if (!checkPw(password)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  if (!name || !key) {
    return NextResponse.json({ error: 'name and key required' }, { status: 400 });
  }
  const accounts = await getAccounts();
  const acc = { id: makeId(), name: name.trim(), key: key.trim(), startAt: startAt || null, resetAt: resetAt || null };
  accounts.push(acc);
  await setAccounts(accounts);
  return NextResponse.json({ id: acc.id, name: acc.name, keyMasked: mask(acc.key), startAt: acc.startAt, resetAt: acc.resetAt });
}

// Update an account's start date/time, 5-hour reset anchor, or name
export async function PATCH(req) {
  const { id, startAt, resetAt, name, password } = await req.json();
  if (!checkPw(password)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const accounts = await getAccounts();
  const acc = accounts.find((a) => a.id === id);
  if (!acc) return NextResponse.json({ error: 'not found' }, { status: 404 });
  if (startAt !== undefined) acc.startAt = startAt || null;
  if (resetAt !== undefined) acc.resetAt = resetAt || null;
  if (name !== undefined && name.trim()) acc.name = name.trim();
  await setAccounts(accounts);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  const { id, password } = await req.json();
  if (!checkPw(password)) {
    return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
  }
  const accounts = await getAccounts();
  const next = accounts.filter((a) => a.id !== id);
  await setAccounts(next);
  const status = await getStatus();
  delete status[id];
  await setStatus(status);
  return NextResponse.json({ ok: true });
}
