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

// Messages can occasionally be an object (e.g. an API error shape); coerce to a
// safe string so React never tries to render an object as a child.
function msgText(m) {
  if (m == null) return '';
  if (typeof m === 'string') return m;
  if (typeof m === 'object') return m.message || m.type || JSON.stringify(m);
  return String(m);
}

function fmtCountdown(ms) {
  if (ms == null || ms <= 0) return null;
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const VALIDITY_MS = 14 * 24 * 60 * 60 * 1000; // accounts last 2 weeks

// Long countdown with days for account expiry
function fmtLong(ms) {
  if (ms == null) return null;
  if (ms <= 0) return 'expired';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// returns { expireAt, leftMs, expired } or null if no startAt
function expiry(startAt, now) {
  if (!startAt) return null;
  const start = new Date(startAt).getTime();
  if (isNaN(start)) return null;
  const expireAt = start + VALIDITY_MS;
  const leftMs = expireAt - now;
  return { expireAt, leftMs, expired: leftMs <= 0 };
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Weekly window: from startAt, each 7-day block. Returns the current block's
// end time and how much is left, plus which week (1 or 2) we're in.
function weekly(startAt, now) {
  if (!startAt) return null;
  const start = new Date(startAt).getTime();
  if (isNaN(start)) return null;
  const elapsed = now - start;
  if (elapsed < 0) return null;
  const weekIndex = Math.floor(elapsed / WEEK_MS); // 0 = first week, 1 = second
  const weekEnd = start + (weekIndex + 1) * WEEK_MS;
  const leftMs = weekEnd - now;
  return { weekNo: weekIndex + 1, weekEnd, leftMs, ended: leftMs <= 0 };
}

const FIVE_H = 5 * 60 * 60 * 1000;

// 5-hour window resets at fixed times. resetAt is ANY known reset moment (anchor);
// windows repeat every 5h from it in both directions. Returns the next reset
// boundary after `now` and how long until then — a rolling, always-accurate clock.
function next5h(resetAt, now) {
  if (!resetAt) return null;
  const a = new Date(resetAt).getTime();
  if (isNaN(a)) return null;
  const k = Math.ceil((now - a) / FIVE_H);
  let next = a + k * FIVE_H;
  if (next <= now) next += FIVE_H; // guard when exactly on a boundary
  return { next, leftMs: next - now };
}

async function copyKey(id, setCopied) {
  let key = '';
  try {
    const r = await fetch('/api/accounts/reveal?id=' + encodeURIComponent(id)).then((x) => x.json());
    key = r.key || '';
  } catch {
    alert('Copy failed: key fetch nahi hui');
    return;
  }
  if (!key) { alert('Copy failed: key nahi mili'); return; }

  // Try modern clipboard API, fall back to a hidden textarea (works on http / older browsers)
  let ok = false;
  try {
    await navigator.clipboard.writeText(key);
    ok = true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = key;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ok = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch { ok = false; }
  }

  if (ok) {
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  } else {
    // last resort: show the key so user can copy manually
    window.prompt('Copy nahi hui — yeh key manually copy karo:', key);
  }
}

function Card({ acc, now, onRefresh }) {
  const win = acc.window === '5h' ? '5-hour' : acc.window === 'weekly' ? 'Weekly' : null;
  const [copied, setCopied] = useState(false);
  const exp = expiry(acc.startAt, now);
  const isExpired = exp && exp.expired;
  const wk = weekly(acc.startAt, now);
  const r5 = next5h(acc.resetAt, now); // fixed 5-hour reset clock
  return (
    <div className="card" style={isExpired ? { opacity: 0.6, borderColor: 'var(--red)' } : undefined}>
      <span className={`badge ${isExpired ? 'red' : acc.state}`}>
        {isExpired ? 'Expired' : acc.state === 'green' ? 'Active' : acc.state === 'red' ? 'Limit reached' : acc.state === 'error' ? 'Error' : 'Unchecked'}
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
          </>
        )}
        {acc.state === 'green' && <div className="win" style={{ color: 'var(--green)' }}>Limit available</div>}
        {acc.state === 'error' && <div className="win" style={{ color: 'var(--amber)' }}>{msgText(acc.message)}</div>}
        {acc.state === 'unknown' && <div className="reset">Not checked yet</div>}
        {acc.checkedAt && (
          <div className="reset">checked {fmtCountdown(now - acc.checkedAt) || '0m'} ago</div>
        )}
      </div>

      {r5 && !isExpired && (
        <div className="expiry" style={{ color: r5.leftMs < 60 * 60 * 1000 ? 'var(--amber)' : 'var(--green)', marginTop: 12 }}>
          {`⏱ 5h window resets in ${fmtCountdown(r5.leftMs) || '0m'}`}
        </div>
      )}

      {wk && !isExpired && (
        <div className="expiry" style={{ color: wk.leftMs < 86400000 ? 'var(--amber)' : 'var(--muted)', marginTop: 8 }}>
          {`📅 Week ${wk.weekNo} ends in ${fmtLong(wk.leftMs)}`}
        </div>
      )}

      {exp && (
        <div
          className="expiry"
          style={{ color: isExpired ? 'var(--red)' : (exp.leftMs < 2 * 86400000 ? 'var(--amber)' : 'var(--muted)') }}
        >
          {isExpired
            ? '⛔ Account expired (2 weeks over)'
            : `⏳ Account expires in ${fmtLong(exp.leftMs)}`}
        </div>
      )}

      <button
        className="btn"
        style={{ marginTop: 12, width: '100%' }}
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

  async function refreshNow() {
    setRefreshing(true);
    await fetch('/api/refresh', { method: 'POST', body: '{}' });
    await load();
    setRefreshing(false);
  }

  // Live API check happens on page load/refresh, and again on "Check now".
  // No background polling anymore — 5h/weekly/expiry countdowns are pure
  // clock math and tick locally every second regardless.
  useEffect(() => { refreshNow(); }, []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="wrap">
      <div className="topbar">
        <div>
          <h1>Aerolink Usage Panel</h1>
          <div className="sub">{accounts.length} account{accounts.length !== 1 ? 's' : ''} · live-checks on page load &amp; Check now</div>
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
        5-hour reset is calculated from your saved reset time (fixed 5h cycle) — always exact, no API needed.
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

function StartEditor({ acc, onSaved, getPw }) {
  // datetime-local wants "YYYY-MM-DDTHH:mm"
  const toLocalInput = (iso) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d)) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const startOriginal = toLocalInput(acc.startAt);
  const resetOriginal = toLocalInput(acc.resetAt);
  const [start, setStart] = useState(startOriginal);
  const [reset, setReset] = useState(resetOriginal);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const dirty = start !== startOriginal || reset !== resetOriginal;

  async function save() {
    if (!getPw().trim()) { setErr('Upar password daalo'); setTimeout(() => setErr(''), 1800); return; }
    setSaving(true); setErr('');
    const startIso = start ? new Date(start).toISOString() : null;
    const resetIso = reset ? new Date(reset).toISOString() : null;
    const res = await fetch('/api/accounts', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: acc.id, startAt: startIso, resetAt: resetIso, password: getPw() }),
    });
    setSaving(false);
    if (!res.ok) { setErr('Wrong password'); setTimeout(() => setErr(''), 1800); return; }
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
    onSaved && onSaved();
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div className="m" style={{ marginBottom: 3 }}>Start date/time (2-week &amp; weekly count)</div>
      <div className="start-edit-row">
        <input
          type="datetime-local"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className="start-input"
        />
      </div>
      <div className="m" style={{ marginTop: 8, marginBottom: 3 }}>5-hour reset time</div>
      <div className="start-edit-row">
        <input
          type="datetime-local"
          value={reset}
          onChange={(e) => setReset(e.target.value)}
          className="start-input"
        />
        <button
          className="btn primary sm"
          onClick={save}
          disabled={saving || !dirty}
          title={dirty ? 'Save changes' : 'Koi change nahi'}
        >
          {saving ? '…' : saved ? '✓' : 'Save'}
        </button>
      </div>
      <div className="m" style={{ marginTop: 4, color: err ? 'var(--red)' : saved ? 'var(--green)' : undefined }}>
        {err ? err : saved ? '✓ saved' : dirty ? 'Save dabao changes lagane ke liye' : ' '}
      </div>
    </div>
  );
}

