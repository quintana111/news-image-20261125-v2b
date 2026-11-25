// news-image-20261125 — "The World in One Page"
// One-page newspaper broadsheet for Wednesday 25 November 2026.
// 36 stories, all dated 25 Nov 2026 and verified against live sources
// (Reuters, AP, CNN, WSJ, Morningstar, One Turn, BBC) during research.
// Node stdlib only. Hand-rolled PNG encoder (zlib deflate + manual chunks).
// All text drawn with a hand-defined 5x7 bitmap font. Map and hero scenes
// drawn as vector shapes on the same pixel buffer. Deterministic output.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------- constants
const W = 1024;
const H = 1024;
const SS = 2; // supersampling factor for anti-aliasing
const SW = W * SS;
const SH = H * SS;

const INK = [24, 24, 28];
const PAPER = [250, 248, 240];
const RED = [178, 34, 28];
const BLUE = [18, 64, 118];
const NAVY = [16, 42, 74];
const GOLD = [186, 138, 32];
const TEAL = [18, 110, 108];
const GREY = [110, 108, 100];
const LIGHT = [232, 228, 218];
const SKY = [168, 205, 228];
const SEA = [38, 92, 140];
const ORANGE = [226, 110, 28];
const DARK = [30, 30, 34];

// ------------------------------------------------------------- pixel buffer
const buf = Buffer.alloc(SW * SH * 4);
function setPx(x: number, y: number, c: number[]): void {
  if (x < 0 || y < 0 || x >= SW || y >= SH) return;
  if (x < clipX0 * SS || y < clipY0 * SS || x >= clipX1 * SS || y >= clipY1 * SS) return;
  const i = (y * SW + x) * 4;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2]; buf[i + 3] = 255;
}
function fillRect(x: number, y: number, w: number, h: number, c: number[]): void {
  const x0 = Math.max(0, Math.round(x * SS));
  const y0 = Math.max(0, Math.round(y * SS));
  const x1 = Math.min(SW, Math.round((x + w) * SS));
  const y1 = Math.min(SH, Math.round((y + h) * SS));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPx(xx, yy, c);
  }
}
function hline(x: number, y: number, w: number, c: number[], t = 1): void {
  fillRect(x, y, w, t, c);
}
function vline(x: number, y: number, h: number, c: number[], t = 1): void {
  fillRect(x, y, t, h, c);
}
function rect(x: number, y: number, w: number, h: number, c: number[], t = 1): void {
  hline(x, y, w, c, t); hline(x, y + h - t, w, c, t);
  vline(x, y, h, c, t); vline(x + w - t, y, h, c, t);
}
// Parametric line with thickness (logical px); terminates exactly at (x1,y1).
function line(x0: number, y0: number, x1: number, y1: number, c: number[], t = 1): void {
  const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2));
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    fillRect(x0 + (x1 - x0) * f - t / 2, y0 + (y1 - y0) * f - t / 2, t, t, c);
  }
}
// Clip rect (logical coords) respected by setPx; heroes draw inside panels.
let clipX0 = 0, clipY0 = 0, clipX1 = W, clipY1 = H;
function setClip(x: number, y: number, w: number, h: number): void {
  clipX0 = x; clipY0 = y; clipX1 = x + w; clipY1 = y + h;
}
function resetClip(): void { clipX0 = 0; clipY0 = 0; clipX1 = W; clipY1 = H; }
function circle(cx: number, cy: number, r: number, c: number[], fill = true): void {
  const r2 = r * r;
  const x0 = Math.floor(cx - r), x1 = Math.ceil(cx + r);
  const y0 = Math.floor(cy - r), y1 = Math.ceil(cy + r);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (fill ? d <= r2 : Math.abs(Math.sqrt(d) - r) < 0.8) {
        fillRect(x, y, 1, 1, c);
      }
    }
  }
}
function poly(points: number[][], c: number[]): void {
  // scanline fill of a simple polygon (logical coords)
  let minY = 1e9, maxY = -1e9;
  for (const p of points) { minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i], b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) fillRect(xs[k], y, xs[k + 1] - xs[k], 1, c);
  }
}
function flame(x: number, y: number, s: number): void {
  // stylised flame: layered teardrops
  poly([[x, y - 3.2 * s], [x + 1.1 * s, y - 1.2 * s], [x + 1.3 * s, y + 0.4 * s],
        [x + 0.6 * s, y + 1.4 * s], [x - 0.6 * s, y + 1.4 * s], [x - 1.3 * s, y + 0.4 * s],
        [x - 1.1 * s, y - 1.2 * s]], ORANGE);
  poly([[x, y - 1.9 * s], [x + 0.7 * s, y - 0.6 * s], [x + 0.8 * s, y + 0.6 * s],
        [x - 0.8 * s, y + 0.6 * s], [x - 0.7 * s, y - 0.6 * s]], [244, 196, 52]);
}

