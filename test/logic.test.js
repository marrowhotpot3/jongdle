const path = require("path");
const { YAKU_LIST, sortHand, TILE_LENGTH } = require(path.join(__dirname, "..", "js", "data.js"));
const { compareHands, isWinningHand, pickDailyYaku, hashString, todayKstString } = require(path.join(__dirname, "..", "js", "engine.js"));

let failures = 0;
function assert(cond, msg) {
  if (!cond) {
    failures++;
    console.error("FAIL:", msg);
  } else {
    console.log("ok  :", msg);
  }
}

const tileRe = /^[1-9][mps]$|^[1-7]z$/;
YAKU_LIST.forEach((y) => {
  assert(y.tiles.length === TILE_LENGTH, `${y.id}: 손패 14장`);
  y.tiles.forEach((t) => assert(tileRe.test(t), `${y.id}: 타일 코드 형식(${t})`));
  const counts = {};
  y.tiles.forEach((t) => (counts[t] = (counts[t] || 0) + 1));
  Object.entries(counts).forEach(([t, c]) =>
    assert(c <= 4, `${y.id}: ${t} 개수(${c}) <= 4`)
  );
});

const seen = new Map();
YAKU_LIST.forEach((y) => {
  const key = sortHand(y.tiles).join(",");
  if (seen.has(key)) {
    failures++;
    console.error(`FAIL: 중복 손패 — ${y.id} vs ${seen.get(key)}`);
  } else {
    seen.set(key, y.id);
  }
});
assert(seen.size === YAKU_LIST.length, "모든 정답 손패가 서로 다름");

{
  const target = sortHand(YAKU_LIST[0].tiles);
  const result = compareHands(target, target);
  assert(result.every((r) => r === "correct"), "동일 손패 비교 -> 전부 correct");
  assert(isWinningHand(target, target), "동일 손패 -> 승리 판정");
}

{
  const target = ["1m", "1m", "2m"];
  const guess = ["1m", "1m", "1m"];
  const result = compareHands(guess, target);
  assert(
    JSON.stringify(result) === JSON.stringify(["correct", "correct", "absent"]),
    `중복 타일 2-pass 처리: ${JSON.stringify(result)}`
  );
}
{
  const target = ["1m", "1m", "2m"];
  const guess = ["2m", "1m", "1m"];
  const result = compareHands(guess, target);
  assert(
    JSON.stringify(result) === JSON.stringify(["present", "correct", "present"]),
    `순서가 다른 중복 타일 처리: ${JSON.stringify(result)}`
  );
}

{
  const target = sortHand(YAKU_LIST[1].tiles);
  const partial = [target[0], null, null, null, null, null, null, null, null, null, null, null, null, null];
  const result = compareHands(partial, target);
  assert(result[0] === "correct", "부분 입력: 채워진 첫 칸 correct 판정");
  assert(result.slice(1).every((r) => r === "pending"), "부분 입력: 빈 칸은 pending 유지");
}

{
  const d = "2026-09-15";
  const a = pickDailyYaku(d);
  const b = pickDailyYaku(d);
  assert(a.id === b.id, "같은 날짜는 항상 같은 역을 선택 (결정적)");
}

{
  const counts = {};
  for (let i = 0; i < 365; i++) {
    const d = new Date(2026, 0, 1 + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const y = pickDailyYaku(key);
    counts[y.id] = (counts[y.id] || 0) + 1;
  }
  const usedCount = Object.keys(counts).length;
  assert(usedCount >= YAKU_LIST.length * 0.8, `365일 샘플에서 ${usedCount}/${YAKU_LIST.length}개 역이 등장 (고른 분포)`);
}

console.log(`\n총 ${failures === 0 ? "모두 통과" : failures + "건 실패"}`);
process.exit(failures === 0 ? 0 : 1);
