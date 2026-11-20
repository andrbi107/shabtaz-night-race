'use strict';
(function () {
// ============================================================
// شب‌تاز: مسابقه شبانه — ShabTaz: Night Race
// A top-down neon arcade racer. Daily-seeded track + 3 ghost AI rivals.
// Pure vanilla JS. No libraries, no external fonts.
// ============================================================

// ---- Canvas & contexts ----
var canvas = document.getElementById('game');
var ctx = canvas.getContext('2d');
var mini = document.getElementById('mini');
var mctx = mini.getContext('2d');
var W = canvas.width, H = canvas.height;   // 1600 x 900 internal

// ---- Config (tweakable) ----
var CFG = {
  trackHalf: 74,        // half track width (full width ~148)
  laps: 3,
  carLen: 36, carWid: 20,
  pMax: 7.6,            // player top speed (world units / frame @60fps)
  pAccel: 0.165,
  pBrake: 0.245,
  pFriction: 0.991,
  pTurn: 0.050,         // base steer (rad/frame)
  nitroMax: 100,        // v0.0.2 — rechargeable nitro boost
  nitroDrain: 0.83,     // per frame @60fps → ~2s full use
  nitroRecharge: 0.21,  // per frame → ~8s full recharge
  nitroMult: 1.55,      // top-speed multiplier while active
  aiCount: 3
};

// Persian festive-neon palette
var COL = {
  bg0: '#0a0820', bg1: '#150f33', bg2: '#1b1542',
  track: '#15102e', trackEdgeIn: '#46e6ff', trackEdgeOut: '#ff5575',
  saffron: '#ffb62e', saffronLite: '#ffd75e',
  turquoise: '#35e0c6', violet: '#b69cff', magenta: '#ff5575',
  cyan: '#46e6ff', mist: '#e1e3ff', dim: '#a0a1c9', ink: '#0d0b20'
};

// ---- Helpers ----
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function fa(n) { try { return Number(n).toLocaleString('fa-IR'); } catch (e) { return String(n); } }
function toFa(s) {
  return String(s).replace(/[0-9]/g, function (d) { return '۰۱۲۳۴۵۶۷۸۹'[+d]; });
}
function formatTime(ms) {
  var t = Math.max(0, ms);
  var m = Math.floor(t / 60000);
  var s = Math.floor((t % 60000) / 1000);
  var c = Math.floor((t % 1000) / 10);
  return toFa(String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0'));
}

// mulberry32 PRNG — deterministic per seed
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dayNumber() { return Math.floor(Date.now() / 86400000); }

function ls(k, v) {
  try {
    if (v === undefined) return localStorage.getItem(k);
    if (v === null) localStorage.removeItem(k);
    else localStorage.setItem(k, v);
  } catch (e) {}
  return null;
}

// ============================================================
// Track generation — seeded by the day number
// ============================================================
function generateTrack(seed) {
  var rng = mulberry32(seed);
  var N = 14, baseR = 1500;
  var ctrl = [];
  for (var i = 0; i < N; i++) {
    var a = (i / N) * Math.PI * 2;
    var r = baseR
      + Math.sin(a * 2 + rng() * 6.28) * 300
      + Math.sin(a * 3 + rng() * 6.28) * 170
      + (rng() - 0.5) * 220;
    ctrl.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
  }
  // Catmull-Rom closed spline -> smooth centerline
  var seg = 18, ctr = [];
  for (i = 0; i < N; i++) {
    var p0 = ctrl[(i - 1 + N) % N], p1 = ctrl[i], p2 = ctrl[(i + 1) % N], p3 = ctrl[(i + 2) % N];
    for (var j = 0; j < seg; j++) {
      var t = j / seg, t2 = t * t, t3 = t2 * t;
      var x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
      var y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
      ctr.push({ x: x, y: y });
    }
  }
  var M = ctr.length, total = 0, data = [];
  for (i = 0; i < M; i++) {
    var p = ctr[i], n = ctr[(i + 1) % M];
    data.push({ x: p.x, y: p.y, s: total });
    total += Math.hypot(n.x - p.x, n.y - p.y);
  }
  for (i = 0; i < M; i++) {
    var nxp = data[(i + 1) % M], pv = data[(i - 1 + M) % M];
    var dx = nxp.x - pv.x, dy = nxp.y - pv.y, len = Math.hypot(dx, dy) || 1;
    data[i].tx = dx / len; data[i].ty = dy / len;       // tangent
    data[i].nx = -dy / len; data[i].ny = dx / len;      // normal
  }
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (i = 0; i < M; i++) {
    if (data[i].x < minX) minX = data[i].x;
    if (data[i].x > maxX) maxX = data[i].x;
    if (data[i].y < minY) minY = data[i].y;
    if (data[i].y > maxY) maxY = data[i].y;
  }
  return { center: data, totalLength: total, M: M, minX: minX, maxX: maxX, minY: minY, maxY: maxY };
}

// binary search: largest index with center[i].s <= progress
function progressToIndex(track, progress) {
  var ctr = track.center;
  var p = ((progress % track.totalLength) + track.totalLength) % track.totalLength;
  var lo = 0, hi = ctr.length - 1;
  while (lo < hi) {
    var mid = (lo + hi + 1) >> 1;
    if (ctr[mid].s <= p) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// local spiral search around lastIdx — keeps progress monotonic
function findClosestIndex(track, x, y, lastIdx) {
  var ctr = track.center, M = track.M;
  var base = (lastIdx == null) ? 0 : lastIdx;
  var best = base, bd = (ctr[base].x - x) * (ctr[base].x - x) + (ctr[base].y - y) * (ctr[base].y - y);
  var range = 26;
  for (var k = 1; k <= range; k++) {
    var i1 = (base + k) % M, i2 = (base - k + M) % M;
    var d1 = (ctr[i1].x - x) * (ctr[i1].x - x) + (ctr[i1].y - y) * (ctr[i1].y - y);
    var d2 = (ctr[i2].x - x) * (ctr[i2].x - x) + (ctr[i2].y - y) * (ctr[i2].y - y);
    if (d1 < bd) { bd = d1; best = i1; }
    if (d2 < bd) { bd = d2; best = i2; }
  }
  return best;
}

// ============================================================
// State
// ============================================================
var state = {
  mode: 'menu',          // menu | countdown | playing | paused | finished
  seed: 0, day: 0,
  track: null,
  raceTime: 0,
  lapTimes: [],
  bestLap: null,
  countdown: 0,
  finishInfo: null,
  cam: { x: 0, y: 0 },
  shake: 0
};
var input = { left: false, right: false, accel: false, brake: false, nitro: false };
var player = null, ais = [];

var AI_DEFS = [
  { name: 'فیروزه', color: COL.turquoise, baseSpeed: 7.05, lateral: -54 },
  { name: 'بنفش',  color: COL.violet,     baseSpeed: 6.72, lateral: -18 },
  { name: 'سرخ',   color: COL.magenta,    baseSpeed: 6.35, lateral: +54 }
];
var PLAYER_LATERAL = +18;

function makeCar(o) {
  return Object.assign({
    x: 0, y: 0, heading: 0, speed: 0,
    lap: 0, idx: 0, progress: 0, lateral: 0,
    color: '#fff', name: '', isAI: false, baseSpeed: 0,
    trail: [], finished: false, finishTime: 0,
    lapStartTime: 0, position: 0,
    nitro: 100, nitroActive: false
  }, o);
}

function setupRace() {
  var seed = dayNumber();
  state.seed = seed; state.day = seed;
  state.track = generateTrack(seed);
  // deterministic per-day AI variations
  var rng = mulberry32(seed ^ 0xA17A5);
  var aiList = AI_DEFS.map(function (d) {
    return {
      name: d.name, color: d.color,
      speed: d.baseSpeed + (rng() - 0.5) * 0.18,
      lateral: d.lateral + (rng() - 0.5) * 8
    };
  });
  var startP = state.track.center[0];
  var sh = Math.atan2(startP.ty, startP.tx);
  player = makeCar({
    x: startP.x + startP.nx * PLAYER_LATERAL,
    y: startP.y + startP.ny * PLAYER_LATERAL,
    heading: sh, color: COL.saffron, name: 'تو', lateral: PLAYER_LATERAL
  });
  ais = aiList.map(function (d) {
    return makeCar({
      isAI: true, name: d.name, color: d.color, baseSpeed: d.speed, lateral: d.lateral,
      x: startP.x + startP.nx * d.lateral, y: startP.y + startP.ny * d.lateral,
      heading: sh
    });
  });
  state.raceTime = 0;
  state.lapTimes = [];
  state.bestLap = null;
  state.finishInfo = null;
  state.cam.x = player.x; state.cam.y = player.y;
  state.shake = 0;
}

// ============================================================
// Update (fixed 60Hz)
// ============================================================
function update() {
  // ---- player input ----
  var sf = clamp(player.speed / CFG.pMax, 0, 1);
  if (input.left)  player.heading -= CFG.pTurn * (0.35 + sf * 0.85);
  if (input.right) player.heading += CFG.pTurn * (0.35 + sf * 0.85);
  if (input.accel) player.speed += CFG.pAccel;
  else             player.speed *= CFG.pFriction;
  if (input.brake) player.speed -= CFG.pBrake;
  // v0.0.2 — nitro boost: raises the top-speed ceiling while fuel lasts
  var effMax = CFG.pMax;
  if (input.nitro && player.nitro > 0 && player.speed > 0.05) {
    player.nitroActive = true;
    player.nitro = Math.max(0, player.nitro - CFG.nitroDrain);
    effMax = CFG.pMax * CFG.nitroMult;
  } else {
    player.nitroActive = false;
    player.nitro = Math.min(CFG.nitroMax, player.nitro + CFG.nitroRecharge);
  }
  player.speed = clamp(player.speed, 0, effMax);
  if (player.speed < 0.01) player.speed = 0;
  player.x += Math.cos(player.heading) * player.speed;
  player.y += Math.sin(player.heading) * player.speed;

  // trail
  player.trail.push({ x: player.x, y: player.y });
  if (player.trail.length > 20) player.trail.shift();

  // ---- progress + lap (index wrap) ----
  var M = state.track.M;
  var newIdx = findClosestIndex(state.track, player.x, player.y, player.idx);
  if (player.idx > M * 0.72 && newIdx < M * 0.28) {
    player.lap++;
    onLap(player);
  }
  player.idx = newIdx;
  player.progress = state.track.center[newIdx].s;

  // ---- wall: keep within track edge ----
  var cp = state.track.center[newIdx];
  var dx = player.x - cp.x, dy = player.y - cp.y;
  var along = dx * cp.nx + dy * cp.ny;       // signed lateral distance from centerline
  var limit = CFG.trackHalf - CFG.carWid / 2;
  if (Math.abs(along) > limit) {
    var over = Math.abs(along) - limit;
    var sign = along < 0 ? -1 : 1;
    player.x -= sign * over * cp.nx;
    player.y -= sign * over * cp.ny;
    player.speed *= 0.58;                      // bounce-slow
    state.shake = Math.max(state.shake, 5);
    beep(130, 0.05);
    if (window.MUX) MUX.hit();
  }

  // ---- AI: follow centerline at target speed ----
  for (var ai = 0; ai < ais.length; ai++) {
    var c = ais[ai];
    if (c.finished) continue;
    c.progress += c.baseSpeed;
    if (c.progress >= state.track.totalLength) {
      c.progress -= state.track.totalLength;
      c.lap++;
      if (c.lap >= CFG.laps) { c.finished = true; c.finishTime = state.raceTime; }
    }
    var idx = progressToIndex(state.track, c.progress);
    var pp = state.track.center[idx];
    c.x = pp.x + pp.nx * c.lateral;
    c.y = pp.y + pp.ny * c.lateral;
    c.heading = Math.atan2(pp.ty, pp.tx);
    c.idx = idx;
  }

  // ---- car-to-car collisions (gentle) ----
  var all = [player].concat(ais);
  for (var i = 0; i < all.length; i++) {
    for (var j = i + 1; j < all.length; j++) {
      carCollide(all[i], all[j]);
    }
  }

  // ---- camera (smooth follow) ----
  state.cam.x += (player.x - state.cam.x) * 0.12;
  state.cam.y += (player.y - state.cam.y) * 0.12;
  if (state.shake > 0) state.shake *= 0.9;

  // ---- timer ----
  state.raceTime += 1000 / 60;
}

function onLap(car) {
  if (car.lap >= 1 && car.lap <= CFG.laps) {
    var lt = state.raceTime - car.lapStartTime;
    if (lt > 800) {                              // ignore spurious first
      state.lapTimes.push(lt);
      if (state.bestLap === null || lt < state.bestLap) {
        state.bestLap = lt;
        // v0.0.5 — persist global best lap (seconds, 2 decimals) for cross-day record
        try { ls('shabtaz_bestlap', (lt / 1000).toFixed(2)); } catch (e) {}
      }
      // v0.0.5 — achievement: any player lap under 60s
      if (car === player && lt < 60000 && window.GK) {
        try { GK.achievement('sub60', 'Under 60s', 'Complete a lap in under 60 seconds'); } catch (e) {}
      }
    }
    car.lapStartTime = state.raceTime;
    if (car === player) { beep(660, 0.14); if (window.MUX) MUX.bump(); }
  }
  if (car === player && car.lap >= CFG.laps) finishRace();
}

function carCollide(a, b) {
  var dx = b.x - a.x, dy = b.y - a.y;
  var d = Math.hypot(dx, dy);
  var minD = CFG.carLen * 0.85;
  if (d < minD && d > 0.001) {
    var overlap = (minD - d) / 2;
    var nx = dx / d, ny = dy / d;
    a.x -= nx * overlap; a.y -= ny * overlap;
    b.x += nx * overlap; b.y += ny * overlap;
    var avg = (a.speed + b.speed) / 2;
    a.speed = a.speed * 0.6 + avg * 0.4;
    b.speed = b.speed * 0.6 + avg * 0.4;
    if (a === player || b === player) { beep(240, 0.05); state.shake = Math.max(state.shake, 3); }
  }
}

function computePositions() {
  var all = [player].concat(ais);
  for (var i = 0; i < all.length; i++) {
    all[i]._rank = all[i].lap * state.track.totalLength + all[i].progress;
  }
  all.sort(function (a, b) { return b._rank - a._rank; });
  for (i = 0; i < all.length; i++) all[i].position = i + 1;
  return all;
}

// ============================================================
// Finish
// ============================================================
function finishRace() {
  state.mode = 'finished';
  if (window.MUX) MUX.over();
  document.getElementById('frame').setAttribute('data-mode', 'finished');
  var totalTime = state.raceTime;
  var bestLap = state.bestLap;
  var ranked = computePositions();
  var playerPos = player.position;
  var day = state.day;

  var prevBestLap = null, prevBestTotal = null;
  try { prevBestLap = JSON.parse(ls('shabtaz.bestLap.' + day) || 'null'); } catch (e) {}
  try { prevBestTotal = JSON.parse(ls('shabtaz.bestTotal.' + day) || 'null'); } catch (e) {}
  var newLap = (prevBestLap === null) ? (bestLap !== null) : (bestLap !== null && bestLap < prevBestLap);
  var newTotal = (prevBestTotal === null) ? true : (totalTime < prevBestTotal);
  if (newLap && bestLap !== null) ls('shabtaz.bestLap.' + day, JSON.stringify(bestLap));
  if (newTotal) ls('shabtaz.bestTotal.' + day, JSON.stringify(totalTime));

  var hist = [];
  try { hist = JSON.parse(ls('shabtaz.history') || '[]'); } catch (e) {}
  hist.unshift({ day: day, date: new Date().toISOString(), position: playerPos, total: totalTime, bestLap: bestLap });
  hist = hist.slice(0, 20);
  ls('shabtaz.history', JSON.stringify(hist));

  state.finishInfo = { ranked: ranked, totalTime: totalTime, bestLap: bestLap, playerPos: playerPos, newLap: newLap, newTotal: newTotal };
  beep(880, 0.18);
  setTimeout(function () { beep(1320, 0.28); }, 130);
  showFinish();
}

// ============================================================
// Render
// ============================================================
var stars = [];
(function genStars() {
  var rng = mulberry32(987654);
  for (var i = 0; i < 160; i++) {
    stars.push({
      x: rng() * W, y: rng() * H,
      r: rng() * 1.8 + 0.5, ph: rng() * 6.28,
      c: ['#ffffff', '#cfe6ff', '#b69cff', '#ffd75e'][Math.floor(rng() * 4)]
    });
  }
})();

function drawBackground(ts) {
  var g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, COL.bg0); g.addColorStop(0.55, COL.bg1); g.addColorStop(1, COL.bg2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // nebula glow
  ctx.save();
  ctx.globalAlpha = 0.16;
  var bx = W * 0.32 - state.cam.x * 0.04, by = H * 0.4 - state.cam.y * 0.04;
  var rg = ctx.createRadialGradient(bx, by, 0, bx, by, 340);
  rg.addColorStop(0, COL.violet); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  var bx2 = W * 0.7 - state.cam.x * 0.04, by2 = H * 0.62 - state.cam.y * 0.04;
  var rg2 = ctx.createRadialGradient(bx2, by2, 0, bx2, by2, 300);
  rg2.addColorStop(0, COL.turquoise); rg2.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg2; ctx.fillRect(0, 0, W, H);
  ctx.restore();
  // parallax starfield
  var ox = state.cam.x * 0.12, oy = state.cam.y * 0.12;
  for (var i = 0; i < stars.length; i++) {
    var s = stars[i];
    var x = ((s.x - ox) % W + W) % W;
    var y = ((s.y - oy) % H + H) % H;
    ctx.globalAlpha = 0.25 + 0.55 * Math.sin(ts * 0.002 + s.ph);
    ctx.fillStyle = s.c;
    ctx.fillRect(x, y, s.r, s.r);
  }
  ctx.globalAlpha = 1;
}

function drawTrack() {
  var ctr = state.track.center, M = state.track.M, H2 = CFG.trackHalf;
  // fill ring (outer + inner hole, evenodd)
  ctx.beginPath();
  for (var i = 0; i < M; i++) {
    var p = ctr[i], x = p.x + p.nx * H2, y = p.y + p.ny * H2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  for (i = 0; i < M; i++) {
    p = ctr[i]; x = p.x - p.nx * H2; y = p.y - p.ny * H2;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = COL.track;
  ctx.fill('evenodd');
  // dashed center line
  ctx.save();
  ctx.setLineDash([16, 20]);
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(180,180,255,0.16)';
  ctx.beginPath();
  for (i = 0; i <= M; i++) { p = ctr[i % M]; if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); }
  ctx.stroke();
  ctx.restore();
  // outer edge (magenta) + inner edge (cyan) with neon glow
  ctx.save();
  ctx.lineWidth = 3; ctx.shadowBlur = 16;
  ctx.strokeStyle = COL.trackEdgeOut; ctx.shadowColor = COL.trackEdgeOut;
  ctx.beginPath();
  for (i = 0; i <= M; i++) { p = ctr[i % M]; var xo = p.x + p.nx * H2, yo = p.y + p.ny * H2; if (i === 0) ctx.moveTo(xo, yo); else ctx.lineTo(xo, yo); }
  ctx.stroke();
  ctx.strokeStyle = COL.trackEdgeIn; ctx.shadowColor = COL.trackEdgeIn;
  ctx.beginPath();
  for (i = 0; i <= M; i++) { p = ctr[i % M]; var xi = p.x - p.nx * H2, yi = p.y - p.ny * H2; if (i === 0) ctx.moveTo(xi, yi); else ctx.lineTo(xi, yi); }
  ctx.stroke();
  ctx.restore();
}

function drawStartLine() {
  var p = state.track.center[0], H2 = CFG.trackHalf;
  var cells = 8, cellLen = (H2 * 2) / cells, halfLen = 18;
  for (var i = 0; i < cells; i++) {
    var off = -H2 + i * cellLen;
    var x1 = p.x + p.nx * off, y1 = p.y + p.ny * off;
    var x2 = p.x + p.nx * (off + cellLen), y2 = p.y + p.ny * (off + cellLen);
    ctx.fillStyle = (i % 2 === 0) ? '#f0f0ff' : '#1a1530';
    ctx.beginPath();
    ctx.moveTo(x1 - p.tx * halfLen, y1 - p.ty * halfLen);
    ctx.lineTo(x2 - p.tx * halfLen, y2 - p.ty * halfLen);
    ctx.lineTo(x2 + p.tx * halfLen, y2 + p.ty * halfLen);
    ctx.lineTo(x1 + p.tx * halfLen, y1 + p.ty * halfLen);
    ctx.closePath();
    ctx.fill();
  }
}

function drawCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.heading);
  ctx.shadowColor = car.color; ctx.shadowBlur = 20;
  ctx.fillStyle = car.color;
  ctx.fillRect(-CFG.carLen / 2, -CFG.carWid / 2, CFG.carLen, CFG.carWid);
  ctx.shadowBlur = 0;
  // cockpit
  ctx.fillStyle = 'rgba(8,6,24,0.55)';
  ctx.fillRect(-CFG.carLen / 2 + 7, -CFG.carWid / 2 + 3, CFG.carLen - 18, CFG.carWid - 6);
  // front tip (direction)
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillRect(CFG.carLen / 2 - 6, -2.5, 5, 5);
  ctx.restore();
}

function drawTrail() {
  for (var i = 0; i < player.trail.length; i++) {
    var t = player.trail[i];
    var a = (i / player.trail.length) * 0.38;
    var sz = 3 + (i / player.trail.length) * 4;
    ctx.globalAlpha = a;
    ctx.fillStyle = COL.saffron;
    ctx.fillRect(t.x - sz / 2, t.y - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;
}

function render(ts) {
  drawBackground(ts);
  if (!state.track) return;
  var cx, cy;
  if (player) { cx = state.cam.x; cy = state.cam.y; }
  else {                                       // menu: slow orbit over the track
    var a = ts * 0.00018;
    cx = (state.track.minX + state.track.maxX) / 2 + Math.cos(a) * 300;
    cy = (state.track.minY + state.track.maxY) / 2 + Math.sin(a) * 300;
  }
  var shx = 0, shy = 0;
  if (state.shake > 0) { shx = (Math.random() - 0.5) * state.shake; shy = (Math.random() - 0.5) * state.shake; }

  ctx.save();
  ctx.translate(shx, shy);
  ctx.save();
  ctx.translate(W / 2 - cx, H / 2 - cy);
  drawTrack();
  drawStartLine();
  if (player) {
    drawTrail();
    for (var i = 0; i < ais.length; i++) drawCar(ais[i]);
    drawCar(player);
  }
  ctx.restore();
  ctx.restore();

  // countdown overlay
  if (state.mode === 'countdown') {
    var n = Math.ceil(state.countdown);
    var txt = n > 0 ? fa(n) : 'برو!';
    ctx.save();
    ctx.fillStyle = 'rgba(8,6,24,0.55)';
    ctx.fillRect(0, H / 2 - 110, W, 220);
    ctx.fillStyle = n > 0 ? COL.saffron : COL.turquoise;
    ctx.font = '900 160px system-ui, "Segoe UI", Tahoma, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 36;
    ctx.fillText(txt, W / 2, H / 2);
    ctx.restore();
  }

  // wrong-way warning
  if (state.mode === 'playing' && player) {
    var cp = state.track.center[player.idx];
    var dot = Math.cos(player.heading) * cp.tx + Math.sin(player.heading) * cp.ty;
    if (dot < -0.25 && player.speed > 0.6) {
      ctx.save();
      ctx.fillStyle = COL.magenta;
      ctx.font = '800 34px system-ui, "Segoe UI", Tahoma, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = COL.magenta; ctx.shadowBlur = 16;
      ctx.fillText('⚠ اشتباه می‌روی!', W / 2, 120);
      ctx.restore();
    }
  }
}

// ============================================================
// Mini-map
// ============================================================
function drawMiniMap() {
  var mw = mini.width, mh = mini.height;
  mctx.clearRect(0, 0, mw, mh);
  mctx.fillStyle = 'rgba(10,8,32,0.72)';
  mctx.fillRect(0, 0, mw, mh);
  mctx.strokeStyle = 'rgba(70,230,255,0.25)';
  mctx.lineWidth = 1; mctx.strokeRect(0.5, 0.5, mw - 1, mh - 1);
  if (!state.track) return;
  var t = state.track, pad = 16;
  var sx = (mw - pad * 2) / (t.maxX - t.minX);
  var sy = (mh - pad * 2) / (t.maxY - t.minY);
  var s = Math.min(sx, sy);
  var offX = pad + ((mw - pad * 2) - (t.maxX - t.minX) * s) / 2 - t.minX * s;
  var offY = pad + ((mh - pad * 2) - (t.maxY - t.minY) * s) / 2 - t.minY * s;
  function PX(x) { return x * s + offX; }
  function PY(y) { return y * s + offY; }
  mctx.strokeStyle = COL.cyan; mctx.lineWidth = 2;
  mctx.beginPath();
  for (var i = 0; i <= t.M; i++) {
    var p = t.center[i % t.M];
    if (i === 0) mctx.moveTo(PX(p.x), PY(p.y)); else mctx.lineTo(PX(p.x), PY(p.y));
  }
  mctx.stroke();
  // start marker
  var p0 = t.center[0];
  mctx.fillStyle = COL.saffron;
  mctx.fillRect(PX(p0.x) - 3, PY(p0.y) - 3, 6, 6);
  // AI dots
  if (ais.length) {
    for (i = 0; i < ais.length; i++) {
      mctx.fillStyle = ais[i].color;
      mctx.fillRect(PX(ais[i].x) - 2.5, PY(ais[i].y) - 2.5, 5, 5);
    }
  }
  // player dot (glowing)
  if (player) {
    mctx.fillStyle = COL.saffron;
    mctx.shadowColor = COL.saffron; mctx.shadowBlur = 8;
    mctx.fillRect(PX(player.x) - 3.5, PY(player.y) - 3.5, 7, 7);
    mctx.shadowBlur = 0;
  }
}

// ============================================================
// HUD (DOM text)
// ============================================================
function updateHUD() {
  if (!player) return;
  var lapDisp = Math.min(player.lap + 1, CFG.laps);
  document.getElementById('lapBox').textContent = 'دور ' + fa(lapDisp) + '/' + fa(CFG.laps);
  computePositions();
  document.getElementById('posBox').textContent = 'موقعیت: ' + fa(player.position) + '/' + fa(4);
  document.getElementById('raceTime').textContent = formatTime(state.raceTime);
  document.getElementById('bestLap').textContent = 'بهترین دور: ' + (state.bestLap !== null ? formatTime(state.bestLap) : '—');
  // v0.0.2 — nitro fuel bar
  var nb = document.getElementById('nitroBar');
  if (nb && player) {
    var pct = Math.round((player.nitro / CFG.nitroMax) * 100);
    nb.style.width = pct + '%';
    nb.style.opacity = player.nitroActive ? '1' : '0.7';
  }
}

// ============================================================
// Audio (minimal, guarded)
// ============================================================
var AC = null, muted = false;
try { muted = ls('shabtaz.mute') === '1'; } catch (e) {}
function ensureAudio() {
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
}
function beep(freq, dur) {
  if (!AC || muted) return;
  try {
    var t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
    o.type = 'square'; o.frequency.value = freq;
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(AC.destination);
    o.start(t); o.stop(t + dur + 0.02);
  } catch (e) {}
}
function setMute(m) {
  muted = m;
  try { ls('shabtaz.mute', m ? '1' : '0'); } catch (e) {}
  document.getElementById('btnMute').textContent = m ? '🔇' : '🔊';
}

// ============================================================
// Screens / modes
// ============================================================
function show(id) { document.getElementById(id).classList.remove('hide'); }
function hide(id) { document.getElementById(id).classList.add('hide'); }
function setMode(m) {
  state.mode = m;
  document.getElementById('frame').setAttribute('data-mode', m);
}

function showStart() {
  setMode('menu');
  show('screenStart'); hide('screenPause'); hide('screenFinish');
  try {
    var d = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
    document.getElementById('todayDate').textContent = d;
  } catch (e) { document.getElementById('todayDate').textContent = '—'; }
  var day = dayNumber();
  var bl = null, bt = null;
  try { bl = JSON.parse(ls('shabtaz.bestLap.' + day) || 'null'); } catch (e) {}
  try { bt = JSON.parse(ls('shabtaz.bestTotal.' + day) || 'null'); } catch (e) {}
  var el = document.getElementById('bestToday');
  if (bl !== null || bt !== null) {
    el.classList.remove('hide');
    var html = 'رکورد امروز: ';
    if (bt !== null) html += 'زمان ' + formatTime(bt);
    if (bl !== null) html += (bt !== null ? ' · ' : '') + 'بهترین دور ' + formatTime(bl);
    el.textContent = html;
  } else el.classList.add('hide');
}

function startGame() {
  ensureAudio();
  setupRace();
  hide('screenStart'); hide('screenFinish'); hide('screenPause');
  state.countdown = 3.0;
  setMode('countdown');
}

function showPause() { setMode('paused'); show('screenPause'); }
function resumeGame() { hide('screenPause'); setMode('playing'); }

function showFinish() {
  var info = state.finishInfo;
  hide('screenStart'); hide('screenPause');
  var ol = document.getElementById('positions');
  ol.innerHTML = '';
  info.ranked.forEach(function (c, i) {
    var li = document.createElement('li');
    if (c === player) li.className = 'me';
    var pos = document.createElement('span'); pos.className = 'pnum'; pos.textContent = fa(i + 1);
    var name = document.createElement('span'); name.className = 'pname'; name.textContent = c.name;
    var time = document.createElement('span'); time.className = 'ptime';
    if (c.finished) time.textContent = formatTime(c.finishTime);
    else if (c === player) time.textContent = formatTime(info.totalTime);
    else time.textContent = 'در حال مسابقه';
    li.appendChild(pos); li.appendChild(name); li.appendChild(time);
    ol.appendChild(li);
  });
  // v0.0.5 — per-lap splits (seconds, 2 decimals) with best lap highlighted
  var lapsList = document.getElementById('lapsList');
  var lapsBlock = document.getElementById('lapsBlock');
  if (lapsList && lapsBlock) {
    lapsList.innerHTML = '';
    if (state.lapTimes.length) {
      lapsBlock.classList.remove('hide');
      state.lapTimes.forEach(function (lt, i) {
        var li = document.createElement('li');
        var isBest = (lt === state.bestLap);
        if (isBest) li.className = 'best';
        if (isBest) {
          var star = document.createElement('span'); star.className = 'lap-star'; star.textContent = '★';
          li.appendChild(star);
        }
        var lbl = document.createElement('span'); lbl.className = 'lap-n'; lbl.textContent = 'دور ' + fa(i + 1);
        var t = document.createElement('span'); t.className = 'lap-t'; t.textContent = toFa((lt / 1000).toFixed(2)) + ' ثانیه';
        li.appendChild(lbl); li.appendChild(t);
        lapsList.appendChild(li);
      });
    } else {
      lapsBlock.classList.add('hide');
    }
  }
  document.getElementById('finishTotal').textContent = formatTime(info.totalTime);
  document.getElementById('finishBest').textContent = info.bestLap !== null ? formatTime(info.bestLap) : '—';
  var rec = document.getElementById('finishRecord');
  if (info.newLap || info.newTotal) {
    rec.classList.remove('hide');
    var msg = '';
    if (info.newTotal) msg += '★ رکورد زمان امروز! ';
    if (info.newLap && info.bestLap !== null) msg += '★ بهترین دور امروز!';
    rec.textContent = msg.trim();
  } else rec.classList.add('hide');
  var title = 'پایان مسابقه';
  if (info.playerPos === 1) title = '🏆 پیروز شدی!';
  else if (info.playerPos === 2) title = 'نایب قهرمان';
  else if (info.playerPos === 3) title = 'مقام سوم';
  document.getElementById('finishTitle').textContent = title;
  setMode('finished');
  show('screenFinish');
}

// ============================================================
// Main loop (fixed-timestep accumulation)
// ============================================================
var last = 0, acc = 0, STEP = 1000 / 60;
function loop(ts) {
  requestAnimationFrame(loop);
  if (!last) last = ts;
  var dt = ts - last; last = ts;
  if (dt > 100) dt = 100;

  if (state.mode === 'playing') {
    acc += dt;
    var n = 0;
    while (acc >= STEP && n < 6) {
      update();
      acc -= STEP; n++;
      if (state.mode !== 'playing') break;
    }
    updateHUD();
  } else if (state.mode === 'countdown') {
    state.countdown -= dt / 1000;
    if (state.countdown <= -0.6) {
      setMode('playing');
      player.lapStartTime = 0;
      beep(520, 0.18);
    } else {
      updateHUD();
    }
    acc = 0;
  } else { acc = 0; }

  render(ts);
  drawMiniMap();
}

// ============================================================
// Input — keyboard + pointer (touch/mouse)
// ============================================================
var KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'accel', KeyW: 'accel',
  ArrowDown: 'brake', KeyS: 'brake',
  ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro'
};
document.addEventListener('keydown', function (e) {
  var tag = e.target && e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA') return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (state.mode === 'playing') showPause();
    else if (state.mode === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyM') { setMute(!muted); return; }
  var k = KEYMAP[e.code];
  if (k) { e.preventDefault(); input[k] = true; ensureAudio(); }
});
document.addEventListener('keyup', function (e) {
  var k = KEYMAP[e.code];
  if (k) { e.preventDefault(); input[k] = false; }
});

function bindHold(id, key) {
  var el = document.getElementById(id);
  function down(e) { e.preventDefault(); input[key] = true; el.classList.add('active'); ensureAudio(); }
  function up(e) { e.preventDefault(); input[key] = false; el.classList.remove('active'); }
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}
bindHold('btnLeft', 'left');
bindHold('btnRight', 'right');
bindHold('btnAccel', 'accel');
bindHold('btnBrake', 'brake');
bindHold('btnNitro', 'nitro');

document.getElementById('btnPause').addEventListener('click', function () {
  if (state.mode === 'playing') showPause();
  else if (state.mode === 'paused') resumeGame();
});
document.getElementById('btnMute').addEventListener('click', function () {
  ensureAudio(); setMute(!muted);
});
document.getElementById('btnPlay').addEventListener('click', startGame);
document.getElementById('btnResume').addEventListener('click', resumeGame);
document.getElementById('btnQuit').addEventListener('click', showStart);
document.getElementById('btnRetry').addEventListener('click', startGame);
document.getElementById('btnHome').addEventListener('click', showStart);

document.addEventListener('visibilitychange', function () {
  if (document.hidden && state.mode === 'playing') showPause();
});

// ============================================================
// Init — generate today's track for the menu preview, then start
// ============================================================
(function init() {
  var seed = dayNumber();
  state.seed = seed; state.day = seed;
  state.track = generateTrack(seed);   // deterministic per day
  setMute(muted);
  showStart();
  requestAnimationFrame(loop);
})();

// expose for deterministic testing (same day => same track)
window.shabtazTest = { generateTrack: generateTrack, dayNumber: dayNumber, mulberry32: mulberry32 };
})();
// ---- v0.0.5 gamekit wiring (splash + menu + stats + leaderboard + auto-update) ----
if (window.GK) {
  GK.boot({ title: "Shabtaz Night Race", tagline: "Nighttime lap racer", theme: "#0a0e1a" });
  GK.help({ title: "Shabtaz Night Race", objective: "Complete the laps before the timer runs out. Use nitro on straights.", controls: ["Touch: left/right pedals + steer","Arrows / A,D: steer; W/S: gas-brake; Shift: nitro","P: pause","F: fullscreen"], tips: "Watch the mini-map for your position. Best lap is saved." });
  GK.exposeState(function () { try { return { score: (window.S && window.S.score) || window.score || 0, mode: (window.S && window.S.mode) || 'play', wave: (window.S && window.S.wave) || 0 }; } catch (e) { return {}; } });
  GK._manualRecord = false;
  setTimeout(function () { GK.ready(); }, 600);
}