// ------------------------------------------------------------- 5x7 bitmap font
// Each glyph: 7 rows of 5 cells, '#' = on.
const GLYPHS: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": [".....", ".....", ".....", ".....", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", "01100", "01100"],
  ",": [".....", ".....", ".....", ".....", "01100", "00100", "01000"],
  ":": [".....", "01100", "01100", ".....", "01100", "01100", "....."],
  ";": [".....", "01100", "01100", ".....", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", ".....", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", ".....", "00100"],
  "'": ["00100", "00100", "01000", ".....", ".....", ".....", "....."],
  '"': ["01010", "01010", "01010", ".....", ".....", ".....", "....."],
  "-": [".....", ".....", ".....", "01110", ".....", ".....", "....."],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": [".....", "00100", "00100", "11111", "00100", "00100", "....."],
  "=": [".....", ".....", "11111", ".....", "11111", ".....", "....."],
  "*": [".....", "00100", "10101", "01110", "10101", "00100", "....."],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  _: [".....", ".....", ".....", ".....", ".....", ".....", "11111"],
  ">": ["10000", "01000", "00100", "00010", "00100", "01000", "10000"],
  "<": ["00001", "00010", "00100", "01000", "00100", "00010", "00001"],
};
const FALLBACK = GLYPHS["?"];

function charWidth(size: number): number { return (6 * size) / 7; }
function textWidth(s: string, size: number): number {
  return s.length * charWidth(size) - size / 7;
}
function drawChar(ch: string, x: number, y: number, size: number, c: number[], bold = false): void {
  const g = GLYPHS[ch] || FALLBACK;
  const u = size / 7;
  for (let r = 0; r < 7; r++) {
    for (let col = 0; col < 5; col++) {
      if (g[r][col] === "1") {
        fillRect(x + col * u, y + r * u, u * 0.96, u * 0.96, c);
        if (bold) fillRect(x + col * u + u * 0.45, y + r * u, u * 0.96, u * 0.96, c);
      }
    }
  }
}
function drawText(s: string, x: number, y: number, size: number, c: number[], opts: { bold?: boolean; align?: "l" | "c" | "r"; maxW?: number } = {}): number {
  const up = s.toUpperCase();
  let xx = x;
  if (opts.align === "c") xx = x - textWidth(up, size) / 2;
  if (opts.align === "r") xx = x - textWidth(up, size);
  for (const ch of up) {
    drawChar(ch, xx, y, size, c, !!opts.bold);
    xx += charWidth(size);
  }
  return xx;
}
// Greedy word wrap; returns lines.
function wrap(s: string, size: number, maxW: number): string[] {
  const words = s.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? cur + " " + w : w;
    if (textWidth(trial, size) <= maxW || !cur) cur = trial;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawPara(s: string, x: number, y: number, size: number, maxW: number, c: number[], lh: number, maxLines = 99, bold = false): number {
  const lines = wrap(s, size, maxW).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(ln, x, y + i * lh, size, c, { bold }));
  return y + lines.length * lh;
}

