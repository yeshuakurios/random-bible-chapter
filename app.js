const STORAGE_KEY = "rbc:readLog";
const PENDING_KEY = "rbc:pending";
const ACHIEVEMENTS_KEY = "rbc:achievements";

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
  todayCount: document.getElementById("today-count"),
  todayList: document.getElementById("today-list"),
  trendText: document.getElementById("trend-text"),
  achievementsCount: document.getElementById("achievements-count"),
  achievementsList: document.getElementById("achievements-list"),
  bookMap: document.getElementById("book-map"),
  toastContainer: document.getElementById("toast-container"),
};

const TOTAL_CHAPTERS = BIBLE_BOOKS.reduce((sum, [, count]) => sum + count, 0);
const BOOK_INDEX = new Map(BIBLE_BOOKS.map(([name], i) => [name, i]));
const OT_BOOKS = BIBLE_BOOKS.slice(0, 39);
const NT_BOOKS = BIBLE_BOOKS.slice(39);
const OT_TOTAL = OT_BOOKS.reduce((sum, [, count]) => sum + count, 0);
const NT_TOTAL = NT_BOOKS.reduce((sum, [, count]) => sum + count, 0);
const HALFWAY = Math.round(TOTAL_CHAPTERS / 2);
const MILESTONES = [1, 10, 25, 50, 100, 250, HALFWAY, 750, 1000, TOTAL_CHAPTERS];
const TREND_WINDOW_DAYS = 7;

function allChapterKeys() {
  const keys = [];
  for (const [book, count] of BIBLE_BOOKS) {
    for (let ch = 1; ch <= count; ch++) keys.push(`${book} ${ch}`);
  }
  return keys;
}

function splitKey(key) {
  const lastSpace = key.lastIndexOf(" ");
  return [key.slice(0, lastSpace), Number(key.slice(lastSpace + 1))];
}

// --- Read log: an append-only array of { k: chapterKey, t: timestamp }.
// Order doubles as "the exact order chapters were read in". `t` is null for
// entries migrated from an older version of the app that didn't record time.

function loadReadLog() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (parsed.length > 0 && typeof parsed[0] === "string") {
      const migrated = parsed.map((k) => ({ k, t: null }));
      saveReadLog(migrated);
      return migrated;
    }
    return parsed;
  } catch {
    return [];
  }
}

function saveReadLog(log) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

