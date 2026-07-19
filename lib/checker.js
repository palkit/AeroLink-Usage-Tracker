// Pings aerolink with an account key and interprets the result.
// 200 => green (limit available). 402 => red (limit reached) — the error text
// tells us which window (5-hour vs weekly) and the used allowance.

const CAPI_URL = 'https://capi.aerolink.lat/v1/messages';

// window durations in ms, used to estimate reset time from when we first saw red
export const WINDOW_MS = {
  '5h': 5 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

function parseLimit(errText) {
  const text = (errText || '').toLowerCase();
  let window = null;
  if (text.includes('5-hour') || text.includes('5 hour')) window = '5h';
  else if (text.includes('week')) window = 'weekly';

  // grab a dollar amount like $8.00 / $55.00
  const m = errText && errText.match(/\$([0-9]+(?:\.[0-9]+)?)/);
  const usedAllowance = m ? parseFloat(m[1]) : null;

  return { window, usedAllowance };
}

// Returns: { state:'green'|'red'|'error', window, usedAllowance, message }
export async function checkKey(apiKey) {
  try {
    const res = await fetch(CAPI_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
    });

    if (res.status === 200) {
      return { state: 'green', window: null, usedAllowance: null, message: 'Active' };
    }

    let body = {};
    try { body = await res.json(); } catch {}
    const errText = body.error || body.message || `HTTP ${res.status}`;

    if (res.status === 402) {
      const { window, usedAllowance } = parseLimit(errText);
      return { state: 'red', window, usedAllowance, message: errText };
    }

    if (res.status === 401 || res.status === 403) {
      return { state: 'error', window: null, usedAllowance: null, message: 'Invalid key' };
    }

    return { state: 'error', window: null, usedAllowance: null, message: errText };
  } catch (e) {
    return { state: 'error', window: null, usedAllowance: null, message: 'Network error' };
  }
}
