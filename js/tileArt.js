(function (root) {
  "use strict";

  const VB_W = 100;
  const VB_H = 135;

  const PIN_NAVY = "#263a7a";
  const PIN_RED = "#b23a2f";
  const SOU_GREEN = "#1c6b34";
  const SOU_RED = "#b23a2f";
  const DOT_FILL = "#f7f4ea";

  function svgWrap(inner) {
    return `<svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
  }

  function pinDot(cx, cy, red) {
    const color = red ? PIN_RED : PIN_NAVY;
    return `<circle cx="${cx}" cy="${cy}" r="9.5" fill="${color}"/>`;
  }

  function pinOneFace() {
    return svgWrap(`<circle cx="50" cy="68" r="30" fill="${PIN_RED}"/>`);
  }

  function souStick(cx, cy, red) {
    const color = red ? SOU_RED : SOU_GREEN;
    return `<rect x="${(cx - 5).toFixed(1)}" y="${(cy - 14).toFixed(1)}" width="10" height="28" rx="3" fill="${color}"/>`;
  }

  function souOneFace() {
    return svgWrap(
      `<circle cx="50" cy="68" r="22" fill="${SOU_GREEN}"/>` +
        `<circle cx="50" cy="68" r="9" fill="${DOT_FILL}"/>` +
        `<line x1="50" y1="46" x2="50" y2="30" stroke="${SOU_RED}" stroke-width="4" stroke-linecap="round"/>`
    );
  }

  function souEightFace() {
    return svgWrap(ROWS4.flatMap((y) => COL2.map((x) => souStick(x, y, false))).join(""));
  }

  const COL2 = [32, 68];
  const COL3 = [22, 50, 78];
  const ROWS3 = [28, 68, 108];
  const ROWS4 = [20, 49, 78, 107];

  const PIN_LAYOUTS = {
    2: [{ x: 50, y: 35 }, { x: 50, y: 101 }],
    3: [{ x: 30, y: 30 }, { x: 50, y: 68, red: true }, { x: 70, y: 106 }],
    4: [{ x: COL2[0], y: 35 }, { x: COL2[1], y: 35 }, { x: COL2[0], y: 101 }, { x: COL2[1], y: 101 }],
    5: [
      { x: COL2[0], y: 35 }, { x: COL2[1], y: 35 },
      { x: 50, y: 67, red: true },
      { x: COL2[0], y: 101 }, { x: COL2[1], y: 101 },
    ],
    6: [
      { x: COL2[0], y: ROWS3[0] }, { x: COL2[1], y: ROWS3[0] },
      { x: COL2[0], y: ROWS3[1], red: true }, { x: COL2[1], y: ROWS3[1], red: true },
      { x: COL2[0], y: ROWS3[2], red: true }, { x: COL2[1], y: ROWS3[2], red: true },
    ],
    7: [
      { x: 28, y: 20 }, { x: 50, y: 34 }, { x: 72, y: 48 },
      { x: COL2[0], y: 82, red: true }, { x: COL2[1], y: 82, red: true },
      { x: COL2[0], y: 116, red: true }, { x: COL2[1], y: 116, red: true },
    ],
    8: ROWS4.flatMap((y) => COL2.map((x) => ({ x, y }))),
    9: COL3.flatMap((x) => ROWS3.map((y) => ({ x, y, red: y === ROWS3[1] }))),
  };

  const SOU_LAYOUTS = {
    2: [{ x: 50, y: 35 }, { x: 50, y: 101 }],
    3: [{ x: 50, y: 30 }, { x: 30, y: 101 }, { x: 70, y: 101 }],
    4: [{ x: COL2[0], y: 35 }, { x: COL2[1], y: 35 }, { x: COL2[0], y: 101 }, { x: COL2[1], y: 101 }],
    5: [
      { x: COL2[0], y: 35 }, { x: COL2[1], y: 35 },
      { x: 50, y: 67, red: true },
      { x: COL2[0], y: 101 }, { x: COL2[1], y: 101 },
    ],
    6: [
      { x: COL2[0], y: ROWS3[0] }, { x: 50, y: ROWS3[0] }, { x: COL2[1], y: ROWS3[0] },
      { x: COL2[0], y: ROWS3[2] }, { x: 50, y: ROWS3[2] }, { x: COL2[1], y: ROWS3[2] },
    ],
    7: [
      { x: 50, y: 22, red: true },
      { x: COL2[0], y: 60 }, { x: 50, y: 60 }, { x: COL2[1], y: 60 },
      { x: COL2[0], y: 100 }, { x: 50, y: 100 }, { x: COL2[1], y: 100 },
    ],
    9: ROWS3.flatMap((y) => COL3.map((x) => ({ x, y, red: x === COL3[1] }))),
  };

  function pinFace(num) {
    if (num === 1) return pinOneFace();
    const dots = PIN_LAYOUTS[num].map((p) => pinDot(p.x, p.y, !!p.red)).join("");
    return svgWrap(dots);
  }

  function souFace(num) {
    if (num === 1) return souOneFace();
    if (num === 8) return souEightFace();
    const sticks = SOU_LAYOUTS[num].map((p) => souStick(p.x, p.y, !!p.red)).join("");
    return svgWrap(sticks);
  }

  const NUM_TO_HANJA = { 1: "一", 2: "二", 3: "三", 4: "四", 5: "伍", 6: "六", 7: "七", 8: "八", 9: "九" };

  function manFace(num) {
    return svgWrap(
      `<text x="50" y="58" text-anchor="middle" font-family="'Batang','Malgun Gothic','Apple SD Gothic Neo','Noto Serif CJK KR',serif" font-weight="700" font-size="44" fill="#20201b">${NUM_TO_HANJA[num]}</text>` +
        `<text x="50" y="112" text-anchor="middle" font-family="'Batang','Malgun Gothic','Apple SD Gothic Neo','Noto Serif CJK KR',serif" font-size="42" fill="#a23b2e">萬</text>`
    );
  }

  const HONOR_GLYPH = {
    1: { ch: "東", color: "#241f16" },
    2: { ch: "南", color: "#241f16" },
    3: { ch: "西", color: "#241f16" },
    4: { ch: "北", color: "#241f16" },
    6: { ch: "發", color: "#1d7a45" },
    7: { ch: "中", color: "#b23a2f" },
  };

  function honorFace(num) {
    if (num === 5) {
      return svgWrap("");
    }
    const g = HONOR_GLYPH[num];
    return svgWrap(
      `<text x="50" y="86" text-anchor="middle" font-family="'Batang','Malgun Gothic','Apple SD Gothic Neo','Noto Serif CJK KR',serif" font-weight="700" font-size="68" fill="${g.color}">${g.ch}</text>`
    );
  }

  function tileFaceSVG(code) {
    const suit = code[code.length - 1];
    const num = parseInt(code.slice(0, -1), 10);
    if (suit === "p") return pinFace(num);
    if (suit === "s") return souFace(num);
    if (suit === "m") return manFace(num);
    if (suit === "z") return honorFace(num);
    return svgWrap("");
  }

  const TileArt = { tileFaceSVG };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = TileArt;
  } else {
    root.TileArt = TileArt;
  }
})(typeof window !== "undefined" ? window : globalThis);