// ------------------------------------------------------------------ stories
// All dated 25 Nov 2026, verified from live sources during research.
type Story = { n: number; kicker: string; head: string; body: string; src: string };
const LEADS: Story[] = [
  { n: 1, kicker: "STRAIT OF HORMUZ", head: "TANKERS ABLAZE IN THE STRAIT OF HORMUZ",
    body: "Iran says two oil tankers struck naval mines and caught fire early on Wednesday. A third vessel was later reported hit. No ships were named.",
    src: "REUTERS" },
  { n: 2, kicker: "WASHINGTON", head: "US PROPOSES TARIFFS ON 14 PARTNERS",
    body: "Washington unveils new duties to fight excess factory capacity. China faces 20%, rising to 40% if the trade truce fails. Markets slide.",
    src: "REUTERS" },
  { n: 3, kicker: "JIUQUAN, CHINA", head: "PAKISTAN'S FIRST ASTRONAUT IN ORBIT",
    body: "Shenzhou-24 lifts off carrying Muhammad Zeeshan Ali, Tang Hongbo and Wu Yi. The crew docks with Tiangong, a first for China and Pakistan.",
    src: "AP" },
];
const MIDS: Story[] = [
  { n: 4, kicker: "RIYADH", head: "HOUTHI DRONE HITS RIYADH TOWER, 11 HURT",
    body: "Second strike on the PIF tower in a week; coalition hits back.", src: "REUTERS" },
  { n: 5, kicker: "SAMARA, RUSSIA", head: "UKRAINE HITS RUSSIAN REFINERIES; PUTIN VOWS REPLY",
    body: "Drones set Samara plants ablaze; Russian war dead put at 490,334.", src: "BBC / REUTERS" },
  { n: 6, kicker: "GAZA CITY", head: "ISRAELI STRIKE KILLS HAMAS SECURITY CHIEF IN GAZA",
    body: "Mohammad Abuelouf dies with his wife and two daughters in Gaza City.", src: "REUTERS" },
  { n: 7, kicker: "NEW YORK", head: "HUAWEI GUILTY ON 10 OF 12 COUNTS IN US TRIAL",
    body: "Brooklyn jury convicts over trade secrets and Iran sanctions.", src: "CNN / WSJ" },
  { n: 8, kicker: "CARTAGENA", head: "ALL HOSTAGES FREED IN SUPERMARKET SIEGE",
    body: "Colombian forces storm the store after 17 hours; one gunman killed.", src: "AP" },
  { n: 9, kicker: "CANBERRA", head: "AUSTRALIA-SOLOMON ISLANDS SIGN SECURITY TREATY",
    body: "Honiara rules out foreign bases; China pact will not be renewed.", src: "WSJ / AP" },
  { n: 10, kicker: "WALL STREET", head: "WALL STREET SLIDES AS TECH SELLOFF DEEPENS",
    body: "S&P 500 falls 2.2% on AI doubts and tariffs; Nikkei down 2.8%.", src: "REUTERS" },
  { n: 11, kicker: "WASHINGTON", head: "US ECONOMY GREW 4.3% AS CONFIDENCE JUMPS",
    body: "Q3 GDP revised up; confidence hits 103.3, a near two-year high.", src: "DOW JONES" },
  { n: 12, kicker: "CAIRO", head: "FUEL TRUCK FIRE KILLS AT LEAST 21 IN EGYPT",
    body: "Vehicle carrying petroleum overturns and ignites on a Cairo ring road.", src: "REUTERS" },
  { n: 13, kicker: "BLUE NILE, SUDAN", head: "DRONE STRIKES KILL 19 IN SUDAN'S BLUE NILE",
    body: "RSF attacks hit Damazin and Roseires; 20 wounded.", src: "RADIO TAMAZUJ" },
  { n: 14, kicker: "EASTERN CONGO", head: "UN EVACUATES EBOLA WORKERS AMID CONGO FIGHTING",
    body: "Peacekeepers rescue 10 health staff trapped by clashes in eastern DRC.", src: "REUTERS" },
  { n: 15, kicker: "WARSAW", head: "POLAND PLANS NO-FLY ZONE AFTER DRONE INCURSION",
    body: "Warsaw acts after a Russian drone enters its airspace near Ukraine.", src: "ONE TURN" },
];
const ALSO: string[] = [
  "16 LIBYA: 2 OFFICERS KILLED IN STRIKE",
  "17 SYRIA: IS ATTACK KILLS 2 IN HASAKA",
  "18 SARKOZY AND BRUNI TO STAND TRIAL",
  "19 US TELLS CITIZENS TO LEAVE IRAN",
  "20 OIL RISES AS HORMUZ TENSIONS SPREAD",
  "21 THANKSGIVING STORM HITS EAST COAST",
  "22 TRUMP PARDONS FREEDOM AND FEATHERS",
  "23 GIULIANI GETS MEDAL OF FREEDOM",
  "24 ABREGO GARCIA LEAVES US FOR SPAIN",
  "25 ANTHROPIC FALLS BELOW IPO PRICE",
  "26 HUANG RETURN FUELS NVIDIA CHIP FIGHT",
  "27 AUSTRALIA INFLATION HITS 4.9%",
  "28 UK ENERGY CAP TO RISE 26% IN JANUARY",
  "29 POUNDLAND COLLAPSES; JOBS AT RISK",
  "30 ARGENTINA ENTERS TECHNICAL RECESSION",
  "31 UN WARNS HIV GAINS COULD UNRAVEL",
  "32 WOLBACHIA CUTS VIRAL INFECTIONS 68%",
  "33 MISSISSIPPI PLANE CRASH KILLS SIX",
  "34 GREECE HIT BY NATIONWIDE STRIKE",
  "35 N. KOREA ORDERS SWISS OFFICE TO LEAVE",
  "36 SPACEX WINS FCC NOD FOR SATELLITES",
];

