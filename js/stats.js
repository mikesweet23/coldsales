// Derived numbers for Today and Tracker
import { addDays, today, ymd, isWeekend, tsToYmd, mondayOf, weekdayOf } from './util.js';

export const OUTREACH = ['call', 'email', 'linkedin_connect', 'linkedin_engage', 'linkedin_message', 'mushroom'];
export const GROUP_OF = {
  call: 'calls', email: 'emails',
  linkedin_connect: 'linkedin', linkedin_engage: 'linkedin', linkedin_message: 'linkedin',
  mushroom: 'mushroom',
};
export const CONVERSATION_OUTCOMES = ['spoke_not_now', 'spoke_follow_up', 'meeting', 'not_interested'];

export function outreachOnly(activities) { return activities.filter((a) => OUTREACH.includes(a.type)); }

export function countsByDay(activities) {
  const map = new Map();
  for (const a of outreachOnly(activities)) {
    const d = tsToYmd(a.timestamp);
    const row = map.get(d) || { total: 0, calls: 0, emails: 0, linkedin: 0, mushroom: 0, items: [] };
    row.total += 1;
    row[GROUP_OF[a.type]] += 1;
    row.items.push(a);
    map.set(d, row);
  }
  return map;
}

export function todayCounts(activities) {
  const row = countsByDay(activities).get(today());
  return row || { total: 0, calls: 0, emails: 0, linkedin: 0, mushroom: 0, items: [] };
}

// Consecutive outreach days. Weekends without activity don't break the streak,
// and a weekday with nothing logged *yet* today doesn't break it either.
export function computeStreak(activities) {
  const days = new Set(outreachOnly(activities).map((a) => tsToYmd(a.timestamp)));
  let d = today();
  if (!days.has(d)) d = addDays(d, -1);
  let streak = 0;
  for (let i = 0; i < 2000; i++) {
    if (days.has(d)) streak++;
    else if (!isWeekend(d)) break;
    d = addDays(d, -1);
  }
  return streak;
}

export function weekRange(offsetWeeks = 0, from = today()) {
  const start = addDays(mondayOf(from), offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function totalsFor(activities, days) {
  const set = new Set(days);
  const t = { calls: 0, emails: 0, linkedin: 0, mushroom: 0, conversations: 0, meetings: 0 };
  for (const a of outreachOnly(activities)) {
    if (!set.has(tsToYmd(a.timestamp))) continue;
    t[GROUP_OF[a.type]] += 1;
    if (a.type === 'call') {
      if (CONVERSATION_OUTCOMES.includes(a.outcome)) t.conversations += 1;
      if (a.outcome === 'meeting') t.meetings += 1;
    }
  }
  return t;
}

export function plannedWeekdays(settings) { return new Set((settings.callDays || []).map((c) => c.weekday)); }
export function isPlannedDay(settings, day) { return plannedWeekdays(settings).has(weekdayOf(day)); }
export { ymd };
