let _YAKU_LIST_NODE = null;
if (typeof module !== "undefined" && module.exports) {
  _YAKU_LIST_NODE = require("./data.js").YAKU_LIST;
}
function getYakuList() {
  return _YAKU_LIST_NODE || YAKU_LIST;
}

const STORAGE_KEYS = {
  daily: "jongdle:daily:v1",
  stats: "jongdle:stats:v1",
  practice: "jongdle:practice:v1",
  theme: "jongdle:theme:v1",
  introSeen: "jongdle:introSeen:v1",
};

const MAX_ATTEMPTS = 8;
const KST_OFFSET_MIN = 9 * 60;

function todayKstString() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const kst = new Date(utcMs + KST_OFFSET_MIN * 60000);
  const y = kst.getFullYear();
  const m = String(kst.getMonth() + 1).padStart(2, "0");
  const d = String(kst.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pickDailyYaku(dateStr) {
  const list = getYakuList();
  const idx = hashString(`jongdle-${dateStr}`) % list.length;
  return list[idx];
}

function pickRandomYaku(excludeId) {
  const list = getYakuList();
  let pool = list;
  if (excludeId && list.length > 1) {
    pool = list.filter((y) => y.id !== excludeId);
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx];
}

function compareHands(guessSortedWithNulls, targetSorted) {
  const n = targetSorted.length;
  const result = new Array(n).fill("pending");
  const counts = {};
  for (let i = 0; i < n; i++) {
    const g = guessSortedWithNulls[i];
    if (g == null) continue;
    if (g === targetSorted[i]) {
      result[i] = "correct";
    }
  }
  const targetRemaining = {};
  for (let i = 0; i < n; i++) {
    if (result[i] === "correct") continue;
    const t = targetSorted[i];
    targetRemaining[t] = (targetRemaining[t] || 0) + 1;
  }
  for (let i = 0; i < n; i++) {
    const g = guessSortedWithNulls[i];
    if (g == null || result[i] === "correct") continue;
    if (targetRemaining[g] > 0) {
      result[i] = "present";
      targetRemaining[g]--;
    } else {
      result[i] = "absent";
    }
  }
  return result;
}

function isWinningHand(guessSorted, targetSorted) {
  if (guessSorted.length !== targetSorted.length) return false;
  return guessSorted.every((t, i) => t === targetSorted[i]);
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
  }
}

function loadStats() {
  const s = loadJSON(STORAGE_KEYS.stats, {
    played: 0,
    wins: 0,
    currentStreak: 0,
    maxStreak: 0,
    distribution: new Array(MAX_ATTEMPTS).fill(0),
  });
  if (!Array.isArray(s.distribution) || s.distribution.length !== MAX_ATTEMPTS) {
    const old = Array.isArray(s.distribution) ? s.distribution : [];
    const next = new Array(MAX_ATTEMPTS).fill(0);
    for (let i = 0; i < Math.min(old.length, MAX_ATTEMPTS); i++) next[i] = old[i] || 0;
    s.distribution = next;
  }
  return s;
}

function saveStats(stats) {
  saveJSON(STORAGE_KEYS.stats, stats);
}

function recordResult(won, attemptsUsed) {
  const stats = loadStats();
  stats.played += 1;
  if (won) {
    stats.wins += 1;
    stats.currentStreak += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.distribution[Math.min(attemptsUsed, MAX_ATTEMPTS) - 1] += 1;
  } else {
    stats.currentStreak = 0;
  }
  saveStats(stats);
  return stats;
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    compareHands,
    isWinningHand,
    pickDailyYaku,
    pickRandomYaku,
    hashString,
    todayKstString,
    MAX_ATTEMPTS,
  };
}
