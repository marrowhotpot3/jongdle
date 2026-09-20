const path = require("path");
const { YAKU_LIST, sortHand } = require(path.join(__dirname, "..", "js", "data.js"));
const YakuEngine = require(path.join(__dirname, "..", "js", "yakuEngine.js"));

let failures = 0;
function assert(cond, msg) {
  if (cond) {
    console.log("ok  :", msg);
  } else {
    failures++;
    console.error("FAIL:", msg);
  }
}

YAKU_LIST.forEach((y) => {
  const satisfied = YakuEngine.getSatisfiedYaku(y.tiles);
  assert(satisfied.has(y.id), `${y.id}(${y.name}): 저장된 대표 손패가 실제로 ${y.id}를 성립시킴 (판정 결과: [${[...satisfied].join(", ")}])`);
});

{
  const chinitsu = YAKU_LIST.find((y) => y.id === "chinitsu");
  const satisfied = YakuEngine.getSatisfiedYaku(chinitsu.tiles);
  assert(satisfied.has("chinitsu"), "청일색 대표 손패 -> chinitsu 성립");
  assert(satisfied.has("honitsu"), "청일색 대표 손패 -> honitsu도 구조적으로 성립(raw)");
  const display = YakuEngine.resolveDisplayYaku(satisfied);
  assert(display.has("chinitsu"), "청일색은 표시 대상에 포함됨");
  assert(!display.has("honitsu"), "혼일색은 상위 역(청일색)에 대체되어 표시 대상에서 완전히 제외됨");
}

{
  const honitsu = YAKU_LIST.find((y) => y.id === "honitsu");
  const satisfied = YakuEngine.getSatisfiedYaku(honitsu.tiles);
  assert(satisfied.has("honitsu") && !satisfied.has("chinitsu"), "혼일색 대표 손패는 honitsu만 만족, chinitsu는 불만족");
  const display = YakuEngine.resolveDisplayYaku(satisfied);
  assert(display.has("honitsu"), "청일색이 성립하지 않으면 혼일색은 그대로 표시됨");
  assert(!display.has("chinitsu"), "청일색 조건 미달이므로 표시 대상 아님");
}

{
  const tsuuiisou = YAKU_LIST.find((y) => y.id === "tsuuiisou");
  const satisfied = YakuEngine.getSatisfiedYaku(tsuuiisou.tiles);
  assert(satisfied.has("tsuuiisou"), "자일색 대표 손패 -> tsuuiisou 성립");
  assert(satisfied.has("honitsu"), "자일색 대표 손패 -> honitsu도 구조적으로 성립(raw)");
  const display = YakuEngine.resolveDisplayYaku(satisfied);
  assert(display.has("tsuuiisou"), "자일색은 표시 대상에 포함됨");
  assert(!display.has("honitsu"), `혼일색은 상위 역(자일색)에 대체되어 표시 대상에서 완전히 제외됨 (실제: [${[...display].join(", ")}])`);
}

{
  const ryanpeikou = YAKU_LIST.find((y) => y.id === "ryanpeikou");
  const satisfied = YakuEngine.getSatisfiedYaku(ryanpeikou.tiles);
  assert(satisfied.has("ryanpeikou") && satisfied.has("iipeikou"), "량페코 대표 손패는 ryanpeikou와 iipeikou(raw) 모두 성립");
  const display = YakuEngine.resolveDisplayYaku(satisfied);
  assert(display.has("ryanpeikou") && !display.has("iipeikou"), `량페코만 표시, 이페코는 제외 (실제: [${[...display].join(", ")}])`);
}

{
  const ryanpeikou = YAKU_LIST.find((y) => y.id === "ryanpeikou");
  const satisfied = YakuEngine.getSatisfiedYaku(ryanpeikou.tiles);
  assert(!satisfied.has("chiitoitsu"), `량페코 대표 손패는 치또이쯔를 성립시키지 않음 (실제: [${[...satisfied].join(", ")}])`);
}

{
  const suuankou = YAKU_LIST.find((y) => y.id === "suuankou");
  const satisfied = YakuEngine.getSatisfiedYaku(suuankou.tiles);
  assert(satisfied.has("suuankou") && satisfied.has("sanankou"), "스안커 대표 손패는 suuankou와 sanankou(raw) 모두 성립");
  const display = YakuEngine.resolveDisplayYaku(satisfied);
  assert(display.has("suuankou") && !display.has("sanankou"), `스안커만 표시, 산안커는 제외 (실제: [${[...display].join(", ")}])`);
}

{
  const suuankou = YAKU_LIST.find((y) => y.id === "suuankou");
  const satisfied = YakuEngine.getSatisfiedYaku(suuankou.tiles);
  assert(satisfied.has("toitoi") && satisfied.has("suuankou"), "스안커 손패는 toitoi도 동시에 성립 (배타 관계 아님)");
  const display = YakuEngine.resolveDisplayYaku(satisfied);
  assert(display.has("toitoi") && display.has("suuankou"), `둘 다 표시 대상 (실제: [${[...display].join(", ")}])`);
}

{
  const kokushi = YAKU_LIST.find((y) => y.id === "kokushi");
  assert(YakuEngine.getSatisfiedYaku(kokushi.tiles).has("kokushi"), "국사무쌍 대표 손패 -> kokushi 성립");
  const chiitoitsu = YAKU_LIST.find((y) => y.id === "chiitoitsu");
  assert(YakuEngine.getSatisfiedYaku(chiitoitsu.tiles).has("chiitoitsu"), "치또이쯔 대표 손패 -> chiitoitsu 성립");
}

{
  const randomHand = ["1m", "1m", "1m", "9p", "9p", "9p", "1z", "1z", "1z", "2m", "3m", "4m", "5s", "5s"];
  const satisfied = YakuEngine.getSatisfiedYaku(randomHand);
  assert(!satisfied.has("tanyao"), "노두패 섞인 손패는 tanyao가 아님");
  assert(!satisfied.has("chinitsu"), "여러 슈트 섞인 손패는 chinitsu가 아님");
}

{
  const before = YakuEngine.getPossibleYaku([]);
  assert(before.has("tanyao"), "빈 손패에서는 tanyao가 아직 후보에 있음");
  const after = YakuEngine.getPossibleYaku(["1m"]);
  assert(!after.has("tanyao"), "1m(노두패)을 놓으면 tanyao 후보에서 제외됨");
  assert(after.has("chinroutou"), "1m은 청노두 후보를 유지시킴");
}

{
  const mixed = YakuEngine.getPossibleYaku(["1m", "1p"]);
  assert(!mixed.has("honitsu") && !mixed.has("chinitsu"), "두 슈트가 섞이면 혼일색/청일색 후보 제외");
}

{
  const unwinnable = ["2m", "3m", "4m", "5m", "6m", "7m", "8m", "2p", "3p", "4p", "5p", "6p", "7p", "8p"];
  const satisfied = YakuEngine.getSatisfiedYaku(unwinnable);
  assert(satisfied.size === 0, `짝 없는 손패는 화료 불가 -> 역 없음 (실제: [${[...satisfied].join(", ")}])`);
  assert(YakuEngine.isWinnableShape(unwinnable) === false, "isWinnableShape도 false를 반환");
}

{
  const tanyao = YAKU_LIST.find((y) => y.id === "tanyao");
  assert(YakuEngine.isWinnableShape(tanyao.tiles) === true, "탕야오 대표 손패는 isWinnableShape=true");
}

console.log(`\n총 ${failures === 0 ? "모두 통과" : failures + "건 실패"}`);
process.exit(failures === 0 ? 0 : 1);
