(function (root) {
  "use strict";

  const SUIT_BASE = { m: 0, p: 9, s: 18, z: 27 };

  function toIndex(code) {
    const suit = code[code.length - 1];
    const num = parseInt(code.slice(0, -1), 10);
    return SUIT_BASE[suit] + (num - 1);
  }
  function suitOf(idx) {
    if (idx < 9) return "m";
    if (idx < 18) return "p";
    if (idx < 27) return "s";
    return "z";
  }
  function rankOf(idx) {
    if (idx < 27) return idx % 9;
    return idx - 27;
  }
  function isHonorIdx(idx) {
    return idx >= 27;
  }
  function isTerminalOrHonorIdx(idx) {
    if (idx >= 27) return true;
    const r = idx % 9;
    return r === 0 || r === 8;
  }
  function isWindIdx(idx) {
    return idx >= 27 && idx <= 30;
  }
  function isDragonIdx(idx) {
    return idx >= 31 && idx <= 33;
  }

  function toCounts(idxTiles) {
    const counts = new Array(34).fill(0);
    idxTiles.forEach((i) => counts[i]++);
    return counts;
  }

  function decomposeSets(counts, memo) {
    const key = counts.join(",");
    if (memo.has(key)) return memo.get(key);
    if (counts.every((c) => c === 0)) return [[]];

    const idx = counts.findIndex((c) => c > 0);
    const results = [];

    if (counts[idx] >= 3) {
      const next = counts.slice();
      next[idx] -= 3;
      const subs = decomposeSets(next, memo);
      subs.forEach((s) => results.push([{ type: "triplet", tiles: [idx, idx, idx] }, ...s]));
    }

    if (idx < 27) {
      const rankInSuit = idx % 9;
      if (rankInSuit <= 6 && counts[idx + 1] > 0 && counts[idx + 2] > 0) {
        const next = counts.slice();
        next[idx]--;
        next[idx + 1]--;
        next[idx + 2]--;
        const subs = decomposeSets(next, memo);
        subs.forEach((s) => results.push([{ type: "sequence", tiles: [idx, idx + 1, idx + 2] }, ...s]));
      }
    }

    memo.set(key, results);
    return results;
  }

  function allDecompositions(idxTiles) {
    if (idxTiles.length !== 14) return [];
    const counts = toCounts(idxTiles);
    const out = [];
    const memo = new Map();
    for (let t = 0; t < 34; t++) {
      if (counts[t] >= 2) {
        const rest = counts.slice();
        rest[t] -= 2;
        const setsList = decomposeSets(rest, memo);
        setsList.forEach((sets) => {
          if (sets.length === 4) out.push({ pair: t, sets });
        });
      }
    }
    return out;
  }

  function isChiitoitsu(idxTiles, counts) {
    if (idxTiles.length !== 14) return false;
    const nonZero = counts.filter((c) => c > 0);
    return nonZero.length === 7 && nonZero.every((c) => c === 2);
  }

  const ORPHAN_IDX = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  function isKokushi(idxTiles, counts) {
    if (idxTiles.length !== 14) return false;
    if (idxTiles.some((i) => !ORPHAN_IDX.includes(i))) return false;
    const distinct = ORPHAN_IDX.filter((i) => counts[i] > 0).length;
    return distinct === 13;
  }

  function isChuurenpoutou(idxTiles, counts) {
    if (idxTiles.length !== 14) return false;
    const suits = new Set(idxTiles.filter((i) => i < 27).map(suitOf));
    if (suits.size !== 1 || idxTiles.some(isHonorIdx)) return false;
    const suit = [...suits][0];
    const base = SUIT_BASE[suit];
    for (let r = 0; r < 9; r++) {
      const need = r === 0 || r === 8 ? 3 : 1;
      if (counts[base + r] < need) return false;
    }
    return true;
  }

  const CHECKERS = {
    tanyao: (tiles) => tiles.every((i) => !isTerminalOrHonorIdx(i)),

    pinfu: (t, c, decomps) =>
      decomps.some((d) => d.pair < 27 && d.sets.every((s) => s.type === "sequence")),

    iipeikou: (t, c, decomps) =>
      decomps.some((d) => {
        const seqKeys = d.sets.filter((s) => s.type === "sequence").map((s) => s.tiles.join("-"));
        const freq = {};
        seqKeys.forEach((k) => (freq[k] = (freq[k] || 0) + 1));
        return Object.values(freq).some((n) => n >= 2);
      }),

    ryanpeikou: (t, c, decomps) =>
      decomps.some((d) => {
        const seqSets = d.sets.filter((s) => s.type === "sequence");
        if (seqSets.length !== 4) return false;
        const freq = {};
        seqSets.forEach((s) => {
          const k = s.tiles.join("-");
          freq[k] = (freq[k] || 0) + 1;
        });
        const vals = Object.values(freq);
        return vals.length === 2 && vals.every((v) => v === 2);
      }),

    yakuhai_haku: (t, c, decomps) =>
      decomps.some((d) => d.sets.some((s) => s.type === "triplet" && s.tiles[0] === toIndex("5z"))),
    yakuhai_hatsu: (t, c, decomps) =>
      decomps.some((d) => d.sets.some((s) => s.type === "triplet" && s.tiles[0] === toIndex("6z"))),
    yakuhai_chun: (t, c, decomps) =>
      decomps.some((d) => d.sets.some((s) => s.type === "triplet" && s.tiles[0] === toIndex("7z"))),

    sanshoku_doujun: (t, c, decomps) =>
      decomps.some((d) => {
        const bySuit = { m: new Set(), p: new Set(), s: new Set() };
        d.sets
          .filter((s) => s.type === "sequence")
          .forEach((s) => bySuit[suitOf(s.tiles[0])].add(s.tiles[0] % 9));
        for (const r of bySuit.m) if (bySuit.p.has(r) && bySuit.s.has(r)) return true;
        return false;
      }),

    ittsuu: (t, c, decomps) =>
      decomps.some((d) =>
        ["m", "p", "s"].some((suit) => {
          const starts = new Set(
            d.sets.filter((s) => s.type === "sequence" && suitOf(s.tiles[0]) === suit).map((s) => s.tiles[0] % 9)
          );
          return starts.has(0) && starts.has(3) && starts.has(6);
        })
      ),

    chanta: (t, c, decomps) =>
      decomps.some((d) => {
        const pairOk = isTerminalOrHonorIdx(d.pair);
        const setsOk = d.sets.every((s) => {
          if (s.type === "triplet") return isTerminalOrHonorIdx(s.tiles[0]);
          const r = s.tiles[0] % 9;
          return r === 0 || r === 6;
        });
        return pairOk && setsOk;
      }),

    junchan: (t, c, decomps) =>
      decomps.some((d) => {
        const isTerminalNotHonor = (i) => i < 27 && (i % 9 === 0 || i % 9 === 8);
        const pairOk = isTerminalNotHonor(d.pair);
        const setsOk = d.sets.every((s) => {
          if (s.type === "triplet") return isTerminalNotHonor(s.tiles[0]);
          const r = s.tiles[0] % 9;
          return r === 0 || r === 6;
        });
        return pairOk && setsOk;
      }),

    sanshoku_doukou: (t, c, decomps) =>
      decomps.some((d) => {
        const byRank = {};
        d.sets
          .filter((s) => s.type === "triplet" && s.tiles[0] < 27)
          .forEach((s) => {
            const r = s.tiles[0] % 9;
            (byRank[r] = byRank[r] || new Set()).add(suitOf(s.tiles[0]));
          });
        return Object.values(byRank).some((set) => set.size === 3);
      }),

    sanankou: (t, c, decomps) => decomps.some((d) => d.sets.filter((s) => s.type === "triplet").length >= 3),

    toitoi: (t, c, decomps) => decomps.some((d) => d.sets.every((s) => s.type === "triplet")),

    shousangen: (t, c, decomps) =>
      decomps.some((d) => d.sets.filter((s) => s.type === "triplet" && isDragonIdx(s.tiles[0])).length === 2 && isDragonIdx(d.pair)),

    honroutou: (t, c, decomps) =>
      t.every(isTerminalOrHonorIdx) && decomps.some((d) => d.sets.every((s) => s.type === "triplet")),

    chiitoitsu: (t, c, decomps) => isChiitoitsu(t, c) && decomps.length === 0,

    junchan_placeholder: null,

    honitsu: (t) => {
      const suits = new Set(t.filter((i) => i < 27).map(suitOf));
      return suits.size <= 1;
    },

    ryanpeikou_placeholder: null,

    chinitsu: (t) => {
      const suits = new Set(t.filter((i) => i < 27).map(suitOf));
      return suits.size === 1 && !t.some(isHonorIdx);
    },

    kokushi: (t, c) => isKokushi(t, c),

    suuankou: (t, c, decomps) => decomps.some((d) => d.sets.every((s) => s.type === "triplet")),

    chuurenpoutou: (t, c) => isChuurenpoutou(t, c),

    daisangen: (t, c, decomps) =>
      decomps.some((d) => d.sets.filter((s) => s.type === "triplet" && isDragonIdx(s.tiles[0])).length === 3),

    shousuushii: (t, c, decomps) =>
      decomps.some((d) => d.sets.filter((s) => s.type === "triplet" && isWindIdx(s.tiles[0])).length === 3 && isWindIdx(d.pair)),

    daisuushii: (t, c, decomps) =>
      decomps.some((d) => d.sets.filter((s) => s.type === "triplet" && isWindIdx(s.tiles[0])).length === 4),

    tsuuiisou: (t) => t.every(isHonorIdx),

    ryuuiisou: (t) => {
      const allowed = new Set(["2s", "3s", "4s", "6s", "8s", "6z"].map(toIndex));
      return t.every((i) => allowed.has(i));
    },

    chinroutou: (t, c, decomps) =>
      t.every((i) => i < 27 && (i % 9 === 0 || i % 9 === 8)) && decomps.some((d) => d.sets.every((s) => s.type === "triplet")),
  };
  delete CHECKERS.junchan_placeholder;
  delete CHECKERS.ryanpeikou_placeholder;
  CHECKERS.junchan = CHECKERS.junchan;

  function getSatisfiedYaku(tiles) {
    const result = new Set();
    if (tiles.length !== 14) return result;
    const idxTiles = tiles.map(toIndex);
    const counts = toCounts(idxTiles);
    const decomps = allDecompositions(idxTiles);
    const chiitoi = isChiitoitsu(idxTiles, counts);
    const kokushiFlag = isKokushi(idxTiles, counts);
    if (decomps.length === 0 && !chiitoi && !kokushiFlag) return result;
    Object.keys(CHECKERS).forEach((id) => {
      try {
        if (CHECKERS[id](idxTiles, counts, decomps)) result.add(id);
      } catch (e) {
      }
    });
    return result;
  }

  function isWinnableShape(tiles) {
    if (tiles.length !== 14) return false;
    const idxTiles = tiles.map(toIndex);
    const counts = toCounts(idxTiles);
    return allDecompositions(idxTiles).length > 0 || isChiitoitsu(idxTiles, counts) || isKokushi(idxTiles, counts);
  }

  const FAMILIES = [
    ["honitsu", "chinitsu"],
    ["honitsu", "tsuuiisou"],
    ["chanta", "junchan"],
    ["iipeikou", "ryanpeikou"],
    ["sanankou", "suuankou"],
    ["shousangen", "daisangen"],
    ["shousuushii", "daisuushii"],
    ["honroutou", "chinroutou"],
  ];

  function resolveDisplayYaku(satisfiedSet) {
    const superseded = new Set();
    FAMILIES.forEach(([looseId, strictId]) => {
      if (satisfiedSet.has(looseId) && satisfiedSet.has(strictId)) {
        superseded.add(looseId);
      }
    });
    const display = new Set();
    satisfiedSet.forEach((id) => {
      if (!superseded.has(id)) display.add(id);
    });
    return display;
  }

  function getPossibleYaku(partialTiles) {
    const idxTiles = partialTiles.map(toIndex);
    const counts = toCounts(idxTiles);
    const n = idxTiles.length;
    const remaining = 14 - n;
    const possible = new Set(Object.keys(CHECKERS));

    const disqualify = (id) => possible.delete(id);

    if (idxTiles.some(isTerminalOrHonorIdx)) disqualify("tanyao");

    if (counts.some((c) => c >= 3) || idxTiles.some(isHonorIdx)) disqualify("pinfu");

    const suitsUsed = new Set(idxTiles.filter((i) => i < 27).map(suitOf));
    if (suitsUsed.size >= 2) {
      disqualify("honitsu");
      disqualify("chinitsu");
      disqualify("chuurenpoutou");
    }
    if (idxTiles.some(isHonorIdx)) {
      disqualify("chinitsu");
      disqualify("chuurenpoutou");
    }

    if (idxTiles.some(isHonorIdx)) {
      disqualify("junchan");
      disqualify("chinroutou");
    }
    if (idxTiles.some((i) => !isTerminalOrHonorIdx(i))) {
      disqualify("honroutou");
      disqualify("chinroutou");
      disqualify("kokushi");
    }

    if (idxTiles.some((i) => i < 27)) disqualify("tsuuiisou");

    const ryuuAllowed = new Set(["2s", "3s", "4s", "6s", "8s", "6z"].map(toIndex));
    if (idxTiles.some((i) => !ryuuAllowed.has(i))) disqualify("ryuuiisou");

    if (idxTiles.some((i) => !ORPHAN_IDX.includes(i))) disqualify("kokushi");

    if (counts.some((c) => c >= 3)) disqualify("chiitoitsu");

    [
      ["yakuhai_haku", "5z"],
      ["yakuhai_hatsu", "6z"],
      ["yakuhai_chun", "7z"],
    ].forEach(([id, code]) => {
      const cnt = counts[toIndex(code)];
      if (cnt < 3 && cnt + remaining < 3) disqualify(id);
    });

    return possible;
  }

  const YakuEngine = {
    toIndex,
    suitOf,
    rankOf,
    getSatisfiedYaku,
    getPossibleYaku,
    isWinnableShape,
    resolveDisplayYaku,
    FAMILIES,
    CHECKERS,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = YakuEngine;
  } else {
    root.YakuEngine = YakuEngine;
  }
})(typeof window !== "undefined" ? window : globalThis);