function Settings({ onClose }) {
  const [list, setList] = useState([]);
  const [name, setName] = useState('');
  const [key, setKey] = useState('');
  const [start, setStart] = useState('');
  const [reset, setReset] = useState('');
  const [pw, setPw] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const getPw = () => pw;

  const reload = useCallback(async () => {
    const a = await fetch('/api/accounts').then((r) => r.json());
    setList(a.accounts);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  async function add() {
    if (!name.trim() || !key.trim()) return;
    if (!pw.trim()) { setErr('Password daalo'); return; }
    setSaving(true); setErr('');
    const iso = start ? new Date(start).toISOString() : null;
    const resetIso = reset ? new Date(reset).toISOString() : null;
    const res = await fetch('/api/accounts', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, key, startAt: iso, resetAt: resetIso, password: pw }),
    });
    setSaving(false);
    if (!res.ok) { setErr('Wrong password'); return; }
    setName(''); setKey(''); setStart(''); setReset('');
    await reload();
  }

  async function del(id, accName) {
    if (!pw.trim()) { setErr('Delete karne ke liye upar password daalo'); return; }
    // Confirm so a saved account isn't deleted by accident
    const ok = window.confirm(`Pakka "${accName}" account delete karna hai?\n\nYeh wapas nahi aayega.`);
    if (!ok) return;
    setErr('');
    const res = await fetch('/api/accounts', {
      method: 'DELETE',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, password: pw }),
    });
    if (!res.ok) { setErr('Wrong password'); return; }
    await reload();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Accounts</h2>
          <button className="btn sm" onClick={onClose}>✕</button>
        </div>

        <div className="field pw-field">
          <label>🔒 Password (add / delete / edit ke liye)</label>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="password daalo" />
        </div>

        <div className="settings-cols">
          {/* LEFT: saved accounts, scrollable */}
          <div className="settings-left">
            <div className="col-title">Saved accounts ({list.length})</div>
            <div className="acct-list">
              {list.length === 0 && <div className="m" style={{ padding: '8px 0' }}>Abhi koi account nahi.</div>}
              {list.map((a) => (
                <div className="acct-row" key={a.id}>
                  <div className="acct-top">
                    <div className="info">
                      <div className="an">{a.name}</div>
                      <div className="m">{a.keyMasked}</div>
                    </div>
                    <div className="acct-btns">
                      <CopyBtn id={a.id} />
                      <button className="btn danger sm" onClick={() => del(a.id, a.name)}>Delete</button>
                    </div>
                  </div>
                  <StartEditor acc={a} onSaved={reload} getPw={getPw} />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: add new */}
          <div className="settings-right">
            <div className="col-title">Add new account</div>
            <div className="field">
              <label>Account name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Main account" />
            </div>
            <div className="field">
              <label>API key</label>
              <input value={key} onChange={(e) => setKey(e.target.value)} placeholder="aero_live_..." />
            </div>
            <div className="field">
              <label>Start date &amp; time (jab account/key mili)</label>
              <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="field">
              <label>5-hour reset time (koi bhi ek exact reset moment)</label>
              <input type="datetime-local" value={reset} onChange={(e) => setReset(e.target.value)} />
              <div className="m" style={{ marginTop: 4 }}>Isi se har 5 ghante ka agla reset apne aap ginta rahega.</div>
            </div>

            {err && <div style={{ color: 'var(--red)', fontSize: 13, marginBottom: 10 }}>{err}</div>}

            <button className="btn primary block" onClick={add} disabled={saving}>
              {saving ? 'Adding…' : '+ Add account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
