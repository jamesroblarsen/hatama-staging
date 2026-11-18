import { ANSWERS, GUESSES } from "./words.7875ce6cfc.js";
import { LEN, ROWS, score, localDay, msToMidnight, wordOfDay, decodeDays, emptyStats, recordResult, currentStreak, shareText } from "./logic.dc356edd6f.js";
import { toBatak } from "./batak.b5467b840b.js";

// One word a day, the same for everyone; a new day starts at the player's own midnight. The calendar is daily.json,
// built from calendar.json (tools/build_calendar.mjs) and pinned on publish so the day in progress never changes.
const VALID = new Set(GUESSES);
const MEANING = new Map(ANSWERS.map(([w, en, id]) => [w, [en, id]]));
const ANSWER_LETTERS = new Set(ANSWERS.flatMap(([w]) => [...w]));
const ALL_LETTERS = new Set(GUESSES.join(""));

const $ = (id) => document.getElementById(id);
const boardEl = $("board"), kbEl = $("keyboard"), toastEl = $("toast");

// ---------- storage (optional; the game works without it)
const store = {
  get(k, d) { try { const v = localStorage.getItem("hata:" + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("hata:" + k, JSON.stringify(v)); } catch { /* ignore */ } },
};

// ---------- state
let calendar;                       // { epoch, days }
let day, answer, guesses, results, row, col, grid, over, won, keyState;

function startDay() {
  day = Math.max(1, localDay(calendar.epoch));
  answer = wordOfDay(calendar.days, day);
  const saved = store.get(`day:${day}`, { guesses: [] });
  guesses = saved.guesses.filter((g) => VALID.has(g)).slice(0, ROWS);
  results = guesses.map((g) => score(g, answer));
  row = guesses.length; col = 0; keyState = {};
  grid = Array.from({ length: ROWS }, (_, r) => (guesses[r] ? [...guesses[r]] : Array(LEN).fill("")));
  won = guesses.includes(answer);
  over = won || guesses.length === ROWS;
  $("day-num").textContent = `#${day}`;
  $("result").hidden = true;
  $("crowd").hidden = true;
  kbEl.hidden = false;
  buildBoard();
  buildKeyboard();
  guesses.forEach((g, r) => results[r].forEach((s, c) => {
    tileAt(r, c).classList.add(s);
    if (!keyState[g[c]] || RANK[s] > RANK[keyState[g[c]]]) keyState[g[c]] = s;
  }));
  paintKeys();
  renderStats();
  if (over) finish(false);
}

// ---------- rendering
function buildBoard() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "row";
    rowEl.setAttribute("role", "row");
    for (let c = 0; c < LEN; c++) {
      const t = document.createElement("div");
      t.className = "tile";
      t.setAttribute("role", "gridcell");
      t.textContent = grid[r][c];
      if (grid[r][c]) t.classList.add("filled");
      rowEl.appendChild(t);
    }
    boardEl.appendChild(rowEl);
  }
}

const LAYOUT = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"];

function buildKeyboard() {
  kbEl.innerHTML = "";
  for (const line of LAYOUT) {
    const r = document.createElement("div");
    r.className = "krow";
    for (const ch of line) {
      const b = document.createElement("button");
      b.type = "button";
      if (ch === "+") { b.textContent = "Enter"; b.className = "key wide"; b.dataset.key = "Enter"; }
      else if (ch === "-") { b.textContent = "⌫"; b.className = "key wide"; b.dataset.key = "Backspace"; b.setAttribute("aria-label", "Backspace"); }
      else {
        if (!ALL_LETTERS.has(ch)) continue;             // q, x: no Toba word uses them
        b.textContent = ch; b.className = "key"; b.dataset.key = ch;
        if (!ANSWER_LETTERS.has(ch)) { b.classList.add("loan"); b.title = "Only in loanwords; never in an answer"; }
      }
      r.appendChild(b);
    }
    kbEl.appendChild(r);
  }
}

function tileAt(r, c) { return boardEl.children[r].children[c]; }

function paintRow() {
  for (let c = 0; c < LEN; c++) {
    const t = tileAt(row, c);
    t.textContent = grid[row][c];
    t.classList.toggle("filled", !!grid[row][c]);
  }
}

let toastTimer;
function toast(msg, ms = 1400) {
  toastEl.textContent = msg;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { toastEl.classList.remove("show"); toastEl.textContent = ""; }, ms);
}

