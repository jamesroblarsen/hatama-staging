// Pure game logic (no DOM), shared by the page, the build tools and the unit tests.

export const LEN = 5;
export const ROWS = 5;     // five guesses: see sim/GUESS_BALANCE.md

/** Colour feedback for one guess: "correct" | "present" | "absent" per letter. Handles repeated letters. */
export function score(guess, target) {
  const res = Array(LEN).fill("absent");
  const left = {};
  for (let i = 0; i < LEN; i++) {
    if (guess[i] === target[i]) res[i] = "correct";
    else left[target[i]] = (left[target[i]] || 0) + 1;
  }
  for (let i = 0; i < LEN; i++) {
    if (res[i] !== "correct" && left[guess[i]]) { res[i] = "present"; left[guess[i]]--; }
  }
  return res;
}

// ---------- the daily word
// One word a day, the same for everyone. Day 1 is the calendar's epoch; a day starts at the player's own midnight.

const MS_DAY = 86400000;
const utcOf = (ymd) => { const [y, m, d] = ymd.split("-").map(Number); return Date.UTC(y, m - 1, d); };

/** The day number (1 on the epoch) of a calendar date "YYYY-MM-DD". */
export const dayOfDate = (epoch, ymd) => Math.round((utcOf(ymd) - utcOf(epoch)) / MS_DAY) + 1;

/** The calendar date "YYYY-MM-DD" of day n. */
export const dateOfDay = (epoch, n) => new Date(utcOf(epoch) + (n - 1) * MS_DAY).toISOString().slice(0, 10);

/** Today's day number on the player's own clock. */
export function localDay(epoch, now = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return dayOfDate(epoch, `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`);
}

/** Today's day number in a time zone (the publish step pins every day already started anywhere: Pacific/Kiritimati, UTC+14). */
export function dayInZone(epoch, now, timeZone) {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return dayOfDate(epoch, ymd);
}

/** Milliseconds until the player's next midnight, when the next word comes. */
export function msToMidnight(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next - now;
}

/** The word for day n. Past the end of the calendar it wraps round (the calendar runs for years, so it shouldn't). */
export const wordOfDay = (days, n) => days[(((n - 1) % days.length) + days.length) % days.length];

// The published calendar (daily.json) is lightly scrambled, so the coming words aren't readable at a glance.
const KEY = "hatama";
const xor = (s) => [...s].map((c, i) => String.fromCharCode(c.charCodeAt(0) ^ KEY.charCodeAt(i % KEY.length))).join("");
export const encodeDays = (days) => btoa(xor(days.join(",")));
export const decodeDays = (text) => xor(atob(text)).split(",");

// ---------- statistics
export const emptyStats = () => ({ played: 0, won: 0, streak: 0, best: 0, dist: [0, 0, 0, 0, 0], lastDay: 0, lastWon: 0 });

/** Records a finished day once (a second call for the same day changes nothing). tries is 1..5 when won. */
export function recordResult(stats, day, won, tries) {
  const s = { ...emptyStats(), ...stats, dist: [...(stats?.dist ?? [0, 0, 0, 0, 0])] };
  if (s.lastDay >= day) return s;
  s.played++;
  s.lastDay = day;
  if (won) {
    s.won++;
    s.streak = s.lastWon === day - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best, s.streak);
    s.lastWon = day;
    s.dist[tries - 1]++;
  } else {
    s.streak = 0;
  }
  return s;
}

/** The streak as it stands on day `today`: broken if yesterday's word wasn't solved. */
export const currentStreak = (stats, today) => (stats.lastWon >= today - 1 ? stats.streak : 0);

// ---------- share
export const SITE_URL = "https://fourthmeridiangames.com/hatama/";
const EMOJI = { correct: "🟥", present: "🟨", absent: "⬛" };

/** What Share copies: the day, the result ("3/5" or "X/5"), the coloured rows and the address. Never the word itself. */
export function shareText(day, outcome, rows) {
  const grid = rows.map((r) => r.map((s) => EMOJI[s]).join("")).join("\n");
  return `Hatama #${day} ${outcome} · Batak Toba\n${grid}\n${SITE_URL}`;
}
