import { ANSWERS, GUESSES } from "./words.7875ce6cfc.js";
import { LEN, score, pickAnswer, shareText } from "./logic.42e4884841.js";
import { toBatak } from "./batak.b5467b840b.js";

const ROWS = 5;            // five guesses: see sim/GUESS_BALANCE.md
const RECENT_MAX = 120;               // don't repeat an answer within this many rounds
const VALID = new Set(GUESSES);
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
let answer, info, row, col, grid, over, keyState, results, outcome;

function nextAnswer() {
  const [choice, recent] = pickAnswer(ANSWERS, store.get("recent", []), RECENT_MAX);
  store.set("recent", recent);
  return choice;
}

function newGame() {
  [answer, ...info] = nextAnswer();
  row = 0; col = 0; over = false;
  grid = Array.from({ length: ROWS }, () => Array(LEN).fill(""));
  keyState = {};
  results = []; outcome = null;
  $("result").hidden = true;
  kbEl.hidden = false;
  buildBoard();
  buildKeyboard();
  renderStats();
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
  results.push(res);
  res.forEach((s, c) => {
    const t = tileAt(row, c);
    setTimeout(() => { t.classList.add(s, "reveal"); }, c * 120);
    if (!keyState[guess[c]] || RANK[s] > RANK[keyState[guess[c]]]) keyState[guess[c]] = s;
  });
  const doneRow = row;
  setTimeout(paintKeys, LEN * 120 + 200);
  if (guess === answer) {
    over = true;
    setTimeout(() => {
      for (let c = 0; c < LEN; c++) setTimeout(() => tileAt(doneRow, c).classList.add("win"), c * 80);
      finish(true, doneRow + 1);
    }, LEN * 120 + 250);
    return;
  }
  row++; col = 0;
  if (row === ROWS) { over = true; setTimeout(() => finish(false), LEN * 120 + 250); }
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

// ---------- end of round
function finish(won, tries, skipped = false) {
  const st = store.get("stats", { played: 0, won: 0, streak: 0, best: 0 });
  st.played++;
  if (won) { st.won++; st.streak++; st.best = Math.max(st.best, st.streak); } else st.streak = 0;
  store.set("stats", st);

  outcome = skipped ? null : won ? `${tries}/${ROWS}` : `X/${ROWS}`;
  $("share-btn").hidden = !outcome || !results.length;
  const [en, id] = info;
  $("result-head").textContent = won
    ? `Horas! Solved in ${tries}/${ROWS}`
    : skipped ? "Skipped — the word was" : "The word was";
  $("result-batak").textContent = toBatak(answer) ?? "";
  $("result-batak").title = "Surat Batak (Toba script)";
  $("result-word").textContent = answer;
  $("result-en").textContent = en;
  $("result-id").textContent = id ? `Bahasa Indonesia: ${id}` : "";
  $("result").hidden = false;
  kbEl.hidden = true;
  // small phones: bring the whole card (script, meaning, Next button) into view
  $("result").scrollIntoView({ block: "nearest", behavior: "smooth" });
  renderStats();
  $("next-btn").focus({ preventScroll: true });
}

function renderStats() {
  const st = store.get("stats", { played: 0, won: 0, streak: 0, best: 0 });
  $("stats").textContent = st.played
    ? `Played ${st.played} · won ${Math.round((100 * st.won) / st.played)}% · streak ${st.streak} · best ${st.best}`
    : `${ANSWERS.length} answer words · ${GUESSES.length.toLocaleString()} accepted guesses`;
}

function skip() {
  if (over) { newGame(); return; }
  over = true;
  finish(false, 0, true);
}

// ---------- share: the coloured grid and the address, never the word (shareText is in logic.js)
async function share() {
  if (!outcome) return;
  const text = shareText(outcome, results);
  const touch = matchMedia("(pointer: coarse)").matches;
  if (touch && navigator.share) {
    try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  try { await navigator.clipboard.writeText(text); toast("Copied to clipboard"); }
  catch { toast("Couldn't copy: your browser blocked it"); }
}

// ---------- input
function press(key) {
  if (over) { if (key === "Enter") newGame(); return; }
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
$("new-btn").addEventListener("click", (e) => { e.currentTarget.blur(); newGame(); });
$("skip-btn").addEventListener("click", (e) => { e.currentTarget.blur(); skip(); });
$("next-btn").addEventListener("click", newGame);
$("share-btn").addEventListener("click", share);
$("help-btn").addEventListener("click", () => $("help").showModal());

newGame();
if (!store.get("seenHelp", false)) { store.set("seenHelp", true); $("help").showModal(); }