// ---------- scoring lives in logic.js (score handles repeated letters)
const RANK = { absent: 1, present: 2, correct: 3 };

function submit() {
  const guess = grid[row].join("");
  if (guess.length < LEN) { shake(); toast("Not enough letters"); return; }
  if (!VALID.has(guess)) { shake(); toast("Not in the word list"); return; }
  const res = score(guess, answer);
  guesses.push(guess);
  results.push(res);
  store.set(`day:${day}`, { guesses });
  if (guess === answer || guesses.length === ROWS) reportPlay(day, guess === answer, guesses.length);
  res.forEach((s, c) => {
    const t = tileAt(row, c);
    setTimeout(() => { t.classList.add(s, "reveal"); }, c * 120);
    if (!keyState[guess[c]] || RANK[s] > RANK[keyState[guess[c]]]) keyState[guess[c]] = s;
  });
  const doneRow = row;
  setTimeout(paintKeys, LEN * 120 + 200);
  if (guess === answer) {
    over = true; won = true;
    setTimeout(() => {
      for (let c = 0; c < LEN; c++) setTimeout(() => tileAt(doneRow, c).classList.add("win"), c * 80);
      finish(true);
    }, LEN * 120 + 250);
    return;
  }
  row++; col = 0;
  if (row === ROWS) { over = true; setTimeout(() => finish(true), LEN * 120 + 250); }
}

function paintKeys() {
  kbEl.querySelectorAll(".key").forEach((k) => {
    const s = keyState[k.dataset.key];
    k.classList.remove("correct", "present", "absent");
    if (s) k.classList.add(s);
  });
}

function shake() {
  const el = boardEl.children[row];
  el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
}

// ---------- end of the day's round
function finish(justNow) {
  const stats = recordResult(store.get("daily-stats", emptyStats()), day, won, guesses.length);
  store.set("daily-stats", stats);

  const [en, id] = MEANING.get(answer) ?? ["", ""];
  $("result-head").textContent = won ? `Horas! Solved in ${guesses.length}/${ROWS}` : "The word was";
  $("result-batak").textContent = toBatak(answer) ?? "";
  $("result-batak").title = "Surat Batak (Toba script)";
  $("result-word").textContent = answer;
  $("result-en").textContent = en;
  $("result-id").textContent = id ? `Bahasa Indonesia: ${id}` : "";
  $("result").hidden = false;
  kbEl.hidden = true;
  renderStats();
  tickCountdown();
  showCrowd(day);
  if (justNow) {
    // small phones: bring the whole card (script, meaning, Share) into view
    $("result").scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("share-btn").focus({ preventScroll: true });
  }
}

// Count finished games, in totals only: puzzle number, solved or not, and guesses. No ID, no cookie; the Worker
// (games-hub/pulse, POST /v1/play) adds 1 to that day's counts and answers with the puzzle's totals, which the
// result card shows. Live site only, and skipped under GPC or Do Not Track. Sent once per round, the moment the
// last guess is saved: reloading a finished round never calls this (it reads the totals with GET /v1/stats instead).
const PULSE = "https://pulse.fourthmeridiangames.com";
let reported = null;                // { day, totals: Promise } for the round just finished on this page

