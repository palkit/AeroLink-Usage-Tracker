// Live-checks one account (or all) and stores the current state.
// Reset timing is NOT estimated here anymore — it is computed on the client
// from each account's fixed 5-hour reset anchor (resetAt). This just records
// whether the key is available (green) or the limit is reached (red) right now.
import { checkKey } from './checker.js';
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
    status[acc.id] = {
      state: result.state,
      window: result.window,
      usedAllowance: result.usedAllowance,
      message: result.message,
      checkedAt: now,
    };
  }

  await setStatus(status);
  return status;
}