function readKeysSet(log) {
  return new Set(log.map((e) => e.k));
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

function computeBookCounts(readSet) {
  const counts = new Map();
  for (const key of readSet) {
    const [book] = splitKey(key);
    counts.set(book, (counts.get(book) || 0) + 1);
  }
  return counts;
}

// --- Daily stats

function localDateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function computeDayCounts(log) {
  const counts = new Map();
  for (const { t } of log) {
    if (t == null) continue;
    const key = localDateKey(new Date(t));
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function computeTodayEntries(log) {
  const todayKey = localDateKey(new Date());
  return log.filter((e) => e.t != null && localDateKey(new Date(e.t)) === todayKey);
}

function computeTrend(dayCounts, remaining) {
  if (remaining <= 0) return { done: true };
  const now = new Date();
  let sum = 0;
  for (let i = 0; i < TREND_WINDOW_DAYS; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    sum += dayCounts.get(localDateKey(d)) || 0;
  }
  const avgPerDay = sum / TREND_WINDOW_DAYS;
  if (avgPerDay <= 0) return { done: false, avgPerDay: 0 };
  const daysLeft = Math.ceil(remaining / avgPerDay);
  const finishDate = new Date(now);
  finishDate.setDate(finishDate.getDate() + daysLeft);
  return { done: false, avgPerDay, daysLeft, finishDate };
}

// --- Achievements

function loadAchievements() {
  try {
    const raw = localStorage.getItem(ACHIEVEMENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveAchievements(list) {
  localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(list));
}

function milestoneLabel(n) {
  if (n === TOTAL_CHAPTERS) return "You've read the entire Bible! 🏆";
  if (n === HALFWAY) return `Halfway through the Bible — ${n} chapters! 🎉`;
  if (n === 1) return "First chapter read! 🎉";
  return `${n} chapters read!`;
}

function computeNewBadges(newReadSet, markedKey) {
  const unlocked = new Set(loadAchievements().map((a) => a.id));
  const newBadges = [];
  const n = newReadSet.size;

  for (const m of MILESTONES) {
    if (n === m) {
      const id = `milestone-${m}`;
      if (!unlocked.has(id)) newBadges.push({ id, label: milestoneLabel(m) });
    }
  }

  const [book] = splitKey(markedKey);
  const bookCounts = computeBookCounts(newReadSet);
  const bookTotal = BIBLE_BOOKS.find(([b]) => b === book)[1];
  if (bookCounts.get(book) === bookTotal) {
    const id = `book-${book}`;
    if (!unlocked.has(id)) newBadges.push({ id, label: `Finished the book of ${book}! 📖` });
  }

  const isOT = BOOK_INDEX.get(book) < OT_BOOKS.length;
  const testamentBooks = isOT ? OT_BOOKS : NT_BOOKS;
  const testamentTotal = isOT ? OT_TOTAL : NT_TOTAL;
  const testamentReadCount = testamentBooks.reduce((sum, [b]) => sum + (bookCounts.get(b) || 0), 0);
  if (testamentReadCount === testamentTotal) {
    const name = isOT ? "Old Testament" : "New Testament";
    const id = `testament-${name}`;
    if (!unlocked.has(id)) newBadges.push({ id, label: `Finished the ${name}! 🎉` });
  }

  return newBadges;
}

function persistAchievements(newBadges) {
  if (newBadges.length === 0) return;
  const list = loadAchievements();
  const now = Date.now();
  for (const badge of newBadges) list.push({ ...badge, at: now });
  saveAchievements(list);
}

function showToasts(newBadges) {
  newBadges.forEach((badge, i) => {
    setTimeout(() => {
      const toast = document.createElement("div");
      toast.className = "toast";
      toast.textContent = badge.label;
      els.toastContainer.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add("show"));
      setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => toast.remove(), 300);
      }, 3600);
    }, i * 400);
  });
}

// --- Rendering

function render() {
  const log = loadReadLog();
  const readSet = readKeysSet(log);
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

  renderToday(log);
  renderTrend(log, readSet);
  renderHistory(readSet);
  renderAchievements();
  renderBookMap(readSet);
}

function renderToday(log) {
  const todayEntries = computeTodayEntries(log);
  els.todayCount.textContent = `${todayEntries.length} chapter${todayEntries.length === 1 ? "" : "s"} read today`;

  els.todayList.innerHTML = "";
  if (todayEntries.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No chapters read yet today — get started!";
    els.todayList.appendChild(li);
    return;
  }
  todayEntries.forEach((entry, i) => {
    const li = document.createElement("li");
    li.textContent = `${i + 1}. ${entry.k}`;
    els.todayList.appendChild(li);
  });
}

function renderTrend(log, readSet) {
  const remaining = TOTAL_CHAPTERS - readSet.size;
  const dayCounts = computeDayCounts(log);
  const trend = computeTrend(dayCounts, remaining);

  if (trend.done) {
    els.trendText.textContent = "🎉 You've read the whole Bible!";
    return;
  }
  if (trend.avgPerDay <= 0) {
    els.trendText.textContent = "Read a few chapters over the next few days to see your pace and a projected finish date.";
    return;
  }
  const dateLabel = trend.finishDate.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const rate = trend.avgPerDay.toFixed(1);
  const days = trend.daysLeft;
  els.trendText.textContent = `At your recent pace (~${rate} chapters/day over the last ${TREND_WINDOW_DAYS} days), you'll finish the whole Bible in about ${days} day${days === 1 ? "" : "s"} — around ${dateLabel}.`;
}

function renderHistory(readSet) {
  els.historyList.innerHTML = "";
  const items = [...readSet].sort((a, b) => {
    const [bookA, chA] = splitKey(a);
    const [bookB, chB] = splitKey(b);
    return BOOK_INDEX.get(bookA) - BOOK_INDEX.get(bookB) || chA - chB;
  });
  for (const key of items) {
    const li = document.createElement("li");
    li.textContent = key;
    els.historyList.appendChild(li);
  }
}

function renderAchievements() {
  const list = [...loadAchievements()].reverse();
  els.achievementsCount.textContent = list.length > 0 ? `(${list.length})` : "";
  els.achievementsList.innerHTML = "";
  if (list.length === 0) {
    const li = document.createElement("li");
    li.className = "muted";
    li.textContent = "No achievements yet — start reading to unlock some!";
    els.achievementsList.appendChild(li);
    return;
  }
  for (const badge of list) {
    const li = document.createElement("li");
    const dateLabel = new Date(badge.at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    li.textContent = `${badge.label} — ${dateLabel}`;
    els.achievementsList.appendChild(li);
  }
}

function abbreviateBook(name) {
  if (/^[123] /.test(name)) return name[0] + name.slice(2, 4);
  return name.slice(0, 3);
}

function renderBookGroup(container, books, bookCounts) {
  for (const [book, total] of books) {
    const read = bookCounts.get(book) || 0;
    const pct = Math.round((read / total) * 100);
    const cell = document.createElement("div");
    cell.className = "book-cell";
    cell.style.setProperty("--pct", `${pct}%`);
    cell.title = `${book}: ${read} / ${total} chapters read`;
    const label = document.createElement("span");
    label.textContent = abbreviateBook(book);
    cell.appendChild(label);
    container.appendChild(cell);
  }
}

function renderBookMap(readSet) {
  const bookCounts = computeBookCounts(readSet);
  els.bookMap.innerHTML = "";

  const otHeading = document.createElement("h3");
  otHeading.textContent = "Old Testament";
  els.bookMap.appendChild(otHeading);
  const otGrid = document.createElement("div");
  otGrid.className = "book-grid";
  renderBookGroup(otGrid, OT_BOOKS, bookCounts);
  els.bookMap.appendChild(otGrid);

  const ntHeading = document.createElement("h3");
  ntHeading.textContent = "New Testament";
  els.bookMap.appendChild(ntHeading);
  const ntGrid = document.createElement("div");
  ntGrid.className = "book-grid";
  renderBookGroup(ntGrid, NT_BOOKS, bookCounts);
  els.bookMap.appendChild(ntGrid);
}

// --- Event handlers

function handleGet() {
  const readSet = readKeysSet(loadReadLog());
  savePending(pickRandomUnread(readSet));
  render();
}

function handleMark() {
  const pending = loadPending();
  if (!pending) return;
  const log = loadReadLog();
  log.push({ k: pending, t: Date.now() });
  saveReadLog(log);

  const newReadSet = readKeysSet(log);
  const newBadges = computeNewBadges(newReadSet, pending);
  persistAchievements(newBadges);

  savePending(pickRandomUnread(newReadSet));
  render();
  showToasts(newBadges);
}

function handleSkip() {
  const pending = loadPending();
  const readSet = readKeysSet(loadReadLog());
  savePending(pickRandomUnread(readSet, pending));
  render();
}

function handleReset() {
  if (!confirm("Clear your entire reading history, achievements, and start a new cycle?")) return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(PENDING_KEY);
  localStorage.removeItem(ACHIEVEMENTS_KEY);
  render();
}

els.getBtn.addEventListener("click", handleGet);
els.markBtn.addEventListener("click", handleMark);
els.skipBtn.addEventListener("click", handleSkip);
els.resetBtn.addEventListener("click", handleReset);

render();