function reportPlay(n, solved, tries) {
  try {
    if (location.hostname !== "fourthmeridiangames.com" || /-staging\//.test(location.pathname) || navigator.webdriver) return;
    if (navigator.globalPrivacyControl || navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
    const body = JSON.stringify({ g: "hatama", n, won: solved, tries });
    // Plain text needs no CORS preflight; keepalive lets it finish if the page is closed straight away.
    const sent = fetch(`${PULSE}/v1/play`, { method: "POST", body, keepalive: true, mode: "cors", credentials: "omit" })
      .then((r) => (r.ok ? r.json() : null));
    reported = { day: n, totals: sent.catch(() => null) };
  } catch { /* counting must never break the game */ }
}

// ---------- everyone's results for the day (totals only, like Trendle's crowd scores)
async function fetchCrowd(n) {
  try {
    const r = await fetch(`${PULSE}/v1/stats?g=hatama&n=${n}`, { credentials: "omit", signal: AbortSignal.timeout(10000) });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

async function showCrowd(n) {
  const saved = store.get(`crowd:${n}`, null);
  if (saved) renderCrowd(saved);
  const fresh = await ((reported?.day === n && (await reported.totals)) || fetchCrowd(n));
  if (n !== day) return;              // the page moved on to a new day meanwhile
  if (fresh && fresh.n === n) {
    store.set(`crowd:${n}`, fresh);
    renderCrowd(fresh);
  }
}

function renderCrowd(c) {
  const box = $("crowd");
  if (!c || !c.players) { box.hidden = true; return; }
  const counted = c.solved + c.failed;
  const pct = (k) => Math.round((100 * k) / counted);
  $("crowd-day").textContent = c.n;
  $("crowd-head").innerHTML = `<strong>${c.players.toLocaleString()}</strong> ${c.players === 1 ? "player" : "players"}`
    + (counted ? ` · <strong>${pct(c.solved)}%</strong> solved` : "");
  const mine = over ? (won ? guesses.length : "X") : null;
  const rows = [...c.dist.map((k, i) => [String(i + 1), k]), ["X", c.failed]];
  const max = Math.max(1, ...rows.map(([, k]) => k));
  $("crowd-dist").innerHTML = counted
    ? rows.map(([label, k]) => `<li${String(mine) === label ? ' class="today"' : ""}><span>${label}</span><b style="width:${Math.max(8, (100 * k) / max)}%">${pct(k)}%</b></li>`).join("")
    : "";
  box.hidden = false;
}

function renderStats() {
  const st = store.get("daily-stats", emptyStats());
  $("stats").textContent = st.played
    ? `Played ${st.played} · won ${Math.round((100 * st.won) / st.played)}% · streak ${currentStreak(st, day)} · best ${st.best}`
    : "A new word every day at midnight";
  const max = Math.max(1, ...st.dist);
  $("dist").innerHTML = st.dist
    .map((n, i) => `<li${over && won && guesses.length === i + 1 ? ' class="today"' : ""}><span>${i + 1}</span><b style="width:${Math.max(8, (100 * n) / max)}%">${n}</b></li>`)
    .join("");
}

// ---------- the next word
function tickCountdown() {
  const ms = msToMidnight();
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  $("next-in").textContent = `Next word in ${h}h ${String(m).padStart(2, "0")}m`;
}
// A page left open past midnight moves on to the new day.
setInterval(() => {
  if (!calendar) return;
  if (localDay(calendar.epoch) !== day) startDay();
  else if (over) tickCountdown();
}, 30000);
document.addEventListener("visibilitychange", () => {
  if (calendar && !document.hidden && localDay(calendar.epoch) !== day) startDay();
});

// ---------- share: the day, the coloured grid and the address, never the word (shareText is in logic.js)
async function share() {
  if (!over) return;
  const text = shareText(day, won ? `${guesses.length}/${ROWS}` : `X/${ROWS}`, results);
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
  catch { toast("Couldn't copy: your browser blocked it"); }
}

// ---------- input
function press(key) {
  if (over || !calendar) return;
  if (key === "Enter") return submit();
  if (key === "Backspace") {
    if (col > 0) { col--; grid[row][col] = ""; paintRow(); }
    return;
  }
  if (/^[a-z]$/.test(key) && ALL_LETTERS.has(key) && col < LEN) {
    grid[row][col] = key; col++; paintRow();
  }
}

document.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || $("help").open) return;
  const k = e.key === "Enter" || e.key === "Backspace" ? e.key : e.key.toLowerCase();
  if (k === "Enter" || k === "Backspace" || /^[a-z]$/.test(k)) {
    e.preventDefault();
    press(k);
  }
});
kbEl.addEventListener("click", (e) => {
  const b = e.target.closest("button[data-key]");
  if (b) { press(b.dataset.key); b.blur(); }
});
$("share-btn").addEventListener("click", share);
$("help-btn").addEventListener("click", () => $("help").showModal());

// ---------- start: load the calendar, then today's word
async function load() {
  try {
    const res = await fetch("daily.json", { cache: "no-cache" });
    if (res.ok) {
      const raw = await res.json();
      calendar = { epoch: raw.epoch, days: decodeDays(raw.days) };
    } else {
      // a local preview of the source folder has the plain calendar.json instead (never published)
      const plain = await fetch("calendar.json", { cache: "no-cache" });
      if (!plain.ok) throw new Error(`HTTP ${res.status}`);
      calendar = await plain.json();
    }
  } catch {
    toast("Couldn't load today's word. Check your connection and reload.", 0);
    return;
  }
  startDay();
}
if (!store.get("seenHelp", false)) { store.set("seenHelp", true); $("help").showModal(); }
load();
