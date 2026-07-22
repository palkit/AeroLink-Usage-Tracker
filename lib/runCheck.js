// Live-checks one account (or all) and stores the current state.
// Reset timing is NOT estimated here anymore — it is computed on the client
// from each account's fixed 5-hour reset anchor (resetAt). This just records
// whether the key is available (green) or the limit is reached (red) right now.
//
// The $55 weekly allowance is a separate, bigger pool than the $8 5-hour
// window: once Aerolink reports the weekly cap hit, it stays hit for the
// rest of that 7-day week regardless of what later 5h-window checks say —
// the 5h reset only refills the small sub-quota, not the weekly pool.
import { checkKey } from './checker.js';
import { getAccounts, getStatus, setStatus } from './storage.js';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// 1-indexed week number from account start, matching the client's weekly().
function weekNoFor(startAt, now) {
  if (!startAt) return null;
  const start = new Date(startAt).getTime();
  if (isNaN(start)) return null;
  const elapsed = now - start;
  if (elapsed < 0) return null;
  return Math.floor(elapsed / WEEK_MS) + 1;
}

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
    const curWeekNo = weekNoFor(acc.startAt, now);

    // Carry the weekly-cap flag over only while we're still in the same week.
    let weeklyCapHit = !!(prev.weeklyCapHit && prev.weeklyCapWeekNo === curWeekNo);
    let weeklyCapWeekNo = weeklyCapHit ? prev.weeklyCapWeekNo : curWeekNo;

    if (result.state === 'red' && result.window === 'weekly') {
      weeklyCapHit = true;
      weeklyCapWeekNo = curWeekNo;
    }

    status[acc.id] = {
      state: result.state,
      window: result.window,
      usedAllowance: result.usedAllowance,
      message: result.message,
      checkedAt: now,
      weeklyCapHit,
      weeklyCapWeekNo,
    };
  }

  await setStatus(status);
  return status;
}