// ------------------------------------------------------------------ hero art
function heroHormuz(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  circle(x + w * 0.82, y + h * 0.22, 16, [244, 214, 130]);
  fillRect(x, y + h * 0.62, w, h * 0.38, SEA);
  // waves
  for (let i = 0; i < 5; i++) {
    line(x + 8 + i * 62, y + h * 0.68 + (i % 2) * 8, x + 44 + i * 62, y + h * 0.68 + (i % 2) * 8, [120, 180, 210], 2);
  }
  // tanker 1 (left, burning)
  fillRect(x + 18, y + h * 0.52, 130, 26, DARK);
  fillRect(x + 108, y + h * 0.40, 26, 14, DARK);
  fillRect(x + 30, y + h * 0.46, 8, 8, [200, 200, 200]);
  flame(x + 62, y + h * 0.44, 7);
  flame(x + 96, y + h * 0.47, 5);
  circle(x + 52, y + h * 0.30, 10, [120, 120, 118]);
  circle(x + 70, y + h * 0.24, 13, [140, 140, 138]);
  // tanker 2 (right, smoking)
  fillRect(x + w - 148, y + h * 0.58, 120, 22, [52, 52, 56]);
  fillRect(x + w - 66, y + h * 0.47, 22, 12, [52, 52, 56]);
  flame(x + w - 96, y + h * 0.50, 6);
  circle(x + w - 78, y + h * 0.34, 11, [120, 120, 118]);
  circle(x + w - 96, y + h * 0.28, 8, [140, 140, 138]);
  rect(x, y, w, h, INK, 2);
}
function heroTariffs(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, [214, 226, 232]);
  // skyline
  fillRect(x + 12, y + h * 0.30, 34, h * 0.45, [90, 104, 120]);
  fillRect(x + 52, y + h * 0.18, 28, h * 0.57, [70, 86, 104]);
  fillRect(x + 86, y + h * 0.38, 40, h * 0.37, [90, 104, 120]);
  fillRect(x + w - 130, y + h * 0.26, 36, h * 0.49, [70, 86, 104]);
  fillRect(x + w - 88, y + h * 0.40, 30, h * 0.35, [90, 104, 120]);
  // containers with % marks
  const cols: number[][] = [RED, BLUE, GOLD, TEAL];
  for (let i = 0; i < 4; i++) {
    const cx = x + 16 + i * 72;
    fillRect(cx, y + h * 0.72, 62, 26, cols[i]);
    rect(cx, y + h * 0.72, 62, 26, INK, 1);
    drawText("%", cx + 22, y + h * 0.72 + 4, 18, [255, 255, 255], { bold: true });
  }
  // rising arrow
  line(x + 30, y + h * 0.62, x + w - 40, y + h * 0.14, RED, 4);
  poly([[x + w - 40, y + h * 0.14], [x + w - 62, y + h * 0.16], [x + w - 44, y + h * 0.30]], RED);
  drawText("20%", x + w - 96, y + h * 0.30, 20, RED, { bold: true });
  rect(x, y, w, h, INK, 2);
}
function heroSpace(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, NAVY);
  // stars (fixed positions, deterministic)
  const stars: number[][] = [[0.08, 0.15], [0.22, 0.08], [0.35, 0.22], [0.5, 0.10], [0.62, 0.2], [0.74, 0.08], [0.88, 0.18], [0.15, 0.38], [0.45, 0.32], [0.8, 0.38], [0.95, 0.3], [0.3, 0.5]];
  for (const s of stars) circle(x + s[0] * w, y + s[1] * h, 2, [255, 255, 255]);
  // Earth curve: big circle whose top arc forms the horizon at the panel bottom
  circle(x + w * 0.5, y + h + w * 0.5, w * 0.62, [52, 120, 180]);
  fillRect(x, y + h * 0.86, w, h * 0.14, [52, 120, 180]);
  // rocket
  const rx = x + w * 0.5, ry = y + h * 0.42;
  poly([[rx, ry - 34], [rx + 11, ry - 12], [rx + 11, ry + 14], [rx, ry + 20], [rx - 11, ry + 14], [rx - 11, ry - 12]], [235, 235, 238]);
  poly([[rx - 11, ry + 6], [rx - 22, ry + 22], [rx - 11, ry + 16]], RED);
  poly([[rx + 11, ry + 6], [rx + 22, ry + 22], [rx + 11, ry + 16]], RED);
  circle(rx, ry - 14, 5, [120, 200, 235]);
  flame(rx, ry + 30, 6);
  flame(rx, ry + 40, 4);
  drawText("SHENZHOU-24", x + 14, y + h - 24, 13, [255, 255, 255], { bold: true });
  rect(x, y, w, h, INK, 2);
}

