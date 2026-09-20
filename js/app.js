(function () {
  "use strict";

  const els = {
    currentInput: document.querySelector(".current-input"),
    currentGuessRow: document.getElementById("current-guess-row"),
    yakuPopup: document.getElementById("yaku-popup"),
    yakuPopupChips: document.getElementById("yaku-popup-chips"),
    yakuPopupScore: document.getElementById("yaku-popup-score"),
    history: document.getElementById("history"),
    palette: document.getElementById("palette"),
    yakuBoard: document.getElementById("yaku-board"),
    puzzleLabel: document.getElementById("puzzle-label"),
    attemptLabel: document.getElementById("attempt-label"),
    btnNewPractice: document.getElementById("btn-new-practice"),
    btnViewResult: document.getElementById("btn-view-result"),
    resultModal: document.getElementById("result-modal"),
    resultStatus: document.getElementById("result-status"),
    btnCloseResult: document.getElementById("btn-close-result"),
    answerTilesRow: document.getElementById("answer-tiles-row"),
    btnShare: document.getElementById("btn-share"),
    btnShareX: document.getElementById("btn-share-x"),
    btnNext: document.getElementById("btn-next"),
    btnClear: document.getElementById("btn-clear"),
    btnSubmit: document.getElementById("btn-submit"),
    modeTabs: Array.from(document.querySelectorAll(".mode-tab")),
    btnHelp: document.getElementById("btn-help"),
    btnStats: document.getElementById("btn-stats"),
    btnTheme: document.getElementById("btn-theme"),
    themeIcon: document.getElementById("theme-icon"),
    backdrop: document.getElementById("modal-backdrop"),
    helpModal: document.getElementById("help-modal"),
    statsModal: document.getElementById("stats-modal"),
    btnCloseHelp: document.getElementById("btn-close-help"),
    btnCloseStats: document.getElementById("btn-close-stats"),
    statsGrid: document.getElementById("stats-grid"),
    statsDist: document.getElementById("stats-dist"),
  };

  const YAKU_MAP = Object.fromEntries(YAKU_LIST.map((y) => [y.id, y]));
  const YAKU_ORDER = YAKU_LIST.map((y) => y.id);
  const ALL_TILE_CODES = [
    ...Array.from({ length: 9 }, (_, i) => `${i + 1}m`),
    ...Array.from({ length: 9 }, (_, i) => `${i + 1}p`),
    ...Array.from({ length: 9 }, (_, i) => `${i + 1}s`),
    ...Array.from({ length: 7 }, (_, i) => `${i + 1}z`),
  ];

  function pickDoraTiles() {
    const count = 1 + Math.floor(Math.random() * 4);
    const pool = [...ALL_TILE_CODES];
    const picked = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return picked;
  }

  function orderYakuIds(idIterable) {
    const set = idIterable instanceof Set ? idIterable : new Set(idIterable);
    return YAKU_ORDER.filter((id) => set.has(id));
  }
  const SUBMIT_LABEL_DEFAULT = "제출";
  const SUBMIT_LABEL_NO_YAKU = "화료 불가";

  function yakuTooltip(id) {
    const y = YAKU_MAP[id];
    return `${y.han} — ${y.desc}`;
  }

  const RELATED_GROUPS = [
    ...YakuEngine.FAMILIES.map(([looseId, strictId]) => [looseId, strictId]),
    ["yakuhai_haku", "yakuhai_hatsu", "yakuhai_chun", "shousangen", "daisangen"],
  ];

  const HAN_SCORE_TABLE = {
    1: 1500,
    2: 2900,
    3: 5800,
    4: 11600,
    5: 12000,
    6: 18000,
    7: 18000,
    8: 24000,
    9: 24000,
    10: 24000,
    11: 36000,
    12: 36000,
  };
  const YAKUMAN_SCORE = 48000;

  function countDoraInHand(tiles) {
    if (!tiles || state.doraTiles.length === 0) return 0;
    return tiles.reduce((sum, t) => sum + (state.doraTiles.includes(t) ? 1 : 0), 0);
  }

  function totalScoreForIds(idIterable, tiles) {
    const list = [...idIterable];
    if (list.length === 0) return 0;
    const yakumanIds = list.filter((id) => YAKU_MAP[id].category === "역만");
    if (yakumanIds.length > 0) {
      return yakumanIds.reduce(
        (sum, id) => sum + (YAKU_MAP[id].doubleYakuman ? YAKUMAN_SCORE * 2 : YAKUMAN_SCORE),
        0
      );
    }
    const doraHan = countDoraInHand(tiles);
    const totalHan = list.reduce((sum, id) => sum + (YAKU_MAP[id].hanValue || 1), 0) + doraHan;
    const han = Math.min(Math.max(totalHan, 1), 12);
    return HAN_SCORE_TABLE[han] || HAN_SCORE_TABLE[12];
  }

  function formatScore(score) {
    return `${score.toLocaleString("ko-KR")}점`;
  }

  const SCORE_WORD_TABLE = {
    12000: "만관",
    18000: "하네만",
    24000: "배만",
    36000: "삼배만",
    [YAKUMAN_SCORE]: "역만",
    [YAKUMAN_SCORE * 2]: "더블역만",
  };
  const NATIVE_MULTIPLIER_WORDS = [
    null,
    "한", "두", "세", "네", "다섯", "여섯", "일곱", "여덟", "아홉", "열",
    "열한", "열두", "열세", "열네", "열다섯", "열여섯", "열일곱", "열여덟", "열아홉", "스무",
  ];
  function multiplierYakumanWord(n) {
    const word = NATIVE_MULTIPLIER_WORDS[n];
    return word ? `${word} 배 역만` : `${n}배 역만`;
  }
  function formatScoreWord(score) {
    if (SCORE_WORD_TABLE[score]) return SCORE_WORD_TABLE[score];
    if (score > 0 && score % YAKUMAN_SCORE === 0) {
      return multiplierYakumanWord(score / YAKUMAN_SCORE);
    }
    return formatScore(score);
  }

  const state = {
    mode: "daily",
    yaku: null,
    targetSorted: [],
    targetTopTier: new Set(),
    targetRelated: new Set(),
    targetTotalScore: 0,
    attempts: [],
    currentGuess: [],
    status: "playing",
    doraTiles: [],
  };

  function computeTargetYakuInfo() {
    const raw = YakuEngine.getSatisfiedYaku(state.targetSorted);
    const topTier = YakuEngine.resolveDisplayYaku(raw);
    const related = new Set();
    raw.forEach((id) => {
      if (!topTier.has(id)) related.add(id);
    });
    RELATED_GROUPS.forEach((group) => {
      if (group.some((id) => topTier.has(id))) {
        group.forEach((id) => {
          if (!topTier.has(id)) related.add(id);
        });
      }
    });
    state.targetTopTier = topTier;
    state.targetRelated = related;
    state.targetTotalScore = totalScoreForIds(topTier, state.targetSorted);
  }

  function init() {
    initTheme();
    buildPalette();
    wireEvents();
    startDaily();
    maybeShowIntro();
  }

  function maybeShowIntro() {
    const seen = loadJSON(STORAGE_KEYS.introSeen, false);
    if (seen) return;
    openModal(els.helpModal);
    saveJSON(STORAGE_KEYS.introSeen, true);
  }

  function initTheme() {
    const saved = loadJSON(STORAGE_KEYS.theme, null);
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
    updateThemeIcon();
  }

  function updateThemeIcon() {
    const attr = document.documentElement.getAttribute("data-theme");
    const isDark = attr
      ? attr === "dark"
      : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    els.themeIcon.textContent = isDark ? "☀" : "☾";
  }

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const currentlyDark = current
      ? current === "dark"
      : window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const next = currentlyDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    saveJSON(STORAGE_KEYS.theme, next);
    updateThemeIcon();
  }

  function buildPalette() {
    const rows = { m: 9, p: 9, s: 9, z: 7 };
    Object.entries(rows).forEach(([suit, count]) => {
      const rowEl = els.palette.querySelector(`.palette-row[data-suit="${suit}"]`);
      for (let n = 1; n <= count; n++) {
        const code = `${n}${suit}`;
        const meta = tileMeta(code);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "tile-btn";
        btn.dataset.tile = code;
        btn.setAttribute("aria-label", `${meta.sr} 선택`);
        btn.innerHTML = `${TileArt.tileFaceSVG(code)}<span class="count-badge" hidden></span>`;
        btn.addEventListener("click", () => addTile(code));
        rowEl.appendChild(btn);
      }
    });
  }

  function wireEvents() {
    els.btnClear.addEventListener("click", () => {
      if (state.status !== "playing") return;
      state.currentGuess = [];
      render();
    });
    els.btnSubmit.addEventListener("click", submitGuess);

    els.modeTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const mode = tab.dataset.mode;
        if (mode === state.mode) return;
        state.mode = mode;
        els.modeTabs.forEach((t) => t.setAttribute("aria-selected", String(t === tab)));
        els.btnNewPractice.hidden = mode !== "practice";
        if (mode === "daily") {
          startDaily();
        } else {
          startPractice();
        }
      });
    });

    els.btnNewPractice.addEventListener("click", startPractice);
    els.btnNext.addEventListener("click", startPractice);
    els.btnShare.addEventListener("click", shareResult);
    els.btnShareX.addEventListener("click", shareToX);

    els.btnHelp.addEventListener("click", () => openModal(els.helpModal));
    els.btnCloseHelp.addEventListener("click", closeModals);
    els.btnStats.addEventListener("click", () => {
      renderStats();
      openModal(els.statsModal);
    });
    els.btnCloseStats.addEventListener("click", closeModals);
    els.btnViewResult.addEventListener("click", () => openModal(els.resultModal));
    els.btnCloseResult.addEventListener("click", closeModals);
    els.backdrop.addEventListener("click", (e) => {
      if (e.target === els.backdrop) closeModals();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModals();
    });

    els.btnTheme.addEventListener("click", toggleTheme);
  }

  function openModal(modalEl) {
    els.backdrop.hidden = false;
    els.helpModal.hidden = modalEl !== els.helpModal;
    els.statsModal.hidden = modalEl !== els.statsModal;
    els.resultModal.hidden = modalEl !== els.resultModal;
  }
  function closeModals() {
    els.backdrop.hidden = true;
    els.helpModal.hidden = true;
    els.statsModal.hidden = true;
    els.resultModal.hidden = true;
  }

  function startDaily() {
    closeModals();
    const today = todayKstString();
    const saved = loadJSON(STORAGE_KEYS.daily, null);
    const yaku = pickDailyYaku(today);
    const isContinuing = !!(saved && saved.date === today && saved.yakuId === yaku.id);
    state.mode = "daily";
    state.yaku = yaku;
    state.targetSorted = sortHand(yaku.tiles);

    if (isContinuing) {
      state.attempts = saved.attempts || [];
      state.status = saved.status || "playing";
      state.doraTiles = saved.doraTiles && saved.doraTiles.length > 0 ? saved.doraTiles : pickDoraTiles();
    } else {
      state.attempts = [];
      state.status = "playing";
      state.doraTiles = pickDoraTiles();
    }
    computeTargetYakuInfo();
    if (!isContinuing) {
      saveJSON(STORAGE_KEYS.daily, {
        date: today,
        yakuId: yaku.id,
        attempts: [],
        status: "playing",
        doraTiles: state.doraTiles,
      });
    }
    state.currentGuess = [];
    render();
  }

  function startPractice(excludeId) {
    closeModals();
    state.mode = "practice";
    state.doraTiles = pickDoraTiles();
    const yaku = pickRandomYaku(excludeId || (state.yaku && state.yaku.id));
    state.yaku = yaku;
    state.targetSorted = sortHand(yaku.tiles);
    computeTargetYakuInfo();
    state.attempts = [];
    state.currentGuess = [];
    state.status = "playing";
    render();
  }

  function persistDaily() {
    if (state.mode !== "daily") return;
    saveJSON(STORAGE_KEYS.daily, {
      date: todayKstString(),
      yakuId: state.yaku.id,
      attempts: state.attempts,
      status: state.status,
      doraTiles: state.doraTiles,
    });
  }

  function countInGuess(code) {
    return state.currentGuess.filter((t) => t === code).length;
  }

  function addTile(code) {
    if (state.status !== "playing") return;
    if (state.currentGuess.length >= TILE_LENGTH) return;
    if (countInGuess(code) >= 4) return;
    state.currentGuess.push(code);
    state.currentGuess = sortHand(state.currentGuess);
    render();
  }

  function removeTileAt(code) {
    const idx = state.currentGuess.indexOf(code);
    if (idx === -1) return;
    state.currentGuess.splice(idx, 1);
    render();
  }

  function isCurrentGuessUnwinnable() {
    if (state.currentGuess.length !== TILE_LENGTH) return false;
    return YakuEngine.getSatisfiedYaku(state.currentGuess).size === 0;
  }

  function submitGuess() {
    if (state.status !== "playing") return;
    if (state.currentGuess.length !== TILE_LENGTH) return;
    if (isCurrentGuessUnwinnable()) return;
    const statuses = compareHands(state.currentGuess, state.targetSorted);
    const rawIds = [...YakuEngine.getSatisfiedYaku(state.currentGuess)];
    const guessTopTier = YakuEngine.resolveDisplayYaku(new Set(rawIds));
    const attempt = {
      tiles: [...state.currentGuess],
      statuses,
      rawIds,
      yakuResult: buildYakuResult(rawIds),
      totalScore: totalScoreForIds(guessTopTier, state.currentGuess),
    };
    state.attempts.push(attempt);

    let justEnded = false;
    if (isWinningHand(state.currentGuess, state.targetSorted)) {
      state.status = "won";
      justEnded = true;
    } else if (state.attempts.length >= MAX_ATTEMPTS) {
      state.status = "lost";
      justEnded = true;
    }
    state.currentGuess = [];

    if (state.mode === "daily") {
      persistDaily();
      if (justEnded) recordResult(state.status === "won", state.attempts.length);
    }
    render();
    if (justEnded) {
      openModal(els.resultModal);
    }
  }

  function buildYakuResult(rawIds) {
    const guessTopTier = YakuEngine.resolveDisplayYaku(new Set(rawIds));
    const orderedIds = orderYakuIds(guessTopTier);
    return orderedIds.map((id) => ({
      id,
      name: YAKU_MAP[id].name,
      color: state.targetTopTier.has(id) ? "green" : state.targetRelated.has(id) ? "orange" : "gray",
    }));
  }

  function collectDiscoveredYaku() {
    const green = new Set();
    const orange = new Set();
    const triedGray = new Set();
    state.attempts.forEach((a) => {
      (a.yakuResult || []).forEach((r) => {
        if (r.color === "green") green.add(r.id);
        else if (r.color === "orange") orange.add(r.id);
        else triedGray.add(r.id);
      });
    });
    return { green, orange, triedGray };
  }

  function findTileHintUnlockIndex() {
    if (state.targetTopTier.size === 0) return -1;
    for (let i = 0; i < state.attempts.length; i++) {
      const result = state.attempts[i].yakuResult || [];
      if (result.length === state.targetTopTier.size && result.every((r) => r.color === "green")) {
        return i;
      }
    }
    return -1;
  }

  function tileInclusionStatuses(guessSorted, targetSorted) {
    const targetCounts = {};
    targetSorted.forEach((t) => {
      targetCounts[t] = (targetCounts[t] || 0) + 1;
    });
    return guessSorted.map((t) => {
      if (targetCounts[t] > 0) {
        targetCounts[t] -= 1;
        return "included";
      }
      return "excluded";
    });
  }

  function computePaletteTileKnowledge() {
    const unlockIndex = findTileHintUnlockIndex();
    const knowledge = {};
    if (unlockIndex === -1) return knowledge;
    const maxIncluded = {};
    const exactCount = {};
    for (let i = unlockIndex; i < state.attempts.length; i++) {
      const attempt = state.attempts[i];
      if (isWinningHand(attempt.tiles, state.targetSorted)) {
        const targetCounts = {};
        state.targetSorted.forEach((t) => {
          targetCounts[t] = (targetCounts[t] || 0) + 1;
        });
        ALL_TILE_CODES.forEach((code) => {
          exactCount[code] = targetCounts[code] || 0;
        });
        continue;
      }
      const statuses = tileInclusionStatuses(attempt.tiles, state.targetSorted);
      const includedCountThisAttempt = {};
      const excludedSeenThisAttempt = {};
      attempt.tiles.forEach((t, ti) => {
        if (statuses[ti] === "included") {
          includedCountThisAttempt[t] = (includedCountThisAttempt[t] || 0) + 1;
        } else {
          excludedSeenThisAttempt[t] = true;
        }
      });
      Object.keys(includedCountThisAttempt).forEach((code) => {
        maxIncluded[code] = Math.max(maxIncluded[code] || 0, includedCountThisAttempt[code]);
      });
      Object.keys(excludedSeenThisAttempt).forEach((code) => {
        exactCount[code] = includedCountThisAttempt[code] || 0;
      });
    }
    const allCodes = new Set([...Object.keys(maxIncluded), ...Object.keys(exactCount)]);
    allCodes.forEach((code) => {
      if (Object.prototype.hasOwnProperty.call(exactCount, code)) {
        knowledge[code] = exactCount[code] > 0 ? "green" : "gray";
      } else if ((maxIncluded[code] || 0) > 0) {
        knowledge[code] = "green";
      }
    });
    return knowledge;
  }

  function render() {
    renderPuzzleInfo();
    els.currentInput.hidden = state.status !== "playing";
    renderCurrentGuessRow();
    renderYakuPopup();
    renderYakuBoard();
    renderPalette();
    renderControls();
    renderHistory();
    renderResult();
  }

  function renderYakuPopup() {
    if (state.status !== "playing" || state.currentGuess.length !== TILE_LENGTH) {
      els.yakuPopup.hidden = true;
      els.yakuPopupChips.innerHTML = "";
      if (els.yakuPopupScore) {
        els.yakuPopupScore.hidden = true;
        els.yakuPopupScore.textContent = "";
      }
      return;
    }
    const raw = YakuEngine.getSatisfiedYaku(state.currentGuess);
    const topTier = YakuEngine.resolveDisplayYaku(raw);
    const { green, orange, triedGray } = collectDiscoveredYaku();
    els.yakuPopupChips.innerHTML = "";
    if (topTier.size === 0) {
      const span = document.createElement("span");
      span.className = "yaku-chip-empty";
      span.textContent = "성립하는 역이 없어요 (화료 불가)";
      els.yakuPopupChips.appendChild(span);
    } else {
      orderYakuIds(topTier).forEach((id) => {
        const chip = document.createElement("span");
        const cls = green.has(id)
          ? "yaku-chip-correct"
          : orange.has(id)
          ? "yaku-chip-orange"
          : triedGray.has(id)
          ? "yaku-chip-gray"
          : "yaku-chip-neutral";
        chip.className = `yaku-chip ${cls}`;
        chip.textContent = YAKU_MAP[id].name;
        chip.title = yakuTooltip(id);
        els.yakuPopupChips.appendChild(chip);
      });
    }
    if (els.yakuPopupScore) {
      if (topTier.size === 0) {
        els.yakuPopupScore.hidden = true;
        els.yakuPopupScore.textContent = "";
      } else {
        const selfScore = totalScoreForIds(topTier, state.currentGuess);
        els.yakuPopupScore.hidden = false;
        els.yakuPopupScore.textContent = `화료 시 점수: ${formatScoreWord(selfScore)}`;
        els.yakuPopupScore.title = "지금 이 손패만 보고 계산한 점수예요(정답과는 비교하지 않음).";
      }
    }
    els.yakuPopup.hidden = false;
  }

  function renderYakuBoard() {
    const { green, orange, triedGray } = collectDiscoveredYaku();
    els.yakuBoard.innerHTML = "";
    YAKU_ORDER.forEach((id) => {
      const y = YAKU_MAP[id];
      const chip = document.createElement("span");
      chip.className = "yaku-board-chip";
      if (green.has(id)) chip.classList.add("yaku-board-green");
      else if (orange.has(id)) chip.classList.add("yaku-board-orange");
      else if (triedGray.has(id)) chip.classList.add("yaku-board-tried-gray");
      else chip.classList.add("yaku-board-gray");
      chip.textContent = y.name;
      chip.title = yakuTooltip(id);
      els.yakuBoard.appendChild(chip);
    });
  }

  function renderPuzzleInfo() {
    els.puzzleLabel.textContent =
      state.mode === "daily" ? `오늘의 역 · ${todayKstString()}` : "연습 문제";
    els.attemptLabel.textContent = `시도 ${state.attempts.length}/${MAX_ATTEMPTS}`;
    els.btnViewResult.hidden = state.status === "playing";
    els.btnViewResult.classList.remove("badge-success", "badge-fail");
    if (state.status === "won") {
      els.btnViewResult.textContent = "🎉 성공! 결과 보기";
      els.btnViewResult.classList.add("badge-success");
    } else if (state.status === "lost") {
      els.btnViewResult.textContent = "😵 실패 · 결과 보기";
      els.btnViewResult.classList.add("badge-fail");
    } else {
      els.btnViewResult.textContent = "결과 보기";
    }
  }

  function makeTileSlot(code, removable, hintStatus, showDora) {
    const slot = document.createElement(removable ? "button" : "div");
    slot.className = "tile-slot";
    if (removable) slot.type = "button";
    if (!code) {
      slot.classList.add("is-empty");
      return slot;
    }
    const meta = tileMeta(code);
    slot.innerHTML = TileArt.tileFaceSVG(code);
    let title = removable ? `${meta.fullLabel} (눌러서 빼기)` : meta.fullLabel;
    if (hintStatus === "included") {
      slot.classList.add("tile-included");
      title += " — 정답에 포함";
    } else if (hintStatus === "excluded") {
      slot.classList.add("tile-excluded");
      title += " — 정답에 미포함";
    }
    if (showDora && state.doraTiles.includes(code)) {
      slot.classList.add("tile-slot-dora");
      title += " — 도라";
    }
    slot.setAttribute("title", title);
    if (removable) {
      slot.addEventListener("click", () => removeTileAt(code));
      slot.setAttribute("aria-label", `${meta.sr} 빼기`);
    } else {
      slot.setAttribute("aria-label", meta.fullLabel);
    }
    return slot;
  }

  function renderCurrentGuessRow() {
    els.currentGuessRow.innerHTML = "";
    if (state.status !== "playing") return;
    const padded = [...state.currentGuess];
    while (padded.length < TILE_LENGTH) padded.push(null);
    padded.forEach((t) => els.currentGuessRow.appendChild(makeTileSlot(t, !!t)));
  }

  function renderHistory() {
    els.history.innerHTML = "";
    const total = state.attempts.length;
    const hintUnlockIndex = findTileHintUnlockIndex();
    for (let i = total - 1; i >= 0; i--) {
      const a = state.attempts[i];
      const block = document.createElement("div");
      block.className = "attempt-block";

      const idx = document.createElement("span");
      idx.className = "row-index";
      idx.textContent = String(i + 1);
      block.appendChild(idx);

      const row = document.createElement("div");
      row.className = "guess-row";
      const hintActive = hintUnlockIndex !== -1 && i >= hintUnlockIndex;
      const inclusionStatuses = hintActive ? tileInclusionStatuses(a.tiles, state.targetSorted) : null;
      a.tiles.forEach((t, ti) => {
        row.appendChild(makeTileSlot(t, false, hintActive ? inclusionStatuses[ti] : null, true));
      });
      block.appendChild(row);

      const totalScore =
        a.totalScore != null
          ? a.totalScore
          : totalScoreForIds(YakuEngine.resolveDisplayYaku(new Set(a.rawIds || [])), a.tiles);
      const scoreCmp =
        totalScore > state.targetTotalScore ? "higher" : totalScore < state.targetTotalScore ? "lower" : "equal";
      const scoreSymbol = scoreCmp === "higher" ? "▼" : scoreCmp === "lower" ? "▲" : "＝";
      const scoreLabel =
        scoreCmp === "higher" ? "정답 총점보다 높음" : scoreCmp === "lower" ? "정답 총점보다 낮음" : "정답 총점과 같음";
      const scoreLine = document.createElement("p");
      scoreLine.className = `attempt-score attempt-score-${scoreCmp}`;
      scoreLine.textContent = `화료 점수: ${formatScoreWord(totalScore)} ${scoreSymbol}`;
      scoreLine.title = `이 손패로 화료했을 때 총점(오야 기준, 단순화된 값): ${formatScoreWord(totalScore)} — ${scoreLabel}`;
      block.appendChild(scoreLine);

      const chipRow = document.createElement("div");
      chipRow.className = "yaku-chip-list yaku-chip-list-row";
      (a.yakuResult || []).forEach((r) => {
        const chip = document.createElement("span");
        const colorClass =
          r.color === "green" ? "yaku-chip-correct" : r.color === "orange" ? "yaku-chip-orange" : "yaku-chip-gray";
        chip.className = `yaku-chip ${colorClass}`.trim();
        chip.title = yakuTooltip(r.id);

        const nameSpan = document.createElement("span");
        nameSpan.className = "yaku-chip-name";
        nameSpan.textContent = r.name;
        chip.appendChild(nameSpan);

        chipRow.appendChild(chip);
      });
      block.appendChild(chipRow);

      els.history.appendChild(block);
    }
  }

  function renderPalette() {
    const knowledge = computePaletteTileKnowledge();
    const buttons = els.palette.querySelectorAll(".tile-btn");
    buttons.forEach((btn) => {
      const code = btn.dataset.tile;
      const n = countInGuess(code);
      const badge = btn.querySelector(".count-badge");
      if (n > 0) {
        badge.hidden = false;
        badge.textContent = String(n);
      } else {
        badge.hidden = true;
      }
      const disable =
        state.status !== "playing" ||
        n >= 4 ||
        state.currentGuess.length >= TILE_LENGTH;
      btn.disabled = disable;

      btn.classList.remove("tile-btn-included", "tile-btn-excluded");
      const know = knowledge[code];
      if (know === "green") btn.classList.add("tile-btn-included");
      else if (know === "gray") btn.classList.add("tile-btn-excluded");

      btn.classList.toggle("tile-btn-dora", state.doraTiles.includes(code));
    });
  }

  function renderControls() {
    const playing = state.status === "playing";
    const filled = state.currentGuess.length === TILE_LENGTH;
    const noYaku = playing && filled && isCurrentGuessUnwinnable();
    const ready = playing && filled && !noYaku;

    els.btnSubmit.disabled = !ready;
    els.btnSubmit.classList.toggle("btn-no-yaku", noYaku);
    els.btnSubmit.textContent = noYaku ? SUBMIT_LABEL_NO_YAKU : SUBMIT_LABEL_DEFAULT;

    els.btnClear.disabled = !playing || state.currentGuess.length === 0;
  }

  function renderResult() {
    if (state.status === "playing") return;
    if (els.resultStatus) {
      els.resultStatus.classList.remove("result-status-win", "result-status-lose");
      if (state.status === "won") {
        els.resultStatus.textContent = "🎉 성공!";
        els.resultStatus.classList.add("result-status-win");
      } else {
        els.resultStatus.textContent = `😵 실패 (${MAX_ATTEMPTS}회 모두 소진)`;
        els.resultStatus.classList.add("result-status-lose");
      }
    }
    els.answerTilesRow.innerHTML = "";
    state.targetSorted.forEach((t) => els.answerTilesRow.appendChild(makeTileSlot(t, false)));
    els.btnNext.hidden = state.mode !== "practice";
  }

  function renderStats() {
    const s = loadStats();
    const winRate = s.played ? Math.round((s.wins / s.played) * 100) : 0;
    els.statsGrid.innerHTML = `
      <div><div class="stat-num">${s.played}</div><div class="stat-label">플레이</div></div>
      <div><div class="stat-num">${winRate}%</div><div class="stat-label">승률</div></div>
      <div><div class="stat-num">${s.currentStreak}</div><div class="stat-label">연속 성공</div></div>
      <div><div class="stat-num">${s.maxStreak}</div><div class="stat-label">최고 연속</div></div>
    `;
    const max = Math.max(1, ...s.distribution);
    els.statsDist.innerHTML = s.distribution
      .map((v, i) => {
        const pct = Math.round((v / max) * 100);
        return `<div class="stats-dist-row">
          <span>${i + 1}</span>
          <span class="dist-bar-wrap"><span class="dist-bar" style="width:${v ? pct : 0}%"></span></span>
          <span>${v}</span>
        </div>`;
      })
      .join("");
  }

  function buildShareText() {
    const title =
      state.mode === "daily"
        ? `작들 ${todayKstString()}`
        : `작들 연습`;
    const scoreLabel = state.status === "won" ? `${state.attempts.length}/${MAX_ATTEMPTS}` : `X/${MAX_ATTEMPTS}`;
    const emojiFor = { correct: "🟩", present: "🟨", absent: "⬛" };
    const lines = state.attempts.map((a) => {
      const emojis = a.statuses.map((s) => emojiFor[s] || "⬛");
      return emojis.slice(0, 7).join("") + " " + emojis.slice(7).join("");
    });
    return `${title} ${scoreLabel}\n\n${lines.join("\n")}`;
  }

  async function shareResult() {
    if (state.status === "playing") return;
    const text = buildShareText();
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        flashButton(els.btnShare, "복사했어요!");
        return;
      }
    } catch (e) {
    }
    window.prompt("아래 결과를 복사하세요:", text);
  }

  function shareToX() {
    if (state.status === "playing") return;
    const text = buildShareText();
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function flashButton(btn, message) {
    const original = btn.textContent;
    btn.textContent = message;
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = original;
      btn.disabled = false;
    }, 1400);
  }

  init();
})();
