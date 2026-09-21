const { chromium } = require("playwright");
const path = require("path");
const { YAKU_LIST, sortHand } = require(path.join(__dirname, "..", "js", "data.js"));
const { pickDailyYaku, todayKstString, MAX_ATTEMPTS } = require(path.join(__dirname, "..", "js", "engine.js"));
const YakuEngine = require(path.join(__dirname, "..", "js", "yakuEngine.js"));

const BASE_URL = "http://localhost:8123";
const UNWINNABLE_HAND = ["2m", "3m", "4m", "5m", "6m", "7m", "8m", "2p", "3p", "4p", "5p", "6p", "7p", "8p"];

(async () => {
  let failures = 0;
  const assert = (cond, msg) => {
    if (cond) {
      console.log("ok  :", msg);
    } else {
      failures++;
      console.error("FAIL:", msg);
    }
  };

  const YAKU_MAP = Object.fromEntries(YAKU_LIST.map((y) => [y.id, y]));
  const YAKU_ORDER = YAKU_LIST.map((y) => y.id);
  const orderIds = (ids) => YAKU_ORDER.filter((id) => ids.has ? ids.has(id) : ids.includes(id));

  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage({ viewport: { width: 390, height: 1000 } });

  const consoleErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(String(err)));

  await page.goto(`${BASE_URL}/index.html`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  const relevantConsoleErrors = consoleErrors.filter((e) => !/ERR_TUNNEL_CONNECTION_FAILED/.test(e));
  assert(
    relevantConsoleErrors.length === 0,
    `콘솔 에러 없음 (발견: ${JSON.stringify(relevantConsoleErrors)}${
      consoleErrors.length !== relevantConsoleErrors.length
        ? " / 환경 제약으로 무시된 폰트 로드 에러 있음"
        : ""
    })`
  );

  const introAutoOpen = await page.evaluate(() => ({
    backdropHidden: document.getElementById("modal-backdrop").hidden,
    helpHidden: document.getElementById("help-modal").hidden,
  }));
  assert(
    !introAutoOpen.backdropHidden && !introAutoOpen.helpHidden,
    "[F4] 첫 방문 시 게임 방법 팝업이 자동으로 뜸"
  );
  await page.click("#btn-close-help");
  await page.waitForTimeout(50);
  const introFlagSaved = await page.evaluate(
    () => JSON.parse(localStorage.getItem("jongdle:introSeen:v1") || "false") === true
  );
  assert(introFlagSaved, "[F4] 첫 방문 후 introSeen 플래그가 저장됨(재방문 시 다시 뜨지 않도록)");
  await page.reload({ waitUntil: "networkidle" });
  const introSecondVisit = await page.evaluate(() => document.getElementById("help-modal").hidden);
  assert(introSecondVisit === true, "[F4] 두 번째 방문부터는 게임 방법 팝업이 자동으로 뜨지 않음");

  const RELATED_GROUPS = [
    ...YakuEngine.FAMILIES.map(([looseId, strictId]) => [looseId, strictId]),
    ["yakuhai_haku", "yakuhai_hatsu", "yakuhai_chun", "shousangen", "daisangen"],
  ];
  function computeRelated(topTier, raw) {
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
    return related;
  }

  {
    const chantaRaw = YakuEngine.getSatisfiedYaku(sortHand(YAKU_MAP.chanta.tiles));
    const chantaTopTier = YakuEngine.resolveDisplayYaku(chantaRaw);
    assert(
      chantaTopTier.has("chanta") && !chantaTopTier.has("junchan"),
      "[G2] 찬타 대표 손패는 준찬타를 구조적으로 만족하지 않음(전제 확인)"
    );
    const chantaRelated = computeRelated(chantaTopTier, chantaRaw);
    assert(chantaRelated.has("junchan"), "[G2] 정답=찬타일 때 준찬타가 연관 역(주황)으로 잡힘");
  }

  {
    const daisangenRaw = YakuEngine.getSatisfiedYaku(sortHand(YAKU_MAP.daisangen.tiles));
    const daisangenTopTier = YakuEngine.resolveDisplayYaku(daisangenRaw);
    const daisangenRelated = computeRelated(daisangenTopTier, daisangenRaw);
    ["yakuhai_haku", "yakuhai_hatsu", "yakuhai_chun"].forEach((id) => {
      const alreadyTopTier = daisangenTopTier.has(id);
      assert(
        alreadyTopTier || daisangenRelated.has(id),
        `[G4] 정답=대삼원일 때 역패(${id})가 top-tier(초록) 또는 연관 역(주황) 둘 중 하나로는 반드시 잡힘`
      );
    });
  }

  const doraTilesFromPage = await page.$$eval(".tile-btn.tile-btn-dora", (els) => els.map((e) => e.dataset.tile));
  console.log(`  (이번 세션 도라: ${JSON.stringify(doraTilesFromPage)})`);

  const today = todayKstString();
  const todayYaku = pickDailyYaku(today);
  const targetSorted = sortHand(todayYaku.tiles);
  const targetRaw = YakuEngine.getSatisfiedYaku(targetSorted);
  const targetTopTier = YakuEngine.resolveDisplayYaku(targetRaw);
  const targetRelated = computeRelated(targetTopTier, targetRaw);
  const targetRelatedIds = [...targetRelated];
  const targetRawRelatedIds = [...targetRaw].filter((id) => !targetTopTier.has(id));
  console.log(`  (오늘의 역: ${todayYaku.name} / ${todayYaku.id}, 연관 역(전체): ${JSON.stringify(targetRelatedIds)}, 연관 역(raw): ${JSON.stringify(targetRawRelatedIds)})`);

  const forbidden = new Set([...targetTopTier, ...targetRelated]);
  const wrongYaku = YAKU_LIST.find((y) => {
    if (y.id === todayYaku.id) return false;
    const rawY = YakuEngine.getSatisfiedYaku(sortHand(y.tiles));
    const guessTopTierY = YakuEngine.resolveDisplayYaku(rawY);
    return ![...guessTopTierY].some((id) => forbidden.has(id));
  });
  assert(!!wrongYaku, "정답의 top-tier/연관 역과 전혀 안 겹치는 비교용 역을 하나 찾음");
  const wrongGuess = sortHand(wrongYaku.tiles);
  const wrongRaw = YakuEngine.getSatisfiedYaku(wrongGuess);
  const wrongTopTier = YakuEngine.resolveDisplayYaku(wrongRaw);

  const HAN_SCORE_TABLE = {
    1: 1500, 2: 2900, 3: 5800, 4: 11600, 5: 12000, 6: 18000,
    7: 18000, 8: 24000, 9: 24000, 10: 24000, 11: 36000, 12: 36000,
  };
  const YAKUMAN_SCORE = 48000;
  function countDoraInHand(tiles) {
    if (!tiles || doraTilesFromPage.length === 0) return 0;
    return tiles.reduce((sum, t) => sum + (doraTilesFromPage.includes(t) ? 1 : 0), 0);
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

  {
    assert(formatScoreWord(YAKUMAN_SCORE) === "역만", "[v12-항목3] 1배는 그대로 '역만'");
    assert(formatScoreWord(YAKUMAN_SCORE * 2) === "더블역만", "[v12-항목3] 2배는 그대로 '더블역만'");
    assert(formatScoreWord(YAKUMAN_SCORE * 3) === "세 배 역만", `[v12-항목3] 3배는 '세 배 역만' (실제: ${formatScoreWord(YAKUMAN_SCORE * 3)})`);
    assert(formatScoreWord(YAKUMAN_SCORE * 4) === "네 배 역만", `[v12-항목3] 4배는 '네 배 역만' (실제: ${formatScoreWord(YAKUMAN_SCORE * 4)})`);
    assert(formatScoreWord(YAKUMAN_SCORE * 6) === "여섯 배 역만", `[v12-항목3] 6배는 '여섯 배 역만' (실제: ${formatScoreWord(YAKUMAN_SCORE * 6)})`);
    assert(!/\d/.test(formatScoreWord(YAKUMAN_SCORE * 6)), "[v12-항목3] 6배 표기에는 숫자가 아니라 순우리말만 쓰임");
  }

  {
    function totalScoreForIdsWithDora(idIterable, tiles, doraTiles) {
      const list = [...idIterable];
      if (list.length === 0) return 0;
      const yakumanIds = list.filter((id) => YAKU_MAP[id].category === "역만");
      if (yakumanIds.length > 0) {
        return yakumanIds.reduce(
          (sum, id) => sum + (YAKU_MAP[id].doubleYakuman ? YAKUMAN_SCORE * 2 : YAKUMAN_SCORE),
          0
        );
      }
      const doraHan = tiles.reduce((sum, t) => sum + (doraTiles.includes(t) ? 1 : 0), 0);
      const totalHan = list.reduce((sum, id) => sum + (YAKU_MAP[id].hanValue || 1), 0) + doraHan;
      const han = Math.min(Math.max(totalHan, 1), 12);
      return HAN_SCORE_TABLE[han] || HAN_SCORE_TABLE[12];
    }
    const tanyaoOnly = new Set(["tanyao"]);
    const hand = ["2m", "3m", "4m", "2p", "3p", "4p", "2s", "3s", "4s", "5s", "6s", "7s", "2p", "2p"];

    const scoreNoDora = totalScoreForIdsWithDora(tanyaoOnly, hand, []);
    assert(
      scoreNoDora === HAN_SCORE_TABLE[1],
      `[v13-항목1] 도라가 없으면 탕야오 단독 1판 그대로(${HAN_SCORE_TABLE[1]}점) (실제 ${scoreNoDora})`
    );

    const scoreWithDora = totalScoreForIdsWithDora(tanyaoOnly, hand, ["2p"]);
    assert(
      scoreWithDora === HAN_SCORE_TABLE[4],
      `[v13-항목1] 도라(2p)를 3장 들고 있으면 1판(탕야오)+3판(도라 3장)=4판 점수(${HAN_SCORE_TABLE[4]}점)로 계산됨 (실제 ${scoreWithDora})`
    );

    const scoreWithUnrelatedDora = totalScoreForIdsWithDora(tanyaoOnly, hand, ["9z"]);
    assert(
      scoreWithUnrelatedDora === HAN_SCORE_TABLE[1],
      "[v13-항목1] 손패에 없는 패가 도라로 지정돼 있으면 점수에 영향 없음"
    );

    const kokushiHand = YAKU_MAP.kokushi.tiles;
    const scoreYakumanWithDora = totalScoreForIdsWithDora(new Set(["kokushi"]), kokushiHand, [kokushiHand[0]]);
    assert(
      scoreYakumanWithDora === YAKUMAN_SCORE,
      `[v13-항목1] 역만은 손패에 도라가 있어도 점수가 그대로 역만 고정값(${YAKUMAN_SCORE}점)임(실제 마작 관례) (실제 ${scoreYakumanWithDora})`
    );
  }

  const targetTotalScore = totalScoreForIds(targetTopTier, targetSorted);

  {
    function tileInclusionStatusesReplica(guessSorted, tSorted) {
      const targetCounts = {};
      tSorted.forEach((t) => { targetCounts[t] = (targetCounts[t] || 0) + 1; });
      return guessSorted.map((t) => {
        if (targetCounts[t] > 0) { targetCounts[t] -= 1; return "included"; }
        return "excluded";
      });
    }
    function isWinningHandReplica(guessSorted, tSorted) {
      if (guessSorted.length !== tSorted.length) return false;
      return guessSorted.every((t, i) => t === tSorted[i]);
    }
    const ALL_CODES_REPLICA = [
      ...Array.from({ length: 9 }, (_, i) => `${i + 1}m`),
      ...Array.from({ length: 9 }, (_, i) => `${i + 1}p`),
      ...Array.from({ length: 9 }, (_, i) => `${i + 1}s`),
      ...Array.from({ length: 7 }, (_, i) => `${i + 1}z`),
    ];
    function computePaletteTileKnowledgeReplica(attemptsTiles, tSorted, unlockIndex) {
      const knowledge = {};
      if (unlockIndex === -1) return knowledge;
      const maxIncluded = {};
      const exactCount = {};
      for (let i = unlockIndex; i < attemptsTiles.length; i++) {
        const tiles = attemptsTiles[i];
        if (isWinningHandReplica(tiles, tSorted)) {
          const targetCounts = {};
          tSorted.forEach((t) => { targetCounts[t] = (targetCounts[t] || 0) + 1; });
          ALL_CODES_REPLICA.forEach((code) => { exactCount[code] = targetCounts[code] || 0; });
          continue;
        }
        const statuses = tileInclusionStatusesReplica(tiles, tSorted);
        const includedCountThisAttempt = {};
        const excludedSeenThisAttempt = {};
        tiles.forEach((t, ti) => {
          if (statuses[ti] === "included") includedCountThisAttempt[t] = (includedCountThisAttempt[t] || 0) + 1;
          else excludedSeenThisAttempt[t] = true;
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

    const synthTarget = ["1m", "1m", "1m", "2m", "3m", "4m", "5m", "6m", "7m", "8m", "9m", "1p", "1p", "1p"];
    const uniqueSynthTargetCodes = [...new Set(synthTarget)];
    const attemptWinExact = [...synthTarget];
    const attemptOverguess = ["1m", "1m", "1m", "1m", "5s", "5s", "5s", "5s", "2m", "3m", "4m", "6m", "7m", "8m"];

    const knowledgeBeforeWin = computePaletteTileKnowledgeReplica([attemptOverguess], synthTarget, 0);
    assert(knowledgeBeforeWin["1m"] === "green", `[J5] 1m을 정답 개수(3장)보다 많이 내봐서 정확한 개수가 확정 -> 초록 (실제: ${knowledgeBeforeWin["1m"]})`);
    assert(knowledgeBeforeWin["5s"] === "gray", `[J5] 5s는 정답에 전혀 없음이 확정 -> 회색 (실제: ${knowledgeBeforeWin["5s"]})`);
    assert(knowledgeBeforeWin["2m"] === "green", `[v12-항목2] 2m은 포함된 건 확인했으므로(정확한 개수는 몰라도) 초록 (실제: ${knowledgeBeforeWin["2m"]})`);
    assert(knowledgeBeforeWin["9m"] === undefined, "[J5] 9m은 이 시도에서 아예 건드리지 않아 아직 색이 없음");
    assert(knowledgeBeforeWin["1p"] === undefined, "[J5] 1p도 이 시도에서 아예 건드리지 않아 아직 색이 없음");

    const knowledgeAfterWin = computePaletteTileKnowledgeReplica([attemptWinExact], synthTarget, 0);
    assert(
      uniqueSynthTargetCodes.every((c) => knowledgeAfterWin[c] === "green"),
      `[K1] 정답과 완전히 같은 손패를 제출하면 정답에 포함된 패 종류가 즉시 초록으로 확정됨 (실제: ${JSON.stringify(uniqueSynthTargetCodes.map((c) => [c, knowledgeAfterWin[c]]))})`
    );
    const otherCodesReplica = ALL_CODES_REPLICA.filter((c) => !uniqueSynthTargetCodes.includes(c));
    assert(
      otherCodesReplica.every((c) => knowledgeAfterWin[c] === "gray"),
      "[K1] 정답과 완전히 같은 손패를 제출하면 정답에 없는 나머지 패 종류도 즉시 회색으로 확정됨"
    );

    const knowledgeCombined = computePaletteTileKnowledgeReplica([attemptOverguess, attemptWinExact], synthTarget, 0);
    assert(
      uniqueSynthTargetCodes.every((c) => knowledgeCombined[c] === "green"),
      "[K1] 먼저 부분적으로만 알아낸 패도, 나중에 정답을 그대로 제출하면 전부 초록으로 갱신됨"
    );
  }

  let discoveryId = null;
  let discoveryColor = null;
  const topTierOthers = [...targetTopTier].filter((id) => id !== todayYaku.id);
  if (topTierOthers.length > 0) {
    discoveryId = topTierOthers[0];
    discoveryColor = "green";
  } else if (targetRelatedIds.length > 0) {
    discoveryId = targetRelatedIds[0];
    discoveryColor = "orange";
  }

  const paletteButtons = await page.$$(".tile-btn");
  assert(paletteButtons.length === 34, `역키보드 버튼 34개 (실제 ${paletteButtons.length})`);

  const boardChips = await page.$$eval("#yaku-board .yaku-board-chip", (els) =>
    els.map((e) => ({ text: e.textContent, cls: e.className }))
  );
  assert(boardChips.length === YAKU_LIST.length, `역 목록에 역 28종이 모두 나열됨 (실제 ${boardChips.length})`);
  assert(
    boardChips.every((c) => c.cls.includes("yaku-board-gray")),
    "게임 시작 시 역 목록이 전부 회색"
  );

  {
    const doraInfo = await page.$$eval(".tile-btn.tile-btn-dora", (els) =>
      els.map((e) => ({
        code: e.dataset.tile,
        animationName: getComputedStyle(e, "::after").animationName,
      }))
    );
    assert(
      doraInfo.length >= 1 && doraInfo.length <= 4,
      `[v12-항목4] 도라 패가 1~4개 선택되어 역키보드에 표시됨 (실제 ${doraInfo.length}개: ${doraInfo.map((d) => d.code).join(",")})`
    );
    assert(
      doraInfo.every((d) => d.animationName === "dora-shine"),
      `[v12-항목4] 도라로 표시된 패 버튼에 하이라이트가 지나가는 CSS 애니메이션(dora-shine)이 실제로 적용됨 (실제: ${JSON.stringify(doraInfo.map((d) => d.animationName))})`
    );
    const uniqueDoraCodes = new Set(doraInfo.map((d) => d.code));
    assert(uniqueDoraCodes.size === doraInfo.length, "[v12-항목4] 도라 패는 서로 중복되지 않는 서로 다른 패 종류로만 뽑힘");

    const doraBeforeReload = doraInfo.map((d) => d.code).sort();
    await page.reload({ waitUntil: "networkidle" });
    const doraAfterReload = await page.$$eval(".tile-btn.tile-btn-dora", (els) => els.map((e) => e.dataset.tile).sort());
    assert(
      JSON.stringify(doraBeforeReload) === JSON.stringify(doraAfterReload),
      `[v12-항목4] 데일리 모드에서 새로고침해도 도라 패 목록이 그대로 유지됨 (이전: ${doraBeforeReload.join(",")}, 이후: ${doraAfterReload.join(",")})`
    );
  }

  const boardTooltip = await page.evaluate(() => document.querySelector("#yaku-board .yaku-board-chip").getAttribute("title"));
  assert(!!boardTooltip && boardTooltip.length > 5, `[F2] 역 목록 칩에 hover 설명(title)이 있음: "${boardTooltip}"`);

  const anyHanja = YAKU_LIST.some((y) => boardTooltip.includes(y.hanja));
  assert(!anyHanja, `[G1] 역 목록 툴팁에 한자가 더는 포함되지 않음: "${boardTooltip}"`);

  for (const tile of targetSorted) {
    await page.click(`.tile-btn[data-tile="${tile}"]`);
  }
  await page.waitForTimeout(80);

  const liveStatusClasses = await page.$$eval("#current-guess-row .tile-slot", (els) =>
    els.map((e) => e.className).filter((c) => /status-(correct|present|absent)/.test(c))
  );
  assert(liveStatusClasses.length === 0, "정답과 같은 손패를 놓아도 제출 전에는 타일에 색이 붙지 않음");

  const currentRowDoraCount = await page.$$eval(
    "#current-guess-row .tile-slot.tile-slot-dora",
    (els) => els.length
  );
  assert(currentRowDoraCount === 0, "[v13-항목4] 지금 입력 중인(제출 전) 손패 줄에는 도라 애니메이션이 붙지 않음");

  const boardChipsBeforeSubmit = await page.$$eval("#yaku-board .yaku-board-chip", (els) =>
    els.map((e) => e.className)
  );
  assert(
    boardChipsBeforeSubmit.every((c) => c.includes("yaku-board-gray")),
    "14장을 채워도 제출하기 전에는 '역 목록'(정답 비교용)은 여전히 전부 회색"
  );

  const popupInfo = await page.evaluate(() => {
    const el = document.getElementById("yaku-popup");
    const chips = Array.from(document.querySelectorAll("#yaku-popup-chips .yaku-chip")).map((c) => ({
      text: c.textContent,
      neutral: c.classList.contains("yaku-chip-neutral"),
      colored: c.classList.contains("yaku-chip-correct") || c.classList.contains("yaku-chip-orange"),
      title: c.getAttribute("title"),
    }));
    return { hidden: el.hidden, computedDisplay: getComputedStyle(el).display, chips };
  });
  assert(popupInfo.hidden === false, "[항목1] 14장을 다 채우면 자가 확인 팝업이 뜸(버그 수정 확인)");
  assert(popupInfo.computedDisplay !== "none", "[항목1] 팝업의 실제 computed display도 none이 아님 ([hidden] 규칙 충돌 없음)");
  assert(
    popupInfo.chips.length > 0 && popupInfo.chips.every((c) => c.neutral && !c.colored),
    "[항목1] 팝업 칩은 중립 스타일일 뿐 초록/주황(정답 비교) 색은 절대 쓰지 않음"
  );
  const popupNames = new Set(popupInfo.chips.map((c) => c.text));
  const expectedSelfNames = new Set(orderIds(targetTopTier).map((id) => YAKU_MAP[id].name));
  assert(
    popupNames.size === expectedSelfNames.size && [...popupNames].every((n) => expectedSelfNames.has(n)),
    `[항목1] 팝업 내용은 "지금 이 손패" 자체의 역과 일치 (내가 정답과 똑같이 냈으니 결과적으로 같음): ${[...popupNames].join(", ")}`
  );
  assert(
    popupInfo.chips.every((c) => !!c.title && c.title.length > 5),
    `[F2] 자가 확인 팝업의 역 칩에도 hover 설명(title)이 있음: "${popupInfo.chips[0] && popupInfo.chips[0].title}"`
  );

  const popupTitleEl = await page.$(".yaku-popup-title");
  assert(popupTitleEl === null, "[항목2] 팝업 위 설명 문구 요소가 더는 존재하지 않음");
  const popupOwnText = await page.textContent("#yaku-popup");
  assert(
    !popupOwnText.includes("정답과는 무관") && !popupOwnText.includes("제출 전에 봐도 안전"),
    `[항목2] 팝업에 예전 설명 문구가 더는 표시되지 않음 (실제 텍스트: "${popupOwnText.trim()}")`
  );

  const popupScoreInfo = await page.evaluate(() => {
    const el = document.getElementById("yaku-popup-score");
    return el ? { hidden: el.hidden, text: el.textContent } : null;
  });
  const expectedSelfScore = totalScoreForIds(targetTopTier, targetSorted);
  assert(
    !!popupScoreInfo && popupScoreInfo.hidden === false,
    "[J2] 손패 14장을 채우면 제출 전에도 화료 시 점수 표시가 나타남"
  );
  assert(
    popupScoreInfo.text.includes(formatScoreWord(expectedSelfScore)),
    `[J2] 제출 전 점수 표시가 이 손패 자체의 점수와 일치 (기대: "${formatScoreWord(expectedSelfScore)}", 실제: "${popupScoreInfo.text}")`
  );
  assert(
    !/[▲▼＝]/.test(popupScoreInfo.text),
    `[J2] 제출 전 점수 표시에는 정답과 비교하는 ▲/▼/＝ 심볼이 없음(자기 손패만으로 계산) (실제: "${popupScoreInfo.text}")`
  );

  const currentRowWrap = await page.evaluate(() => {
    const row = document.getElementById("current-guess-row");
    const slots = Array.from(row.querySelectorAll(".tile-slot"));
    return {
      count: slots.length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert(
    currentRowWrap.count === 14 && currentRowWrap.pageOverflow <= 1,
    `[항목8] 지금 손패 14장이 커진 크기로도 전부 표시되고 가로 스크롤이 생기지 않음 (pageOverflow=${currentRowWrap.pageOverflow}px)`
  );

  await page.click("#btn-clear");
  await page.waitForTimeout(50);

  for (const tile of UNWINNABLE_HAND) {
    await page.click(`.tile-btn[data-tile="${tile}"]`);
  }
  await page.waitForTimeout(50);
  const submitTextNoYaku = await page.textContent("#btn-submit");
  assert(submitTextNoYaku.includes("화료 불가"), `화료 불가 문구 표시 (실제 "${submitTextNoYaku}")`);
  assert((await page.getAttribute("#btn-submit", "disabled")) !== null, "화료 불가 상태에서 제출 버튼 비활성화");
  const noYakuPopupText = await page.textContent("#yaku-popup-chips");
  assert(noYakuPopupText.includes("성립하는 역이 없어요"), `[항목1] 화료 불가 손패면 팝업도 "성립하는 역이 없어요" 표시 (실제 "${noYakuPopupText.trim()}")`);
  const noYakuPopupScoreHidden = await page.evaluate(() => document.getElementById("yaku-popup-score").hidden);
  assert(noYakuPopupScoreHidden === true, "[J2] 화료 불가 손패면 화료 점수 표시도 숨겨짐(성립하는 역이 없으니 점수도 없음)");
  await page.click("#btn-clear");
  await page.waitForTimeout(50);

  await page.click('.tile-btn[data-tile="3m"]');
  await page.waitForTimeout(30);
  await page.click("#current-guess-row .tile-slot:not(.is-empty)");
  await page.waitForTimeout(30);
  const badgeInfo = await page.evaluate(() => {
    const b = document.querySelector('.tile-btn[data-tile="3m"] .count-badge');
    return { hiddenAttr: b.hidden, display: getComputedStyle(b).display };
  });
  assert(badgeInfo.hiddenAttr === true && badgeInfo.display === "none", "패를 뺀 뒤 카운트 배지가 실제로도 사라짐");

  for (const tile of wrongGuess) {
    await page.click(`.tile-btn[data-tile="${tile}"]`);
  }
  const filledCount = await page.$$eval("#current-guess-row .tile-slot:not(.is-empty)", (els) => els.length);
  assert(filledCount === 14, `무관한 손패 14장 채움 (실제 ${filledCount})`);

  await page.click("#btn-submit");
  await page.waitForTimeout(150);

  const boardAfterWrong = await page.$$eval("#yaku-board .yaku-board-chip", (els) =>
    els.map((e) => ({ text: e.textContent, cls: e.className }))
  );
  assert(
    boardAfterWrong.every((c) => !c.cls.includes("yaku-board-green") && !c.cls.includes("yaku-board-orange")),
    "정답과 무관한 역을 제출해도 역 목록에 초록/주황은 하나도 생기지 않음 (내 손패의 역이 아니라 정답과의 겹침만 색이 바뀜)"
  );
  const expectedTriedGrayNames = new Set(orderIds(wrongTopTier).map((id) => YAKU_MAP[id].name));
  expectedTriedGrayNames.forEach((name) => {
    const found = boardAfterWrong.find((c) => c.text === name);
    assert(
      found && found.cls.includes("yaku-board-tried-gray"),
      `[항목3] 제출해서 성립시킨(정답과 무관한) 역(${name})이 역 목록에서 진한 회색 배경으로 표시됨`
    );
  });
  const untriedStillPlainGray = boardAfterWrong.filter(
    (c) => !expectedTriedGrayNames.has(c.text) && c.text !== todayYaku.name
  );
  assert(
    untriedStillPlainGray.every((c) => c.cls.includes("yaku-board-gray") && !c.cls.includes("yaku-board-tried-gray")),
    "[항목3] 아직 한 번도 성립시켜보지 않은 역은 계속 테두리만 있는 연한 회색 상태"
  );

  const firstAttemptChipInfo = await page.$$eval("#history .attempt-block:nth-child(1) .yaku-chip-list-row .yaku-chip", (els) =>
    els.map((e) => ({
      text: e.querySelector(".yaku-chip-name") ? e.querySelector(".yaku-chip-name").textContent : e.textContent,
      green: e.classList.contains("yaku-chip-correct"),
      orange: e.classList.contains("yaku-chip-orange"),
      gray: e.classList.contains("yaku-chip-gray"),
      title: e.getAttribute("title"),
    }))
  );
  assert(
    firstAttemptChipInfo.every((c) => !!c.title && c.title.length > 5),
    `[F2] 제출 기록의 역 칩에도 hover 설명(title)이 있음: "${firstAttemptChipInfo[0] && firstAttemptChipInfo[0].title}"`
  );

  const anyPerChipScore = await page.$("#history .yaku-chip .yaku-score");
  assert(anyPerChipScore === null, "[I1] 개별 역 칩에는 더 이상 점수가 표시되지 않음(화료 총점 하나로 통합)");
  const firstAttemptScoreInfo = await page.evaluate(() => {
    const el = document.querySelector("#history .attempt-block:nth-child(1) .attempt-score");
    return el ? { text: el.textContent } : null;
  });
  assert(!!firstAttemptScoreInfo, "[I1] 제출 기록마다 화료 총점 표시가 붙어있음");
  const expectedWrongScore = totalScoreForIds(wrongTopTier, wrongGuess);
  const expectedWrongSymbol =
    expectedWrongScore > targetTotalScore ? "▼" : expectedWrongScore < targetTotalScore ? "▲" : "＝";
  assert(
    firstAttemptScoreInfo.text.includes(formatScoreWord(expectedWrongScore)) &&
      firstAttemptScoreInfo.text.includes(expectedWrongSymbol),
    `[I1] 화료 총점 표시가 기대값과 일치 (기대: "${formatScoreWord(expectedWrongScore)} ${expectedWrongSymbol}", 실제: "${firstAttemptScoreInfo.text}")`
  );
  const firstAttemptEmptyPlaceholder = await page.$("#history .attempt-block:nth-child(1) .yaku-chip-empty");
  assert(firstAttemptEmptyPlaceholder === null, `[항목2] "정답과 겹치는 역 없음" 문구가 더는 나오지 않음 (지우지 않고 회색으로 표시)`);
  const expectedWrongNames = new Set(orderIds(wrongTopTier).map((id) => YAKU_MAP[id].name));
  assert(
    firstAttemptChipInfo.length === expectedWrongNames.size &&
      firstAttemptChipInfo.every((c) => expectedWrongNames.has(c.text) && !c.green && !c.orange),
    `[항목2] 정답과 안 겹치는 역도 회색 칩으로 그대로 표시됨: ${firstAttemptChipInfo.map((c) => c.text).join(", ")}`
  );
  assert(
    firstAttemptChipInfo.length > 0 && firstAttemptChipInfo.every((c) => c.gray),
    `[J4] 정답과 무관한(미포함) 역 칩에도 회색 강조 클래스(yaku-chip-gray)가 붙음: ${firstAttemptChipInfo.map((c) => c.text).join(", ")}`
  );

  for (const tile of wrongGuess) {
    await page.click(`.tile-btn[data-tile="${tile}"]`);
  }
  await page.waitForTimeout(50);
  const popupAfterKnownGray = await page.$$eval("#yaku-popup-chips .yaku-chip", (els) =>
    els.map((e) => ({ text: e.textContent, gray: e.classList.contains("yaku-chip-gray") }))
  );
  assert(
    popupAfterKnownGray.length === expectedWrongNames.size &&
      popupAfterKnownGray.every((c) => expectedWrongNames.has(c.text) && c.gray),
    `[K3] 이미 무관하다고 밝혀진 역을 다시 만들면 제출 전 팝업에도 회색으로 보임: ${popupAfterKnownGray.map((c) => `${c.text}(${c.gray})`).join(", ")}`
  );
  await page.click("#btn-clear");
  await page.waitForTimeout(50);

  const badgeGeom = await page.evaluate(() => {
    const block = document.querySelector("#history .attempt-block");
    const idx = block.querySelector(".row-index");
    const row = block.querySelector(".guess-row");
    const idxRect = idx.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();
    return {
      insideRowFlow: idx.parentElement === row,
      above: idxRect.top < rowRect.top,
      leftOf: idxRect.left < rowRect.left,
    };
  });
  assert(badgeGeom.insideRowFlow === false, "[항목5] 번호 배지가 더는 .guess-row 안(패 14장과 같은 줄)에 있지 않음");
  assert(badgeGeom.above && badgeGeom.leftOf, "[항목5] 번호 배지가 네모칸 바깥 왼쪽 위에 위치함");

  const historyRowWrap = await page.evaluate(() => {
    const row = document.querySelector("#history .attempt-block .guess-row");
    const slots = Array.from(row.querySelectorAll(".tile-slot"));
    return {
      count: slots.length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert(
    historyRowWrap.count === 14 && historyRowWrap.pageOverflow <= 1,
    `[항목8] 기록에 쌓인 손패 14장도 커진 크기로 전부 표시되고 가로 스크롤이 생기지 않음 (pageOverflow=${historyRowWrap.pageOverflow}px)`
  );

  const attemptLabel = await page.textContent("#attempt-label");
  assert(attemptLabel.includes(`1/${MAX_ATTEMPTS}`), `[I5] 시도 횟수 1/${MAX_ATTEMPTS} 표시 (실제 "${attemptLabel}")`);
  let attemptCount = 1;

  if (discoveryId) {
    const discoveryTiles = sortHand(YAKU_MAP[discoveryId].tiles);
    for (const tile of discoveryTiles) await page.click(`.tile-btn[data-tile="${tile}"]`);
    await page.click("#btn-submit");
    await page.waitForTimeout(150);
    attemptCount += 1;

    const labelAfterDiscovery = await page.textContent("#attempt-label");
    assert(
      labelAfterDiscovery.includes(`${attemptCount}/${MAX_ATTEMPTS}`),
      `[G3] 발견용 역 제출 후 시도 ${attemptCount}/${MAX_ATTEMPTS} 표시 (실제 "${labelAfterDiscovery}")`
    );

    const discoveryExpectedClass = discoveryColor === "green" ? "yaku-board-green" : "yaku-board-orange";
    const boardAfterDiscovery = await page.$$eval("#yaku-board .yaku-board-chip", (els) =>
      els.map((e) => ({ text: e.textContent, cls: e.className }))
    );
    const discoveryBoardChip = boardAfterDiscovery.find((c) => c.text === YAKU_MAP[discoveryId].name);
    assert(
      discoveryBoardChip && discoveryBoardChip.cls.includes(discoveryExpectedClass),
      `[G3] 발견용 역(${YAKU_MAP[discoveryId].name})이 역 목록에서 ${discoveryColor === "green" ? "초록" : "주황"}으로 표시됨(전제 확인)`
    );

    for (const tile of discoveryTiles) await page.click(`.tile-btn[data-tile="${tile}"]`);
    await page.waitForTimeout(80);
    const discoveryPopupInfo2 = await page.evaluate(
      ({ name }) => {
        const chips = Array.from(document.querySelectorAll("#yaku-popup-chips .yaku-chip"));
        const chip = chips.find((c) => c.textContent === name);
        return chip ? chip.className : null;
      },
      { name: YAKU_MAP[discoveryId].name }
    );
    const discoveryPopupExpectedClass = discoveryColor === "green" ? "yaku-chip-correct" : "yaku-chip-orange";
    assert(
      !!discoveryPopupInfo2 && discoveryPopupInfo2.includes(discoveryPopupExpectedClass),
      `[G3] 이미 발견된 역(${YAKU_MAP[discoveryId].name})을 다시 만들면 제출 전 팝업에도 같은 색(${discoveryColor})이 보임 (실제 class: "${discoveryPopupInfo2}")`
    );

    await page.click("#btn-clear");
    await page.waitForTimeout(50);
  } else {
    console.log("  (오늘의 정답은 top-tier/연관 역이 자기 자신뿐이라 [G3] 발견 시나리오는 스킵)");
  }

  for (const tile of targetSorted) {
    await page.click(`.tile-btn[data-tile="${tile}"]`);
  }
  await page.click("#btn-submit");
  await page.waitForTimeout(150);
  attemptCount += 1;

  const boardAfterCorrect = await page.$$eval("#yaku-board .yaku-board-chip", (els) =>
    els.map((e) => ({ text: e.textContent, cls: e.className }))
  );
  targetTopTier.forEach((id) => {
    const name = YAKU_MAP[id].name;
    const found = boardAfterCorrect.find((c) => c.text === name);
    assert(found && found.cls.includes("yaku-board-green"), `정답의 역(${name})이 역 목록에서 초록으로 표시됨`);
  });
  if (targetRawRelatedIds.length > 0) {
    targetRawRelatedIds.forEach((id) => {
      const name = YAKU_MAP[id].name;
      const found = boardAfterCorrect.find((c) => c.text === name);
      assert(found && found.cls.includes("yaku-board-orange"), `정답과 연관된 역(${name})이 역 목록에서 주황으로 표시됨`);
    });
  } else {
    console.log("  (오늘의 정답은 family 연관 역이 없어 주황 케이스는 스킵)");
  }

  const tileHintInfo = await page.$$eval("#history .attempt-block:nth-child(1) .guess-row .tile-slot", (els) =>
    els.map((e) => ({
      included: e.classList.contains("tile-included"),
      excluded: e.classList.contains("tile-excluded"),
    }))
  );
  assert(
    tileHintInfo.length === 14 && tileHintInfo.every((t) => t.included && !t.excluded),
    "[I5] 정답과 완전히 같은 손패를 제출한 시도의 타일 14장이 모두 '포함(초록)'으로 표시됨"
  );

  const doraInTarget = doraTilesFromPage.filter((d) => targetSorted.includes(d));
  if (doraInTarget.length > 0) {
    const submittedTileInfo = await page.$$eval("#history .attempt-block:nth-child(1) .guess-row .tile-slot", (els) =>
      els.map((e) => ({
        isDora: e.classList.contains("tile-slot-dora"),
        animationName: e.classList.contains("tile-slot-dora") ? getComputedStyle(e, "::after").animationName : null,
      }))
    );
    const targetIsDoraFlags = targetSorted.map((t) => doraTilesFromPage.includes(t));
    assert(
      submittedTileInfo.length === targetIsDoraFlags.length &&
        submittedTileInfo.every((t, i) => t.isDora === targetIsDoraFlags[i]),
      `[v13-항목4] 제출된 손패에서 도라 패(${doraInTarget.join(",")})에 해당하는 칸에만 tile-slot-dora가 붙음`
    );
    const doraSlots = submittedTileInfo.filter((t) => t.isDora);
    assert(
      doraSlots.length > 0 && doraSlots.every((t) => t.animationName === "dora-shine"),
      `[v13-항목4] 제출된 손패의 도라 패에도 하이라이트 애니메이션(dora-shine)이 실제로 적용됨 (실제: ${JSON.stringify(doraSlots.map((t) => t.animationName))})`
    );
  } else {
    console.log("  (이번 정답 손패에는 도라 패가 하나도 없어 [v13-항목4] 제출된 손패 도라 표시 확인은 스킵)");
  }

  const earlierAttemptTileHint = await page.$$eval(
    "#history .attempt-block:nth-child(2) .guess-row .tile-slot",
    (els) => els.map((e) => e.classList.contains("tile-included") || e.classList.contains("tile-excluded"))
  );
  assert(
    earlierAttemptTileHint.length > 0 && earlierAttemptTileHint.every((v) => v === false),
    "[I5] 해금 이전(더 앞선) 시도의 손패에는 타일 힌트 색이 나타나지 않음"
  );

  const currentRowHintFree = await page.$$eval("#current-guess-row .tile-slot", (els) =>
    els.every((e) => !e.classList.contains("tile-included") && !e.classList.contains("tile-excluded"))
  );
  assert(currentRowHintFree, "[I5] 타일 힌트가 해금된 뒤에도 지금 입력 중인 손패 줄에는 색이 붙지 않음");

  const uniqueTargetCodes = [...new Set(targetSorted)];
  const paletteKnowledge = await page.$$eval(".tile-btn", (els) =>
    els.map((e) => ({
      code: e.dataset.tile,
      included: e.classList.contains("tile-btn-included"),
      related: e.classList.contains("tile-btn-related"),
      excluded: e.classList.contains("tile-btn-excluded"),
    }))
  );
  const targetCodeButtons = paletteKnowledge.filter((b) => uniqueTargetCodes.includes(b.code));
  assert(
    targetCodeButtons.length === uniqueTargetCodes.length &&
      targetCodeButtons.every((b) => b.included && !b.related && !b.excluded),
    `[항목5 버그 수정] 정답과 완전히 같은 손패를 제출하면, 정답에 포함된 패 종류(${uniqueTargetCodes.join(",")})는 역키보드에서 바로 초록(확정)으로 표시됨`
  );
  const untouchedCodeButtons = paletteKnowledge.filter((b) => !uniqueTargetCodes.includes(b.code));
  assert(
    untouchedCodeButtons.length > 0 &&
      untouchedCodeButtons.every((b) => !b.included && !b.related && b.excluded),
    "[항목5 버그 수정] 정답과 완전히 같은 손패를 제출하면, 정답에 없는 나머지 패 종류도 전부 회색(부재 확정)으로 표시됨"
  );

  const secondAttemptChipInfo = await page.$$eval("#history .attempt-block:nth-child(1) .yaku-chip-list-row .yaku-chip", (els) =>
    els.map((e) => ({ text: e.textContent, green: e.classList.contains("yaku-chip-correct") }))
  );
  assert(
    secondAttemptChipInfo.length > 0 && secondAttemptChipInfo.every((c) => c.green),
    "[항목2] 정답과 똑같이 제출한 기록의 칩은 전부 초록"
  );

  const resultAutoOpen = await page.evaluate(() => ({
    backdropHidden: document.getElementById("modal-backdrop").hidden,
    resultModalHidden: document.getElementById("result-modal").hidden,
  }));
  assert(
    !resultAutoOpen.backdropHidden && !resultAutoOpen.resultModalHidden,
    "[F1] 제출해서 게임이 끝나면 결과가 별도의 팝업 창으로 자동으로 뜸"
  );

  const winStatusInfo = await page.evaluate(() => ({
    resultStatusText: document.getElementById("result-status").textContent,
    resultStatusIsWin: document.getElementById("result-status").classList.contains("result-status-win"),
    viewResultText: document.getElementById("btn-view-result").textContent,
    viewResultIsSuccessBadge: document.getElementById("btn-view-result").classList.contains("badge-success"),
  }));
  assert(
    winStatusInfo.resultStatusText.includes("성공") && winStatusInfo.resultStatusIsWin,
    `[항목2] 성공 시 결과 팝업 맨 위에 성공 표시가 뜸 (실제: "${winStatusInfo.resultStatusText}")`
  );
  assert(
    winStatusInfo.viewResultText.includes("성공") && winStatusInfo.viewResultIsSuccessBadge,
    `[항목2] 결과 팝업을 닫아도 "결과 보기" 배지 자체가 성공했음을 색ㆍ문구로 보여줌 (실제: "${winStatusInfo.viewResultText}")`
  );

  const resultTitleEl = await page.$("#result-title");
  const resultDescEl = await page.$("#result-desc");
  assert(resultTitleEl === null && resultDescEl === null, "[항목6] 결과 팝업에 승패 문구/역 설명 요소가 더는 존재하지 않음");
  const resultModalText = await page.textContent("#result-modal");
  assert(
    !resultModalText.includes(todayYaku.name) && !resultModalText.includes(todayYaku.desc),
    "[항목6] 결과 팝업 텍스트에 역 이름/설명이 더는 노출되지 않음"
  );
  const attemptLabelAfterWin = await page.textContent("#attempt-label");
  assert(
    attemptLabelAfterWin.includes(`${attemptCount}/${MAX_ATTEMPTS}`),
    `${attemptCount}번째 시도에 성공 (시도 라벨: "${attemptLabelAfterWin}")`
  );

  const answerTileCount = await page.$$eval("#answer-tiles-row .tile-slot", (els) => els.length);
  assert(answerTileCount === 14, `[항목6] 결과 팝업에 정답 손패 14장이 패 그림으로 표시됨 (실제 ${answerTileCount}장)`);
  const answerTileLabels = await page.$$eval("#answer-tiles-row .tile-slot", (els) =>
    els.map((e) => e.getAttribute("aria-label"))
  );
  const { tileMeta } = require(path.join(__dirname, "..", "js", "data.js"));
  const expectedLabels = targetSorted.map((t) => tileMeta(t).fullLabel);
  assert(
    JSON.stringify(answerTileLabels) === JSON.stringify(expectedLabels),
    "[항목6] 공개된 정답 손패 14장이 실제 정답 타일과 순서까지 정확히 일치"
  );
  const answerRowWrap = await page.evaluate(() => {
    const row = document.getElementById("answer-tiles-row");
    const slots = Array.from(row.querySelectorAll(".tile-slot"));
    return {
      count: slots.length,
      pageOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  assert(
    answerRowWrap.count === 14 && answerRowWrap.pageOverflow <= 1,
    `[항목8] 결과 팝업 안 정답 손패 14장도 커진 크기로 전부 표시되고 가로 스크롤이 생기지 않음 (pageOverflow=${answerRowWrap.pageOverflow}px)`
  );

  const historyIndexes = await page.$$eval("#history .attempt-block .row-index", (els) => els.map((e) => e.textContent));
  assert(
    historyIndexes[0] === String(attemptCount) && historyIndexes[1] === String(attemptCount - 1),
    `기록이 최신순으로 정렬됨 (실제 순서: ${JSON.stringify(historyIndexes)}, 총 시도 ${attemptCount})`
  );

  const currentInputHidden = await page.getAttribute(".current-input", "hidden");
  assert(currentInputHidden !== null, "게임 종료 후 현재 손패 입력 영역이 숨겨짐");
  const boardStillVisible = await page.$$eval("#yaku-board .yaku-board-chip", (els) => els.length);
  assert(boardStillVisible === YAKU_LIST.length, "게임 종료 후에도 역 목록은 계속 보임(지금까지 발견한 내용 유지)");

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.click("#btn-share");
  await page.waitForTimeout(100);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  assert(clip.includes(todayYaku.name) === false, "공유 텍스트는 정답 이름을 누설하지 않음");
  assert(/🟩|🟨|⬛/.test(clip), "공유 텍스트에 이모지 그리드 포함");

  await page.evaluate(() => {
    window.__openCalls = [];
    window.open = (url, target, features) => {
      window.__openCalls.push({ url, target, features });
      return null;
    };
  });
  await page.click("#btn-share-x");
  await page.waitForTimeout(50);
  const xShareCheck = await page.evaluate(() => window.__openCalls);
  assert(xShareCheck.length === 1, `[K2] "X에 공유하기"를 누르면 새 탭을 한 번 여는 window.open이 호출됨 (실제 ${xShareCheck.length}회)`);
  const xUrl = xShareCheck[0] ? xShareCheck[0].url : "";
  assert(xUrl.startsWith("https://twitter.com/intent/tweet?text="), `[K2] X 글쓰기 화면(intent URL)으로 열림 (실제: "${xUrl}")`);
  const xShareText = xUrl ? decodeURIComponent(xUrl.slice("https://twitter.com/intent/tweet?text=".length)) : "";
  assert(/🟩|🟨|⬛/.test(xShareText), "[K2] X 공유 텍스트에도 이모지 그리드가 포함됨");
  assert(!xShareText.includes(todayYaku.name), "[K2] X 공유 텍스트에도 정답 역 이름이 누설되지 않음");

  await page.click("#btn-close-result");
  await page.waitForTimeout(80);
  const resultClosed = await page.evaluate(() => document.getElementById("result-modal").hidden);
  assert(resultClosed === true, "[F1] 닫기 버튼으로 결과 팝업을 닫을 수 있음");
  const viewResultVisible = await page.evaluate(() => !document.getElementById("btn-view-result").hidden);
  assert(viewResultVisible, '[F1] 게임 종료 후 "결과 보기" 배지가 나타남');
  await page.click("#btn-view-result");
  await page.waitForTimeout(80);
  const resultReopened = await page.evaluate(() => !document.getElementById("result-modal").hidden);
  assert(resultReopened, '[F1] "결과 보기" 배지를 눌러 결과 팝업을 다시 열 수 있음');
  await page.click("#btn-close-result");
  await page.waitForTimeout(50);

  const footerGone = await page.evaluate(() => document.querySelector(".footer") === null);
  assert(footerGone, '[F3] ".footer" 요소가 완전히 삭제됨');
  const oldFooterTextGone = await page.evaluate(() => !document.body.textContent.includes("자세한 게임 방법은"));
  assert(oldFooterTextGone, '[F3] 예전 푸터 문구("자세한 게임 방법은...")가 페이지 어디에도 없음');

  const faqGone = await page.evaluate(() => document.getElementById("faq-section") === null);
  assert(faqGone, "[v14-항목2] FAQ 칸이 완전히 삭제됨");

  const contactInfo = await page.evaluate(() => {
    const contact = document.getElementById("contact-section");
    if (!contact) return null;
    const links = Array.from(contact.querySelectorAll("a")).map((a) => ({
      text: a.textContent.trim(),
      href: a.getAttribute("href"),
      target: a.getAttribute("target"),
      fontWeight: getComputedStyle(a).fontWeight,
    }));
    const discordItem = contact.querySelector(".contact-text-item");
    const cs = getComputedStyle(contact);
    return {
      exists: true,
      hasBorder: cs.borderStyle !== "none" && parseFloat(cs.borderWidth) > 0,
      hasBoxBackground: cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent",
      links,
      discordText: discordItem ? discordItem.textContent.trim() : null,
      discordIsLink: discordItem ? discordItem.tagName === "A" : null,
    };
  });
  assert(!!contactInfo && contactInfo.exists, "[v16-항목1] 연락처 칸이 존재함");
  assert(!contactInfo.hasBorder, "[v16-항목1] 연락처 칸에 테두리(박스)가 없음");
  assert(!contactInfo.hasBoxBackground, "[v16-항목1] 연락처 칸에 배경(박스)이 없음");

  const githubLink = contactInfo.links.find((l) => l.text === "github");
  assert(!!githubLink, `[v16-항목1] "github" 링크가 표시됨 (실제 링크 목록: ${JSON.stringify(contactInfo.links)})`);
  assert(
    githubLink && githubLink.href === "https://github.com/marrowhotpot3/jongdle",
    `[v16-항목1] "github"가 저장소 주소로 하이퍼링크됨 (실제: "${githubLink && githubLink.href}")`
  );
  assert(githubLink && githubLink.target === "_blank", "[v16-항목1] github 링크는 새 탭으로 열림");

  const xLink = contactInfo.links.find((l) => l.text === "X");
  assert(!!xLink, `[v16-항목1] "X" 링크가 표시됨 (실제 링크 목록: ${JSON.stringify(contactInfo.links)})`);
  assert(
    xLink && xLink.href === "https://x.com/marrowhotpot3",
    `[v16-항목1] "X"가 실제 X 프로필로 하이퍼링크됨 (실제: "${xLink && xLink.href}")`
  );
  assert(xLink && xLink.target === "_blank", "[v16-항목1] X 링크는 새 탭으로 열림");

  assert(
    contactInfo.discordText === "Discord: marrowhotpot3",
    `[v16-항목1] Discord 아이디가 텍스트로 표시됨 (실제: "${contactInfo.discordText}")`
  );
  assert(contactInfo.discordIsLink === false, "[v16-항목1] Discord 항목은 클릭 가능한 링크가 아님(대체 방법 없음)");

  assert(
    contactInfo.links.every((l) => Number(l.fontWeight) <= 400),
    `[v16-항목1] 연락처 링크 글씨체는 볼드가 아님 (실제: ${JSON.stringify(contactInfo.links.map((l) => l.fontWeight))})`
  );

  const discordIsButton = await page.evaluate(
    () => document.getElementById("btn-copy-discord")?.tagName === "BUTTON"
  );
  assert(discordIsButton, "[v17-항목1] Discord 항목은 클릭 가능한 button 요소임");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.click("#btn-copy-discord");
  await page.waitForTimeout(100);
  const discordClip = await page.evaluate(() => navigator.clipboard.readText());
  assert(discordClip === "marrowhotpot3", `[v17-항목1] Discord 클릭 시 아이디가 클립보드에 복사됨 (실제: "${discordClip}")`);
  const discordCopiedLabel = await page.evaluate(() => document.getElementById("btn-copy-discord").textContent.trim());
  assert(discordCopiedLabel === "복사됨!", `[v17-항목1] 복사 직후 "복사됨!" 문구로 잠깐 바뀜 (실제: "${discordCopiedLabel}")`);
  await page.waitForTimeout(1300);
  const discordLabelRestored = await page.evaluate(() => document.getElementById("btn-copy-discord").textContent.trim());
  assert(
    discordLabelRestored === "Discord: marrowhotpot3",
    `[v17-항목1] 1.2초 후 원래 문구로 되돌아옴 (실제: "${discordLabelRestored}")`
  );

  const mailIsButton = await page.evaluate(() => document.getElementById("btn-copy-mail")?.tagName === "BUTTON");
  assert(mailIsButton, "[v18-항목1] mail 항목은 클릭 가능한 button 요소임(mailto 링크가 아님)");
  await page.evaluate(() => navigator.clipboard.writeText(""));
  await page.click("#btn-copy-mail");
  await page.waitForTimeout(100);
  const mailClip = await page.evaluate(() => navigator.clipboard.readText());
  assert(
    mailClip === "marrowhotpot3@gmail.com",
    `[v18-항목1] mail 클릭 시 이메일 주소가 클립보드에 복사됨 (실제: "${mailClip}")`
  );
  const mailCopiedLabel = await page.evaluate(() => document.getElementById("btn-copy-mail").textContent.trim());
  assert(mailCopiedLabel === "복사됨!", `[v18-항목1] 복사 직후 "복사됨!" 문구로 잠깐 바뀜 (실제: "${mailCopiedLabel}")`);
  await page.waitForTimeout(1300);
  const mailLabelRestored = await page.evaluate(() => document.getElementById("btn-copy-mail").textContent.trim());
  assert(mailLabelRestored === "mail", `[v18-항목1] 1.2초 후 원래 문구("mail")로 되돌아옴 (실제: "${mailLabelRestored}")`);

  const contactTitleGone = await page.evaluate(
    () => document.querySelector("#contact-section .contact-section-title") === null
  );
  assert(contactTitleGone, '[v15-항목1] "연락처" 글자(제목)가 삭제됨');

  await page.click("#btn-help");
  await page.waitForTimeout(80);
  const helpModalHidden = await page.getAttribute("#help-modal", "hidden");
  assert(helpModalHidden === null, "'?' 버튼을 누르면 도움말 모달이 열림");
  const helpBodyText = await page.textContent("#help-modal .modal-body");
  assert(helpBodyText.includes("작들은 무작위 손패 14장을 맞추는 게임입니다."), "[항목6] 새 도입부 문장이 들어감");
  assert(
    !helpBodyText.includes("정답 손패 14장과 완전히 똑같은 손패를 만드는 것"),
    "[항목6] 예전 도입부 문장은 삭제됨"
  );
  assert(!helpBodyText.includes("역 28종이 모두 나열"), '[항목6] 2번 문장에서 "모두"가 삭제됨');
  assert(helpBodyText.includes("역 28종이 나열"), "[항목6] 2번 문장 자체는 남아있음");
  assert(!helpBodyText.includes("처음엔 전부 회색이에요"), '[항목6] 2번의 "처음엔 전부 회색이에요." 문장이 삭제됨');
  assert(
    !helpBodyText.includes("이전 제출에서 이미 정답과 겹치는 것으로 밝혀진 역이라면"),
    "[항목6] 옛 3번 항목(자가 확인 팝업 설명)이 통째로 삭제됨"
  );
  assert(
    !helpBodyText.includes("화료 불가능한 형태라 마작 규칙상"),
    "[항목6] 옛 4번 항목(화료 불가 팝업 설명)이 통째로 삭제됨"
  );
  assert(
    !helpBodyText.includes("아직 한 번도 성립시켜본 적 없는 역(테두리만 있는 연한 회색)과 구분돼요"),
    '[항목6] 5번 "무관한 역" 설명 중 구분 문장이 삭제됨'
  );
  assert(
    !helpBodyText.includes("키보드 힌트처럼 발견한 내용이 쌓여요"),
    "[항목6] 5번 목록 뒤의 요약 문장이 삭제됨"
  );
  assert(helpBodyText.includes("화료 점수"), "[항목6] 도움말에 화료 점수 설명이 포함됨");
  assert(!helpBodyText.includes("한 칸 지우기"), "[항목6] 도움말에 삭제된 옛 8ㆍ9ㆍ10번 항목이 더는 없음(간접 확인)");
  await page.click("#btn-close-help");
  await page.waitForTimeout(50);

  const stats = await page.evaluate(() => JSON.parse(localStorage.getItem("jongdle:stats:v1")));
  assert(stats.played === 1 && stats.wins === 1, `통계: played=1, wins=1 (실제 played=${stats.played}, wins=${stats.wins})`);

  await page.click("#btn-stats");
  await page.waitForTimeout(100);
  const distBars = await page.evaluate(() => {
    const wrap = document.querySelector(".stats-dist-row .dist-bar-wrap");
    const wrapWidth = wrap ? wrap.getBoundingClientRect().width : 0;
    return Array.from(document.querySelectorAll(".stats-dist-row")).map((row) => {
      const bar = row.querySelector(".dist-bar");
      const countText = row.children[row.children.length - 1].textContent;
      return {
        count: Number(countText),
        barWidth: bar.getBoundingClientRect().width,
        display: getComputedStyle(bar).display,
        wrapWidth,
      };
    });
  });
  const filledRow = distBars.find((r) => r.count > 0);
  const emptyRows = distBars.filter((r) => r.count === 0);
  assert(!!filledRow, "[K4] 시도 분포에 값이 1 이상인 행이 존재함(전제 확인)");
  assert(
    filledRow.display === "block" || filledRow.display === "inline-block",
    `[K4] 통계 막대(.dist-bar)가 실제로 박스를 그리는 display 값을 가짐 (실제: "${filledRow.display}")`
  );
  assert(
    filledRow.barWidth > filledRow.wrapWidth * 0.8,
    `[K4] 값이 있는 통계 막대가 실제로 넓게 그려짐 (막대 ${filledRow.barWidth}px / 전체 ${filledRow.wrapWidth}px)`
  );
  assert(
    emptyRows.length > 0 && emptyRows.every((r) => r.barWidth < filledRow.barWidth / 2),
    "[K4] 값이 0인 통계 막대는 값이 있는 막대보다 훨씬 좁게(거의 안 보이게) 그려짐"
  );
  await page.click("#btn-close-stats");
  await page.waitForTimeout(50);

  await page.click('.mode-tab[data-mode="practice"]');
  await page.waitForTimeout(100);
  const boardAfterPracticeSwitch = await page.$$eval("#yaku-board .yaku-board-chip", (els) => els.map((e) => e.className));
  assert(
    boardAfterPracticeSwitch.every((c) => c.includes("yaku-board-gray")),
    "연습 모드로 전환하면 역 목록도 새 문제 기준으로 전부 회색으로 초기화됨"
  );
  const doraAfterPracticeSwitch = await page.$$(".tile-btn.tile-btn-dora");
  assert(
    doraAfterPracticeSwitch.length >= 1 && doraAfterPracticeSwitch.length <= 4,
    `[v12-항목4] 무한 모드로 전환해도 도라 패가 1~4개 새로 뽑혀 표시됨 (실제 ${doraAfterPracticeSwitch.length}개)`
  );
  const practiceCurrentInputHidden = await page.getAttribute(".current-input", "hidden");
  assert(practiceCurrentInputHidden === null, "연습 모드 전환 시 현재 손패 입력 영역이 다시 보임");
  const popupHiddenOnFreshStart = await page.evaluate(() => document.getElementById("yaku-popup").hidden);
  assert(popupHiddenOnFreshStart === true, "새 문제 시작 시 자가 확인 팝업은 (0장이므로) 숨겨져 있음");
  const viewResultHiddenOnFreshStart = await page.evaluate(() => document.getElementById("btn-view-result").hidden);
  assert(viewResultHiddenOnFreshStart === true, '[F1] 새 문제를 시작하면 "결과 보기" 배지도 다시 숨겨짐');
  const resultModalClosedOnFreshStart = await page.evaluate(() => document.getElementById("result-modal").hidden);
  assert(resultModalClosedOnFreshStart === true, "[F1] 새 문제를 시작하면 혹시 열려있던 결과 팝업도 닫힘");

  for (let i = 0; i < 4; i++) await page.click('.tile-btn[data-tile="1m"]');
  assert((await page.getAttribute('.tile-btn[data-tile="1m"]', "disabled")) !== null, "같은 패 4장 선택 후 비활성화");

  await page.click("#btn-clear");
  const afterClear = await page.$$eval("#current-guess-row .tile-slot:not(.is-empty)", (els) => els.length);
  assert(afterClear === 0, "전체 지우기 후 현재 손패 0장");

  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    for (const tile of targetSorted) await page.click(`.tile-btn[data-tile="${tile}"]`);
    await page.click("#btn-submit");
    await page.waitForTimeout(60);
    const label = await page.textContent("#attempt-label");
    assert(label.includes(`${i}/${MAX_ATTEMPTS}`), `[I5] ${i}번째 제출 후 시도 ${i}/${MAX_ATTEMPTS} 표시 (실제 "${label}")`);
    if (i < MAX_ATTEMPTS) {
      const stillPlaying = await page.evaluate(() => !document.querySelector(".current-input").hidden);
      assert(stillPlaying, `[I5] ${i}번째 제출(${MAX_ATTEMPTS}회 미만) 후에도 게임이 계속 진행 중`);
    }
  }
  const endedAfterTen = await page.evaluate(() => document.querySelector(".current-input").hidden);
  assert(endedAfterTen === true, `[I5/v14-항목1] ${MAX_ATTEMPTS}번째 제출로 게임이 끝남(입력 영역이 숨겨짐, ${MAX_ATTEMPTS}회 한도)`);

  const loseStatusInfo = await page.evaluate(() => ({
    backdropHidden: document.getElementById("modal-backdrop").hidden,
    resultModalHidden: document.getElementById("result-modal").hidden,
    resultStatusText: document.getElementById("result-status").textContent,
    resultStatusIsLose: document.getElementById("result-status").classList.contains("result-status-lose"),
    viewResultText: document.getElementById("btn-view-result").textContent,
    viewResultIsFailBadge: document.getElementById("btn-view-result").classList.contains("badge-fail"),
  }));
  assert(
    !loseStatusInfo.backdropHidden && !loseStatusInfo.resultModalHidden,
    "[항목2] 실패로 끝났을 때도 결과 팝업이 자동으로 뜸"
  );
  assert(
    loseStatusInfo.resultStatusText.includes("실패") && loseStatusInfo.resultStatusIsLose,
    `[항목2] 실패 시 결과 팝업 맨 위에 실패 표시가 뜸 (실제: "${loseStatusInfo.resultStatusText}")`
  );
  assert(
    loseStatusInfo.viewResultText.includes("실패") && loseStatusInfo.viewResultIsFailBadge,
    `[항목2] "결과 보기" 배지도 실패했음을 색ㆍ문구로 보여줌 (성공 때와 다른 스타일) (실제: "${loseStatusInfo.viewResultText}")`
  );

  await browser.close();

  console.log(`\n총 ${failures === 0 ? "모두 통과" : failures + "건 실패"}`);
  process.exit(failures === 0 ? 0 : 1);
})();
