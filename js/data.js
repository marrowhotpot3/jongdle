const HONOR_NAMES = ["", "동", "남", "서", "북", "백", "발", "중"];
const HONOR_NAMES_FULL = ["", "동풍", "남풍", "서풍", "북풍", "백(白)", "발(發)", "중(中)"];

const TILE_LENGTH = 14;

function tileSortKey(tile) {
  const suit = tile[tile.length - 1];
  const num = parseInt(tile.slice(0, -1), 10);
  const suitOrder = { m: 0, p: 1, s: 2, z: 3 };
  return suitOrder[suit] * 100 + num;
}

function sortHand(tiles) {
  return [...tiles].sort((a, b) => tileSortKey(a) - tileSortKey(b));
}

function tileMeta(tile) {
  const suit = tile[tile.length - 1];
  const num = parseInt(tile.slice(0, -1), 10);
  if (suit === "z") {
    return {
      suit: "z",
      label: HONOR_NAMES[num],
      fullLabel: HONOR_NAMES_FULL[num],
      sr: `자패 ${HONOR_NAMES_FULL[num]}`,
    };
  }
  const suitLabel = { m: "만", p: "통", s: "삭" }[suit];
  return {
    suit,
    label: `${num}${suitLabel}`,
    fullLabel: `${num}${suitLabel}`,
    sr: `${num} ${suitLabel}`,
  };
}