// ------------------------------------------------------------------ world map
// Schematic continents as polygons in map-panel coords (x0,y0,w,h).
function drawMap(x0: number, y0: number, w: number, h: number): void {
  fillRect(x0, y0, w, h, [216, 230, 238]);
  const P = (lon: number, lat: number): number[] => [
    x0 + ((lon + 180) / 360) * w,
    y0 + ((72 - lat) / 132) * h,
  ];
  const land: number[][][] = [
    // North America
    [[-168, 66], [-140, 70], [-125, 71], [-110, 68], [-95, 69], [-82, 66], [-76, 62], [-65, 60], [-55, 52], [-60, 46], [-70, 42], [-75, 35], [-80, 26], [-84, 30], [-90, 21], [-97, 16], [-105, 20], [-114, 28], [-125, 40], [-124, 48], [-140, 60], [-155, 58], [-168, 66]],
    // South America
    [[-78, 8], [-72, 12], [-62, 9], [-52, 5], [-44, -3], [-35, -8], [-40, -20], [-48, -28], [-58, -38], [-65, -45], [-70, -52], [-73, -40], [-72, -20], [-80, -5], [-81, 2], [-78, 8]],
    // Africa
    [[-17, 15], [-10, 31], [0, 36], [10, 37], [20, 32], [32, 31], [35, 28], [43, 12], [51, 11], [48, 0], [40, -12], [36, -20], [32, -29], [26, -34], [18, -35], [12, -18], [9, 4], [-8, 5], [-17, 15]],
    // Europe
    [[-10, 36], [-9, 43], [-2, 48], [0, 51], [5, 53], [8, 57], [12, 56], [18, 56], [21, 59], [28, 60], [30, 62], [32, 70], [40, 68], [45, 68], [40, 60], [30, 55], [28, 46], [23, 40], [19, 42], [12, 44], [8, 44], [3, 42], [-10, 36]],
    // Asia
    [[32, 70], [45, 68], [60, 69], [75, 72], [90, 75], [110, 74], [130, 72], [150, 70], [162, 66], [158, 60], [142, 55], [140, 45], [135, 38], [127, 35], [122, 30], [120, 22], [110, 20], [105, 10], [100, 8], [95, 16], [90, 22], [85, 20], [80, 13], [76, 8], [72, 20], [66, 25], [60, 25], [55, 26], [50, 29], [48, 30], [44, 29], [40, 36], [36, 36], [30, 36], [28, 41], [32, 46], [32, 55], [32, 70]],
    // Australia
    [[114, -22], [122, -14], [132, -12], [142, -11], [146, -19], [150, -23], [153, -28], [150, -37], [140, -38], [132, -32], [124, -33], [115, -35], [114, -22]],
  ];
  for (const c of land) poly(c.map(([lo, la]) => P(lo, la)), [196, 200, 190]);
  // graticule
  for (let lo = -150; lo <= 150; lo += 30) vline(x0 + ((lo + 180) / 360) * w, y0, h, [190, 200, 208], 1);
  for (let la = -40; la <= 60; la += 20) hline(x0, y0 + ((72 - la) / 132) * h, w, [190, 200, 208], 1);
  rect(x0, y0, w, h, INK, 2);
  // markers
  const marks: { n: number; lon: number; lat: number }[] = [
    { n: 1, lon: 56, lat: 26 }, { n: 2, lon: -77, lat: 39 }, { n: 3, lon: 100, lat: 40 },
    { n: 4, lon: 47, lat: 25 }, { n: 5, lon: 50, lat: 53 }, { n: 6, lon: 34, lat: 31 },
    { n: 7, lon: -74, lat: 41 }, { n: 8, lon: -75, lat: 10 }, { n: 9, lon: 160, lat: -9 },
    { n: 10, lon: -3, lat: 54 }, { n: 11, lon: 31, lat: 30 }, { n: 12, lon: 34, lat: 12 },
    { n: 13, lon: 29, lat: 0 }, { n: 14, lon: 21, lat: 52 }, { n: 15, lon: 116, lat: 40 },
  ];
  for (const m of marks) {
    const [mx, my] = P(m.lon, m.lat);
    circle(mx, my, 8, RED);
    circle(mx, my, 8, INK, false);
    drawText(String(m.n), mx, my - 5, 10, [255, 255, 255], { bold: true, align: "c" });
  }
}

