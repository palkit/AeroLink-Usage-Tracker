'use client';
import './globals.css';
import { useEffect, useState, useCallback } from 'react';

function Ring({ state, percent }) {
  // percent 0..100 fills the ring; color depends on state
  const r = 62, c = 2 * Math.PI * r;
  const p = percent == null ? (state === 'green' ? 100 : 0) : percent;
  const dash = (p / 100) * c;
  const color =
    state === 'red' ? 'var(--red)' :
    state === 'green' ? 'var(--green)' :
    state === 'error' ? 'var(--amber)' : 'var(--muted)';
  const label = state === 'red' ? 'LIMIT' : state === 'green' ? 'OK' : state === 'error' ? 'ERR' : '—';
  const big = state === 'red' ? '100%' : state === 'green' ? 'Free' : '?';
  return (
    <div className="ring-wrap">
      <svg width="150" height="150" viewBox="0 0 150 150">
        <circle cx="75" cy="75" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
        <circle
          cx="75" cy="75" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeLinecap="round" strokeDasharray={`${dash} ${c}`}
          transform="rotate(-90 75 75)"
          style={{ transition: 'stroke-dasharray .4s' }}
        />
      </svg>
      <div className="ring-center">
        <div className="big" style={{ color }}>{big}</div>
        <div className="lbl">{label}</div>
      </div>
    </div>
  );
}

function fmtCountdown(ms) {
  if (ms == null || ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

async function copyKey(id, setCopied) {
  try {
    const r = await fetch('/api/accounts/reveal?id=' + encodeURIComponent(id)).then((x) => x.json());
    if (r.key) {
      await navigator.clipboard.writeText(r.key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  } catch {}
}

function Card({ acc, now, onRefresh }) {
  const win = acc.window === '5h' ? '5-hour' : acc.window === 'weekly' ? 'Weekly' : null;
  const resetIn = acc.estReset ? fmtCountdown(acc.estReset - now) : null;
  const [copied, setCopied] = useState(false);
  return (
    <div className="card">
      <span className={`badge ${acc.state}`}>
        {acc.state === 'green' ? 'Active' : acc.state === 'red' ? 'Limit reached' : acc.state === 'error' ? 'Error' : 'Unchecked'}
      </span>
      <div className="name">{acc.name}</div>
      <div className="keymask">{acc.keyMasked || ''}</div>
      <Ring state={acc.state} percent={acc.state === 'red' ? 100 : (acc.state === 'green' ? 100 : 0)} />
      <div className="stat">
        {acc.state === 'red' && (
          <>
            <div className="win">{win || 'Limit'} reached</div>
            {acc.usedAllowance != null && (
              <div className="used">${acc.usedAllowance.toFixed(2)} <span className="muted">used</span></div>
            )}
            <div className="reset">{resetIn ? `~resets in ${resetIn} (est.)` : 'reset time unknown'}</div>
          </>
        )}
        {acc.state === 'green' && <div className="win" style={{ color: 'var(--green)' }}>Limit available</div>}
        {acc.state === 'error' && <div className="win" style={{ color: 'var(--amber)' }}>{acc.message}</div>}
        {acc.state === 'unknown' && <div className="reset">Not checked yet</div>}
        {acc.checkedAt && (
          <div className="reset">checked {fmtCountdown(now - acc.checkedAt) || '0m'} ago</div>
        )}
      </div>
      <button
        className="btn"
        style={{ marginTop: 14, width: '100%' }}
        onClick={() => copyKey(acc.id, setCopied)}
      >
        {copied ? '✓ Copied!' : 'Copy API key'}
      </button>
    </div>
  );
}

export default function Page() {
  const [accounts, setAccounts] = useState([]);
  const [masks, setMasks] = useState({});
  const [now, setNow] = useState(Date.now());
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const [s, a] = await Promise.all([
      fetch('/api/status').then((r) => r.json()),
      fetch('/api/accounts').then((r) => r.json()),
    ]);
    const maskMap = {};
    a.accounts.forEach((x) => { maskMap[x.id] = x.keyMasked; });
    setMasks(maskMap);
    setAccounts(s.accounts.map((x) => ({ ...x, keyMasked: maskMap[x.id] })));
  }, []);

  useEffect(() => { load(); }, [load]);
  // poll status every 15s, tick countdown every 1s
  useEffect(() => {
    const p = setInterval(load, 15000);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearInterval(p); clearInterval(t); };
  }, [load]);

  async function refreshNow() {
    setRefreshing(true);
    await fetch('/api/refresh', { method: 'POST', body: '{}' });
    await load();
    setRefreshing(false);
  }

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>Aerolink Usage Panel</h1>
          <div className="sub">{accounts.length} account{accounts.length !== 1 ? 's' : ''} · auto-checks green every 5m, red every 2m</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn" onClick={refreshNow} disabled={refreshing}>
            {refreshing ? 'Checking…' : 'Check now'}
          </button>
          <button className="btn primary" onClick={() => setShowSettings(true)}>Settings</button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="empty">No accounts yet. Click <b>Settings</b> to add your Aerolink API keys.</div>
      ) : (
        <div className="grid">
          {accounts.map((acc) => (
            <Card key={acc.id} acc={acc} now={now} onRefresh={refreshNow} />
          ))}
        </div>
      )}

      <div className="foot">
        Reset times are estimates based on when a limit was first detected — accurate to your check interval.
      </div>

      {showSettings && (
        <Settings
          onClose={() => { setShowSettings(false); load(); }}
        />
      )}
    </div>
  );
}

function CopyBtn({ id }) {
  const [copied, setCopied] = useState(false);
  return (
    <button className="btn" onClick={() => copyKey(id, setCopied)}>
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

function Settings({ onClose }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    const a = await fetch('/api/accounts').then((r) => r.json());
    setList(a.accounts);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function add() {
    if (!name.trim() || !key.trim()) return;
    setSaving(true);
    await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, key }),
    });
    setName(''); setKey('');
    await reload();
    setSaving(false);
  }

  async function del(id) {
    await fetch('/api/accounts', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    await reload();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Accounts</h2>
        <div className="hint">Add each Aerolink account with a name and its <code>aero_live_</code> API key.</div>

        {list.map((a) => (
          <div className="acct-row" key={a.id}>
            <div className="info">
              <div>{a.name}</div>
              <div className="m">{a.keyMasked}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <CopyBtn id={a.id} />
              <button className="btn danger" onClick={() => del(a.id)}>Delete</button>
            </div>
          </div>
        ))}

        <div className="field" style={{ marginTop: 18 }}>
          <label>Account name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main account" />
        </div>
        <div className="field">
          <label>API key</label>
          <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="aero_live_..." />
        </div>

        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={add} disabled={saving}>
            {saving ? 'Adding…' : 'Add account'}
          </button>
        </div>
      </div>
    </div>
  );
}