const YAKU_LIST = [
  {
    id: "tanyao",
    name: "탕야오",
    hanja: "断幺九",
    category: "일반역",
    han: "1판",
    hanValue: 1,
    desc: "2~8의 숫자패로만 구성 (노두패·자패 없음)",
    tiles: ["2m","3m","4m","5m","5m","5p","6p","7p","4s","5s","6s","6s","7s","8s"],
  },
  {
    id: "pinfu",
    name: "핑후",
    hanja: "平和",
    category: "일반역",
    han: "1판 (멘젠 한정)",
    hanValue: 1,
    desc: "모든 몸통이 슌쯔, 머리는 역패가 아닌 패, 양면 대기",
    tiles: ["2m","3m","4m","5m","6m","7m","1p","2p","3p","3p","3p","7s","8s","9s"],
  },
  {
    id: "iipeikou",
    name: "이페코",
    hanja: "一盃口",
    category: "일반역",
    han: "1판 (멘젠 한정)",
    hanValue: 1,
    desc: "완전히 같은 슌쯔 두 조가 있음",
    tiles: ["2p","2p","3p","3p","4p","4p","4m","5m","6m","9m","9m","7s","8s","9s"],
  },
  {
    id: "yakuhai_haku",
    name: "역패 · 백",
    hanja: "役牌 白",
    category: "일반역",
    han: "1판",
    hanValue: 1,
    desc: "백(白) 커쯔 보유",
    tiles: ["5z","5z","5z","2m","3m","4m","5p","6p","7p","2s","2s","3s","4s","5s"],
  },
  {
    id: "yakuhai_hatsu",
    name: "역패 · 발",
    hanja: "役牌 發",
    category: "일반역",
    han: "1판",
    hanValue: 1,
    desc: "발(發) 커쯔 보유",
    tiles: ["6z","6z","6z","1m","2m","3m","5m","5m","4p","5p","6p","6s","7s","8s"],
  },
  {
    id: "yakuhai_chun",
    name: "역패 · 중",
    hanja: "役牌 中",
    category: "일반역",
    han: "1판",
    hanValue: 1,
    desc: "중(中) 커쯔 보유",
    tiles: ["7z","7z","7z","3m","4m","5m","6p","7p","8p","9p","9p","2s","3s","4s"],
  },
  {
    id: "sanshoku_doujun",
    name: "삼색동순",
    hanja: "三色同順",
    category: "일반역",
    han: "2판 (멘젠) / 1판 (후로)",
    hanValue: 2,
    desc: "같은 숫자의 슌쯔를 만·통·삭 세 색으로 완성",
    tiles: ["4m","5m","6m","4p","5p","6p","4s","5s","6s","1m","2m","3m","8s","8s"],
  },
  {
    id: "ittsuu",
    name: "일기통관",
    hanja: "一気通貫",
    category: "일반역",
    han: "2판 (멘젠) / 1판 (후로)",
    hanValue: 2,
    desc: "한 가지 색으로 1~9를 123·456·789로 모두 완성",
    tiles: ["1p","2p","3p","4p","5p","6p","7p","8p","9p","2m","3m","4m","5m","5m"],
  },
  {
    id: "chanta",
    name: "찬타",
    hanja: "混全帯幺九",
    category: "일반역",
    han: "2판 (멘젠) / 1판 (후로)",
    hanValue: 2,
    desc: "모든 몸통과 머리에 노두패 또는 자패가 하나씩 포함",
    tiles: ["1m","2m","3m","9m","9m","7p","8p","9p","1s","1s","1s","1z","1z","1z"],
  },
  {
    id: "sanshoku_doukou",
    name: "삼색동각",
    hanja: "三色同刻",
    category: "일반역",
    han: "2판",
    hanValue: 2,
    desc: "같은 숫자의 커쯔를 만·통·삭 세 색으로 완성",
    tiles: ["5m","5m","5m","5p","5p","5p","5s","5s","5s","2m","3m","4m","7p","7p"],
  },
  {
    id: "sanankou",
    name: "산안커",
    hanja: "三暗刻",
    category: "일반역",
    han: "2판",
    hanValue: 2,
    desc: "암커(숨긴 커쯔) 3개 보유",
    tiles: ["1m","1m","1m","2p","2p","2p","3s","3s","3s","4m","5m","6m","9s","9s"],
  },
  {
    id: "toitoi",
    name: "토이토이",
    hanja: "対々和",
    category: "일반역",
    han: "2판",
    hanValue: 2,
    desc: "손패 전체가 커쯔(4개)와 머리로만 구성 (슌쯔 없음)",
    tiles: ["1m","1m","1m","2p","2p","2p","3s","3s","3s","4s","4s","4s","6z","6z"],
  },
  {
    id: "shousangen",
    name: "소삼원",
    hanja: "小三元",
    category: "일반역",
    han: "2판",
    hanValue: 2,
    desc: "삼원패(백·발·중) 중 두 종류를 커쯔로, 나머지 한 종류를 머리로 보유",
    tiles: ["5z","5z","5z","6z","6z","6z","7z","7z","2m","3m","4m","5p","6p","7p"],
  },
  {
    id: "honroutou",
    name: "혼노두",
    hanja: "混老頭",
    category: "일반역",
    han: "2판",
    hanValue: 2,
    desc: "손패 전체가 노두패(1·9)와 자패의 커쯔·머리로만 구성",
    tiles: ["1m","1m","1m","9p","9p","9p","1z","1z","1z","5z","5z","5z","9s","9s"],
  },
  {
    id: "chiitoitsu",
    name: "치또이쯔",
    hanja: "七対子",
    category: "일반역",
    han: "2판 (멘젠 한정)",
    hanValue: 2,
    desc: "서로 다른 패 7쌍의 또이쯔로만 구성",
    tiles: ["2m","2m","5m","5m","3p","3p","8p","8p","4s","4s","7s","7s","6z","6z"],
  },
  {
    id: "junchan",
    name: "준찬타",
    hanja: "純全帯幺九",
    category: "일반역",
    han: "3판 (멘젠) / 2판 (후로)",
    hanValue: 3,
    desc: "찬타와 같지만 자패는 전혀 사용하지 않음 (노두패만)",
    tiles: ["1m","2m","3m","9m","9m","7p","8p","9p","1s","1s","1s","7s","8s","9s"],
  },
  {
    id: "honitsu",
    name: "혼일색",
    hanja: "混一色",
    category: "일반역",
    han: "3판 (멘젠) / 2판 (후로)",
    hanValue: 3,
    desc: "한 가지 수패 + 자패만으로 구성",
    tiles: ["1p","2p","3p","4p","5p","6p","9p","9p","9p","7z","7z","7z","5z","5z"],
  },
  {
    id: "ryanpeikou",
    name: "량페코",
    hanja: "二盃口",
    category: "일반역",
    han: "3판 (멘젠 한정)",
    hanValue: 3,
    desc: "이페코 두 조 (완전히 같은 슌쯔 조합이 두 쌍)",
    tiles: ["2m","2m","3m","3m","4m","4m","6p","6p","7p","7p","8p","8p","5s","5s"],
  },
  {
    id: "chinitsu",
    name: "청일색",
    hanja: "清一色",
    category: "일반역",
    han: "6판 (멘젠) / 5판 (후로)",
    hanValue: 6,
    desc: "한 가지 수패로만 손패 전체를 구성 (자패 없음)",
    tiles: ["1s","1s","1s","1s","2s","3s","4s","5s","6s","7s","8s","9s","9s","9s"],
  },

  {
    id: "kokushi",
    name: "국사무쌍",
    hanja: "国士無双",
    category: "역만",
    han: "역만",
    desc: "1·9패와 자패 13종을 각 1개씩 + 그중 1개를 머리로 추가",
    tiles: ["1m","9m","1p","9p","1s","9s","1z","2z","3z","4z","5z","6z","7z","7z"],
  },
  {
    id: "suuankou",
    name: "스안커",
    hanja: "四暗刻",
    category: "역만",
    han: "역만",
    desc: "암커(숨긴 커쯔) 4개를 모두 완성",
    tiles: ["1m","1m","1m","5p","5p","5p","9s","9s","9s","1z","1z","1z","5z","5z"],
  },
  {
    id: "chuurenpoutou",
    name: "구련보등",
    hanja: "九蓮宝燈",
    category: "역만",
    han: "역만",
    desc: "한 가지 색으로 1112345678999 형태를 완성",
    tiles: ["1m","1m","1m","2m","3m","4m","5m","5m","6m","7m","8m","9m","9m","9m"],
  },
  {
    id: "daisangen",
    name: "대삼원",
    hanja: "大三元",
    category: "역만",
    han: "역만",
    desc: "삼원패(백·발·중) 세 종류를 모두 커쯔로 완성",
    tiles: ["5z","5z","5z","6z","6z","6z","7z","7z","7z","2m","3m","4m","7p","7p"],
  },
  {
    id: "shousuushii",
    name: "소사희",
    hanja: "小四喜",
    category: "역만",
    han: "역만",
    desc: "사풍패 중 세 종류를 커쯔로, 나머지 한 종류를 머리로 보유",
    tiles: ["1z","1z","1z","2z","2z","2z","3z","3z","3z","4z","4z","4m","5m","6m"],
  },
  {
    id: "daisuushii",
    name: "대사희",
    hanja: "大四喜",
    category: "역만",
    han: "역만 (더블)",
    doubleYakuman: true,
    desc: "사풍패(동남서북) 네 종류를 모두 커쯔로 완성",
    tiles: ["1z","1z","1z","2z","2z","2z","3z","3z","3z","4z","4z","4z","5m","5m"],
  },
  {
    id: "tsuuiisou",
    name: "자일색",
    hanja: "字一色",
    category: "역만",
    han: "역만",
    desc: "손패 전체가 자패로만 구성",
    tiles: ["1z","1z","1z","2z","2z","2z","5z","5z","5z","6z","6z","6z","7z","7z"],
  },
  {
    id: "ryuuiisou",
    name: "녹일색",
    hanja: "緑一色",
    category: "역만",
    han: "역만",
    desc: "삭(索) 2·3·4·6·8과 발(發)만으로 구성 — 초록 패만 사용",
    tiles: ["2s","2s","2s","2s","3s","4s","6s","6s","6s","6z","6z","6z","8s","8s"],
  },
  {
    id: "chinroutou",
    name: "청노두",
    hanja: "清老頭",
    category: "역만",
    han: "역만",
    desc: "손패 전체가 노두패(1·9)의 커쯔와 머리로만 구성",
    tiles: ["1m","1m","1m","9m","9m","9m","1p","1p","1p","9s","9s","9s","9p","9p"],
  },
];

YAKU_LIST.forEach((y) => {
  if (y.tiles.length !== TILE_LENGTH) {
    throw new Error(`[data] ${y.id}: 손패가 14장이 아닙니다 (${y.tiles.length}장)`);
  }
});

if (typeof module !== "undefined" && module.exports) {
  module.exports = { YAKU_LIST, TILE_LENGTH, tileSortKey, sortHand, tileMeta, HONOR_NAMES, HONOR_NAMES_FULL };
}