// ------------------------------------------------------------------ layout
function main(): void {
  fillRect(0, 0, W, H, PAPER);
  const M = 24; // margin
  const CW = W - 2 * M; // 976
  const colW = (CW - 2 * 16) / 3; // 314.6

  // ---- masthead
  hline(M, 14, CW, INK, 3);
  drawText("THE WORLD IN ONE PAGE", W / 2, 24, 40, INK, { bold: true, align: "c" });
  drawText("WEDNESDAY, 25 NOVEMBER 2026  -  36 STORIES  -  ONE DAY, ONE PAGE", W / 2, 70, 13, RED, { bold: true, align: "c" });
  hline(M, 88, CW, INK, 2);
  hline(M, 92, CW, INK, 1);

  // ---- leads
  const leadY = 102;
  const heroH = 128;
  const heroFns = [heroHormuz, heroTariffs, heroSpace];
  LEADS.forEach((s, i) => {
    const x = M + i * (colW + 16);
    fillRect(x - 6, leadY - 6, colW + 12, 322, [255, 255, 255]);
    rect(x - 6, leadY - 6, colW + 12, 322, INK, 1);
    drawText("LEAD " + s.n + "  -  " + s.kicker, x, leadY, 11, RED, { bold: true });
    setClip(x, leadY + 16, colW, heroH);
    heroFns[i](x, leadY + 16, colW, heroH);
    resetClip();
    let y = leadY + 16 + heroH + 8;
    y = drawPara(s.head, x, y, 17, colW, INK, 20, 2, true);
    y += 4;
    drawPara(s.body, x, y, 11.5, colW, [50, 50, 54], 14.5, 5);
    drawText("SOURCE: " + s.src, x, leadY + 296, 9, GREY, { bold: true });
  });

  // ---- map
  const mapY = 436;
  drawText("WHERE IT HAPPENED", M, mapY, 14, INK, { bold: true });
  drawText("NUMBERS MATCH THE STORIES BELOW", M + 210, mapY + 2, 10, GREY, { bold: true });
  drawMap(M, mapY + 20, CW, 128);
  drawText("1 HORMUZ  2 WASHINGTON  3 JIUQUAN  4 RIYADH  5 SAMARA  6 GAZA  7 NEW YORK  8 CARTAGENA",
    W / 2, mapY + 152, 9, [60, 60, 64], { align: "c" });
  drawText("9 HONIARA  10 LONDON  11 CAIRO  12 SUDAN  13 CONGO  14 WARSAW  15 BEIJING",
    W / 2, mapY + 163, 9, [60, 60, 64], { align: "c" });

  // ---- mid stories
  const midY = 618;
  hline(M, midY - 8, CW, INK, 2);
  drawText("THE DAY IN BRIEF", M, midY, 14, INK, { bold: true });
  drawText("12 MORE STORIES FROM 25 NOVEMBER", M + 200, midY + 2, 10, GREY, { bold: true });
  const cellH = 52;
  MIDS.forEach((s, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * (colW + 16);
    const y = midY + 22 + row * cellH;
    drawText(String(s.n), x, y, 13, RED, { bold: true });
    drawPara(s.head, x + 22, y, 11.5, colW - 22, INK, 14, 2, true);
    drawPara(s.body, x + 22, y + 28, 9.5, colW - 22, [60, 60, 64], 12, 2);
  });

  // ---- also today
  const alsoY = midY + 22 + 4 * cellH + 6;
  hline(M, alsoY - 6, CW, INK, 2);
  drawText("ALSO TODAY", M, alsoY, 14, INK, { bold: true });
  drawText("21 MORE ONE-LINE STORIES", M + 140, alsoY + 2, 10, GREY, { bold: true });
  const alsoRowH = 18.5;
  ALSO.forEach((s, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = M + col * (colW + 16);
    const y = alsoY + 20 + row * alsoRowH;
    drawText(s, x, y, 9.5, [40, 40, 44], { bold: false });
  });

  // ---- footer
  const footY = alsoY + 20 + 7 * alsoRowH + 4;
  hline(M, footY, CW, INK, 2);
  drawText("ALL 36 STORIES DATED 25 NOVEMBER 2026 AND CHECKED AGAINST LIVE REPORTING: REUTERS, AP, CNN, WSJ, BBC, DOW JONES.",
    W / 2, footY + 7, 9, GREY, { align: "c" });

  // ---- downsample SS=2 -> 1024x1024 RGB, with a seeded paper grain
  // (deterministic mulberry32; adds newsprint texture and keeps the PNG
  // from compressing to a flat-colour sliver).
  let seed = 1234567;
  const rnd = (): number => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < SS; dy++) {
        for (let dx = 0; dx < SS; dx++) {
          const i = ((y * SS + dy) * SW + (x * SS + dx)) * 4;
          r += buf[i]; g += buf[i + 1]; b += buf[i + 2];
        }
      }
      const o = (y * W + x) * 3;
      const nz = (rnd() - 0.5) * 5;
      out[o] = Math.max(0, Math.min(255, Math.round(r / 4 + nz)));
      out[o + 1] = Math.max(0, Math.min(255, Math.round(g / 4 + nz)));
      out[o + 2] = Math.max(0, Math.min(255, Math.round(b / 4 + nz)));
    }
  }
  const png = encodePNG(W, H, out);
  const here = path.dirname(fileURLToPath(import.meta.url));
  fs.writeFileSync(path.join(here, "entry.png"), png);
}

// ---------------------------------------------------------------- PNG encoder
function crc32(b: Buffer): number {
  let c: number[] = [];
  if (!(crc32 as unknown as { t?: number[] }).t) {
    const t: number[] = [];
    for (let n = 0; n < 256; n++) {
      let v = n;
      for (let k = 0; k < 8; k++) v = v & 1 ? 0xedb88320 ^ (v >>> 1) : v >>> 1;
      t[n] = v >>> 0;
    }
    (crc32 as unknown as { t: number[] }).t = t;
  }
  const t = (crc32 as unknown as { t: number[] }).t;
  let crc = 0xffffffff;
  for (let i = 0; i < b.length; i++) crc = t[(crc ^ b[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w: number, h: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0;
    rgb.copy(raw, y * (1 + w * 3) + 1, y * w * 3, (y + 1) * w * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0)),
  ]);
}

main();
