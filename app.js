const STORAGE_KEY = "rbc:readLog";
const PENDING_KEY = "rbc:pending";

const els = {
  chapter: document.getElementById("chapter-display"),
  getBtn: document.getElementById("get-btn"),
  markBtn: document.getElementById("mark-btn"),
  skipBtn: document.getElementById("skip-btn"),
  progressText: document.getElementById("progress-text"),
  progressBar: document.getElementById("progress-bar"),
  historyList: document.getElementById("history-list"),
  resetBtn: document.getElementById("reset-btn"),
  emptyState: document.getElementById("empty-state"),
  actionRow: document.getElementById("action-row"),
};

const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((sum, [, count]) => sum + count, 0);

function allChapterKeys() {
  const keys = [];
  for (const [book, count] of BIBLE_BOOKS) {
    for (let ch = 1; ch <= count; ch++) keys.push(`${book} ${ch}`);
  }
  return keys;
}

function loadReadSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadSet(set) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
}

function loadPending() {
  return localStorage.getItem(PENDING_KEY);
}

function savePending(key) {
  if (key === null) localStorage.removeItem(PENDING_KEY);
  else localStorage.setItem(PENDING_KEY, key);
}

// Uniform random integer in [0, max) using the Web Crypto API (rejection
// sampling avoids the modulo bias a plain `% max` would introduce).
function secureRandomInt(max) {
  const range = Math.floor(4294967296 / max) * max; // largest multiple of max <= 2^32
  const buf = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= range);
  return value % max;
}

function pickRandomUnread(readSet, excludeKey) {
  let unread = allChapterKeys().filter((k) => !readSet.has(k));
  if (unread.length === 0) return null;
  if (excludeKey) {
    const withoutExclude = unread.filter((k) => k !== excludeKey);
    if (withoutExclude.length > 0) unread = withoutExclude;
  }
  return unread[secureRandomInt(unread.length)];
}

function render() {
  const readSet = loadReadSet();
  let pending = loadPending();

  // Self-heal state left over from an older version of the app (or a
  // corrupted/edited storage) where reading history exists but there's no
  // chapter queued up — without this, the Get button would stay hidden
  // (since `started` is true) with no way left to fetch a new chapter.
  if (pending === null && readSet.size > 0 && readSet.size < TOTAL_CHAPTERS) {
    pending = pickRandomUnread(readSet);
    savePending(pending);
  }

  const started = pending !== null || readSet.size > 0;

  els.progressText.textContent = `${readSet.size} / ${TOTAL_CHAPTERS} chapters read`;
  els.progressBar.style.width = `${(readSet.size / TOTAL_CHAPTERS) * 100}%`;

  els.chapter.textContent = pending || "Press the button to get a chapter";
  els.getBtn.hidden = started;
  els.actionRow.hidden = pending === null;
  els.emptyState.hidden = readSet.size < TOTAL_CHAPTERS;

  renderHistory(readSet);
}

function renderHistory(readSet) {
  els.historyList.innerHTML = "";
  const items = [...readSet].sort((a, b) => {
    const [bookA, chA] = splitKey(a);
    const [bookB, chB] = splitKey(b);
    const idxA = BIBLE_BOOKS.findIndex(([b]) => b === bookA);
    const idxB = BIBLE_BOOKS.findIndex(([b]) => b === bookB);
    return idxA - idxB || chA - chB;
  });
  for (const key of items) {
    const li = document.createElement("li");
    li.textContent = key;
    els.historyList.appendChild(li);
  }
}

function splitKey(key) {
  const lastSpace = key.lastIndexOf(" ");
  return [key.slice(0, lastSpace), Number(key.slice(lastSpace + 1))];
}

function handleGet() {
  const readSet = loadReadSet();
  const next = pickRandomUnread(readSet);
  savePending(next);
  render();
}

function handleMark() {
  const pending = loadPending();
  if (!pending) return;
  const readSet = loadReadSet();
  readSet.add(pending);
  saveReadSet(readSet);
  savePending(pickRandomUnread(readSet));
  render();
}

function handleSkip() {
  const pending = loadPending();
  const readSet = loadReadSet();
  savePending(pickRandomUnread(readSet, pending));
  render();
}

function handleReset() {
  if (!confirm("Clear your entire reading history and start a new cycle?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
  render();
}

els.getBtn.addEventListener("click", handleGet);
els.markBtn.addEventListener("click", handleMark);
els.skipBtn.addEventListener("click", handleSkip);
els.resetBtn.addEventListener("click", handleReset);

render();
