// Pure game logic (no DOM), shared by the page and the unit tests.

export const LEN = 5;

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

/** Picks the next answer, avoiding the most recent ones. Returns [choice, updatedRecentList]. */
export function pickAnswer(answers, recent, recentMax, rand = Math.random) {
  let pool = answers.filter(([w]) => !recent.includes(w));
  if (!pool.length) pool = answers;
  const choice = pool[Math.floor(rand() * pool.length)];
  return [choice, [choice[0], ...recent].slice(0, Math.min(recentMax, answers.length - 1))];
}

export const SITE_URL = "https://fourthmeridiangames.com/hatama/";
const EMOJI = { correct: "🟥", present: "🟨", absent: "⬛" };

/** What Share copies: the result ("3/5" or "X/5"), the coloured rows and the address. Never the word itself. */
export function shareText(outcome, rows) {
  const grid = rows.map((r) => r.map((s) => EMOJI[s]).join("")).join("\n");
  return `Hatama ${outcome} · Batak Toba\n${grid}\n${SITE_URL}`;
}
