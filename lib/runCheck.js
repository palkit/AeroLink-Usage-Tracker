// Runs a check for one account and updates stored status, preserving the
// "first seen red" timestamp so we can estimate the reset countdown.
import { checkKey, WINDOW_MS } from './checker.js';
import { getAccounts, getStatus, setStatus } from './storage.js';

export async function runCheck(accountId) {
  const accounts = await getAccounts();
  const status = await getStatus();
  const now = Date.now();

  const toCheck = accountId
    ? accounts.filter((a) => a.id === accountId)
    : accounts;

  for (const acc of toCheck) {
    const result = await checkKey(acc.key);
    const prev = status[acc.id] || {};

    let redSince = prev.redSince || null;
    let estReset = null;

    if (result.state === 'red') {
      // keep the earliest red timestamp for this window; reset if window changed
      if (!redSince || prev.window !== result.window) redSince = now;
      const dur = WINDOW_MS[result.window];
      if (dur) estReset = redSince + dur;
    } else {
      redSince = null; // green/error clears the red timer
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

  await setStatus(status);
  return status;
}
