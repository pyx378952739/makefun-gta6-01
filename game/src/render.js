// Drawing only: the world's state and the current screen in, pixels out. The camera shows a
// 1280x720 window of the city, scaled to fit the browser window and centred, the margin filled
// with the backdrop colour. Flat shapes and canvas text throughout; nothing here loads a file.
import { COAST, FONT, PALETTE, ROADS, VIEW, WORLD } from './config.js';
import { CAR_TYPES } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';
export const SCREEN_MISSION = 'mission';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };
const MAP = { width: 200, height: 150, margin: 16 };

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  /** Canvas pixel position to world units, through the camera. */
  function screenToWorld(px, py) {
    const cam = currentCamera;
    const lx = (px - view.x) / view.scale;
    const ly = (py - view.y) / view.scale;
    return { x: cam.x - VIEW.width / 2 + lx, y: cam.y - VIEW.height / 2 + ly };
  }

  let currentCamera = { x: VIEW.width / 2, y: VIEW.height / 2 };

  function drawCity(state) {
    const cam = state.camera;
    const left = cam.x - VIEW.width / 2;
    const top = cam.y - VIEW.height / 2;
    const right = left + VIEW.width;
    const bottom = top + VIEW.height;

    // Ground: grass everywhere, then the marina water west and the beach sand south.
    context.fillStyle = PALETTE.grass;
    context.fillRect(left, top, VIEW.width, VIEW.height);
    context.fillStyle = PALETTE.water;
    context.fillRect(Math.max(left, 0), top, Math.min(COAST.waterWest, right) - Math.max(left, 0) > 0 ? Math.min(COAST.waterWest, right) - Math.max(left, 0) : 0, VIEW.height);
    context.fillStyle = PALETTE.waterDeep;
    context.fillRect(Math.max(left, 0), top, Math.max(0, Math.min(60, right) - Math.max(left, 0)), VIEW.height);
    if (bottom > COAST.sandTop) {
      context.fillStyle = PALETTE.sand;
      context.fillRect(left, Math.max(top, COAST.sandTop), VIEW.width, bottom - Math.max(top, COAST.sandTop));
    }

    // Parks.
    for (const park of state.city.parks) {
      if (park.x > right || park.x + park.w < left || park.y > bottom || park.y + park.h < top) continue;
      context.fillStyle = PALETTE.park;
      context.fillRect(park.x, park.y, park.w, park.h);
    }

    // Roads: dark strips along every road centre line, with dashed centre lines.
    context.fillStyle = PALETTE.road;
    for (const x of ROADS.vertical) context.fillRect(x - ROADS.width / 2, top, ROADS.width, VIEW.height);
    for (const y of ROADS.horizontal) context.fillRect(left, y - ROADS.width / 2, VIEW.width, ROADS.width);
    context.fillStyle = PALETTE.roadLine;
    for (const x of ROADS.vertical) {
      for (let y = Math.floor(top / 44) * 44; y < bottom; y += 44) context.fillRect(x - 2, y, 4, 22);
    }
    for (const y of ROADS.horizontal) {
      for (let x = Math.floor(left / 44) * 44; x < right; x += 44) context.fillRect(x, y - 2, 22, 4);
    }

    // Marina piers over the water.
    context.fillStyle = '#8a6f4d';
    for (const pier of state.city.piers) context.fillRect(pier.x, pier.y, pier.w, pier.h);

    // Buildings: a dropped shadow for height, the footprint, a lighter roof inset.
    for (const b of state.city.buildings) {
      if (b.x > right || b.x + b.w < left || b.y > bottom || b.y + b.h < top) continue;
      context.fillStyle = 'rgba(0,0,0,0.28)';
      context.fillRect(b.x + b.height * 2, b.y + b.height * 2, b.w, b.h);
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = 'rgba(255,255,255,0.14)';
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(0,0,0,0.25)';
      context.fillRect(b.x, b.y + b.h - 8, b.w, 8);
    }

    // Trees and palms.
    for (const tree of state.city.trees) {
      if (tree.x < left || tree.x > right || tree.y < top || tree.y > bottom) continue;
      context.fillStyle = '#5a4632';
      context.fillRect(tree.x - 2, tree.y - 2, 4, 4);
      context.fillStyle = tree.palm ? PALETTE.palm : PALETTE.tree;
      context.beginPath();
      context.arc(tree.x, tree.y, tree.palm ? 11 : 9, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.beginPath();
      context.arc(tree.x - 3, tree.y - 3, 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawCar(car, time) {
    const def = CAR_TYPES[car.type];
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = 'rgba(0,0,0,0.3)';
    roundRectPath(context, -def.length / 2 + 3, -def.width / 2 + 3, def.length, def.width, 8);
    context.fill();
    context.fillStyle = car.color;
    roundRectPath(context, -def.length / 2, -def.width / 2, def.length, def.width, 8);
    context.fill();
    // Glass and roof.
    context.fillStyle = PALETTE.carGlass;
    context.fillRect(def.length * 0.08, -def.width / 2 + 5, def.length * 0.22, def.width - 10);
    context.fillStyle = car.color;
    context.fillRect(-def.length * 0.28, -def.width / 2 + 5, def.length * 0.3, def.width - 10);
    // Headlights and tail lights.
    context.fillStyle = '#fff8c9';
    context.fillRect(def.length / 2 - 3, -def.width / 2 + 4, 3, 6);
    context.fillRect(def.length / 2 - 3, def.width / 2 - 10, 3, 6);
    context.fillStyle = car.brakeLight ? '#ff2b2b' : '#a02b2b';
    context.fillRect(-def.length / 2, -def.width / 2 + 4, 3, 6);
    context.fillRect(-def.length / 2, def.width / 2 - 10, 3, 6);
    if (car.driver === 'police') {
      const flash = Math.floor(time * 4) % 2 === 0;
      context.fillStyle = flash ? PALETTE.policeLight : PALETTE.policeLightB;
      context.fillRect(-6, -def.width / 2 + 3, 12, 7);
      context.fillStyle = flash ? PALETTE.policeLightB : PALETTE.policeLight;
      context.fillRect(-6, def.width / 2 - 10, 12, 7);
    }
    if (car.type === 'taxi') {
      context.fillStyle = '#1c1c1c';
      context.fillRect(-8, -7, 16, 14);
      context.fillStyle = '#f2c230';
      text('TAXI', 0, 4, 9, '#f2c230', 'center', 'middle');
    }
    context.restore();
  }

  function drawPed(ped) {
    context.save();
    context.translate(ped.x, ped.y);
    if (ped.state === 'down') {
      context.rotate(ped.angle + Math.PI / 2);
      context.fillStyle = ped.color;
      context.beginPath();
      context.ellipse(0, 0, 14, 7, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = ped.color;
    context.beginPath();
    context.arc(0, 0, 10, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(Math.cos(ped.angle) * 3, Math.sin(ped.angle) * 3, 5, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawOfficer(officer, time) {
    context.save();
    context.translate(officer.x, officer.y);
    context.fillStyle = 'rgba(0,0,0,0.25)';
    context.beginPath();
    context.ellipse(0, 4, 10, 5, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.police;
    context.beginPath();
    context.arc(0, 0, 11, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(Math.cos(officer.angle) * 3, Math.sin(officer.angle) * 3, 5, 0, Math.PI * 2);
    context.fill();
    const flash = Math.floor(time * 4) % 2 === 0;
    context.fillStyle = flash ? PALETTE.policeLight : PALETTE.policeLightB;
    context.fillRect(-4, -16, 8, 4);
    context.restore();
  }

  function drawPlayer(state, time) {
    const p = state.player;
    if (!p.onFoot) return;
    context.save();
    context.translate(p.x, p.y);
    // Blink while hurt recently: hidden on every other tenth of a second.
    const hurt = state.time - state.lastHurt < 0.6;
    if (hurt && Math.floor(state.time * 10) % 2 === 0) {
      context.restore();
      return;
    }
    context.fillStyle = 'rgba(0,0,0,0.3)';
    context.beginPath();
    context.ellipse(0, 5, 11, 6, 0, 0, Math.PI * 2);
    context.fill();
    context.rotate(p.angle);
    context.fillStyle = PALETTE.player;
    context.beginPath();
    context.arc(0, 0, 12, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.playerDark;
    context.fillRect(2, -8, 10, 16);
    context.fillStyle = '#e8b98a';
    context.beginPath();
    context.arc(4, 0, 5, 0, Math.PI * 2);
    context.fill();
    // Gun in hand.
    if (p.ammo > 0) {
      context.fillStyle = '#222';
      context.fillRect(8, -2, 12, 4);
    }
    context.restore();
    void time;
  }

  function drawPickups(state, time) {
    for (const pickup of state.pickups) {
      const bob = Math.sin(time * 3 + pickup.x) * 2;
      context.fillStyle = '#222';
      context.fillRect(pickup.x - 8, pickup.y - 3 + bob, 16, 6);
      context.fillStyle = '#f2c230';
      context.fillRect(pickup.x - 8, pickup.y - 3 + bob, 6, 6);
      context.fillStyle = 'rgba(242,194,48,0.35)';
      context.beginPath();
      context.arc(pickup.x, pickup.y + bob, 14 + Math.sin(time * 4) * 2, 0, Math.PI * 2);
      context.fill();
    }
  }

  function drawBullets(state) {
    context.strokeStyle = PALETTE.bullet;
    context.lineWidth = 3;
    for (const b of state.bullets) {
      context.beginPath();
      context.moveTo(b.x - Math.cos(b.angle) * 14, b.y - Math.sin(b.angle) * 14);
      context.lineTo(b.x, b.y);
      context.stroke();
    }
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      context.globalAlpha = Math.max(0, p.life / p.max);
      context.fillStyle = p.color;
      context.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    context.globalAlpha = 1;
  }

  function drawMissionBeacon(state, time) {
    const m = state.mission;
    if (m === null) return;
    const cam = state.camera;
    const left = cam.x - VIEW.width / 2;
    const top = cam.y - VIEW.height / 2;
    const pulse = 1 + Math.sin(time * 4) * 0.15;
    // A light column and a pulsing ring on the target itself.
    context.fillStyle = 'rgba(242,194,48,0.12)';
    context.fillRect(m.target.x - 26, top, 52, VIEW.height);
    context.strokeStyle = PALETTE.beacon;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(m.target.x, m.target.y, 34 * pulse, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = PALETTE.marker;
    context.save();
    context.translate(m.target.x, m.target.y - 44);
    context.rotate(Math.PI / 4);
    context.fillRect(-9, -9, 18, 18);
    context.restore();
    // An edge arrow when the target is off screen.
    const tx = m.target.x;
    const ty = m.target.y;
    if (tx < left + 40 || tx > left + VIEW.width - 40 || ty < top + 40 || ty > top + VIEW.height - 40) {
      const cx = Math.max(left + 50, Math.min(left + VIEW.width - 50, tx));
      const cy = Math.max(top + 50, Math.min(top + VIEW.height - 50, ty));
      const angle = Math.atan2(ty - cy, tx - cx);
      context.save();
      context.translate(cx, cy);
      context.rotate(angle);
      context.fillStyle = PALETTE.marker;
      context.beginPath();
      context.moveTo(18, 0);
      context.lineTo(-10, -12);
      context.lineTo(-10, 12);
      context.closePath();
      context.fill();
      context.restore();
      text(`${Math.round(Math.hypot(tx - state.player.x, ty - state.player.y) / 10) * 10}m`, cx, cy + 30, 18, PALETTE.text, 'center');
    }
  }

  function drawHud(state, ui) {
    const p = state.player;
    context.textBaseline = 'top';
    // Cash, health, reputation, top left.
    context.fillStyle = 'rgba(10,14,20,0.55)';
    roundRectPath(context, 14, 14, 250, 92, 10);
    context.fill();
    text(`$${state.cash.toLocaleString('en-US')}`, 28, 26, 30, PALETTE.cash, 'left', 'top');
    text(`REP ${state.rep}`, 28, 62, 18, PALETTE.text, 'left', 'top');
    context.fillStyle = '#3a414d';
    context.fillRect(28, 88, 150, 10);
    context.fillStyle = state.health > 30 ? '#7ddc7d' : PALETTE.danger;
    context.fillRect(28, 88, 150 * Math.max(0, state.health / 100), 10);
    // Wanted stars and the clock, top right.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, VIEW.width - 28, 22, 30, state.wanted > 0 ? PALETTE.star : PALETTE.starEmpty, 'right', 'top');
    text(ui.clock, VIEW.width - 28, 60, 22, PALETTE.text, 'right', 'top');
    if (ui.muted) text('MUTED (M)', VIEW.width - 28, 88, 16, PALETTE.muted, 'right', 'top');
    // Mission objective, top centre: the label on the left, the countdown on the right.
    if (state.mission !== null) {
      const label = `${state.mission.def.title} — ${state.mission.target.label}`;
      const timer = `${Math.max(0, Math.ceil(state.mission.timer))}s`;
      context.fillStyle = 'rgba(10,14,20,0.6)';
      roundRectPath(context, (VIEW.width - 640) / 2, 14, 640, 44, 10);
      context.fill();
      text(label, (VIEW.width - 640) / 2 + 18, 24, 20, PALETTE.text, 'left', 'top');
      text(timer, (VIEW.width + 640) / 2 - 18, 24, 20, state.mission.timer < 20 ? PALETTE.danger : PALETTE.cash, 'right', 'top');
    } else {
      text('Press T for the next job', VIEW.width / 2, 24, 18, PALETTE.muted, 'center', 'top');
    }
    // Speed and ammo, bottom left.
    if (!p.onFoot && p.car !== null) {
      const mph = Math.round(Math.abs(p.car.speed) * 0.14);
      text(`${mph}`, 28, VIEW.height - 92, 44, PALETTE.text, 'left', 'top');
      text('MPH', 96, VIEW.height - 68, 18, PALETTE.muted, 'left', 'top');
      text(`${p.car.type.toUpperCase()}  •  E to get out  •  Space handbrake`, 28, VIEW.height - 40, 16, PALETTE.muted, 'left', 'top');
    } else {
      if (p.ammo > 0) text(`Ammo ${p.ammo} — click to fire`, 28, VIEW.height - 72, 18, PALETTE.text, 'left', 'top');
      text('WASD move  •  Shift run  •  E enter car  •  F punch  •  T job  •  P pause', 28, VIEW.height - 40, 16, PALETTE.muted, 'left', 'top');
    }
    // Toast, centre bottom.
    if (state.toast !== null) {
      context.fillStyle = 'rgba(10,14,20,0.7)';
      const tw = context.measureText(state.toast).width + 40;
      roundRectPath(context, (VIEW.width - tw) / 2, VIEW.height - 150, tw, 40, 10);
      context.fill();
      text(state.toast, VIEW.width / 2, VIEW.height - 138, 20, PALETTE.text, 'center', 'top');
    }
    // Aim crosshair when armed.
    if (ui.aim !== null && p.onFoot && p.ammo > 0) {
      context.strokeStyle = 'rgba(255,255,255,0.85)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(ui.aim.x, ui.aim.y, 10, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(ui.aim.x - 14, ui.aim.y);
      context.lineTo(ui.aim.x - 6, ui.aim.y);
      context.moveTo(ui.aim.x + 6, ui.aim.y);
      context.lineTo(ui.aim.x + 14, ui.aim.y);
      context.moveTo(ui.aim.x, ui.aim.y - 14);
      context.lineTo(ui.aim.x, ui.aim.y - 6);
      context.moveTo(ui.aim.x, ui.aim.y + 6);
      context.lineTo(ui.aim.x, ui.aim.y + 14);
      context.stroke();
    }
    // Busted warning while the arrest clock runs.
    if (state.wanted > 0 && state.bustTimer > 0) {
      text('THEY ARE GRABBING YOU — DRIVE AWAY', VIEW.width / 2, 78, 20, PALETTE.danger, 'center', 'top');
    }
  }

  function drawMinimap(state) {
    const scale = MAP.width / WORLD.width;
    const mapH = WORLD.height * scale;
    const x0 = VIEW.width - MAP.width - MAP.margin;
    const y0 = VIEW.height - mapH - MAP.margin;
    context.fillStyle = PALETTE.minimapBg;
    roundRectPath(context, x0 - 6, y0 - 6, MAP.width + 12, mapH + 12, 8);
    context.fill();
    context.fillStyle = PALETTE.minimapWater;
    context.fillRect(x0, y0, COAST.waterWest * scale, mapH);
    context.fillStyle = PALETTE.sand;
    context.fillRect(x0, y0 + COAST.sandTop * scale, MAP.width, mapH - COAST.sandTop * scale);
    context.strokeStyle = PALETTE.minimapRoad;
    context.lineWidth = 2;
    for (const x of ROADS.vertical) {
      context.beginPath();
      context.moveTo(x0 + x * scale, y0);
      context.lineTo(x0 + x * scale, y0 + mapH);
      context.stroke();
    }
    for (const y of ROADS.horizontal) {
      context.beginPath();
      context.moveTo(x0, y0 + y * scale);
      context.lineTo(x0 + MAP.width, y0 + y * scale);
      context.stroke();
    }
    if (state.mission !== null) {
      context.fillStyle = PALETTE.marker;
      const mx = x0 + state.mission.target.x * scale;
      const my = y0 + state.mission.target.y * scale;
      context.save();
      context.translate(mx, my);
      context.rotate(Math.PI / 4);
      context.fillRect(-5, -5, 10, 10);
      context.restore();
    }
    for (const car of state.cars) {
      if (car.driver !== 'police') continue;
      context.fillStyle = '#ff5a5a';
      context.beginPath();
      context.arc(x0 + car.x * scale, y0 + car.y * scale, 3.5, 0, Math.PI * 2);
      context.fill();
    }
    // The player, a white dot with a ring.
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.beginPath();
    context.arc(x0 + state.player.x * scale, y0 + state.player.y * scale, 7, 0, Math.PI * 2);
    context.stroke();
  }

  function drawPanel(title, lines, prompt) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    roundRectPath(context, x, y, PANEL.width, height, 12);
    context.fill();
    context.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 82, 52, PALETTE.text, 'center');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.beacon, 'center');
  }

  const TITLE_LINES = [
    'An open-world city to explore on foot and by car.',
    'Steal cars, outrun the police, run jobs and build your name.',
    'WASD move · Shift run · E enter a car · Click to fight · T take a job',
    '',
  ];

  /** Paint one frame: the city and its actors, then the HUD or a panel for the screen. */
  function draw(state, screen, best, ui) {
    currentCamera = state.camera;
    const time = state.time;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // The world is drawn in camera space: shift the origin so the camera centre is centred.
    context.translate(VIEW.width / 2 - state.camera.x, VIEW.height / 2 - state.camera.y);
    drawCity(state);
    drawMissionBeacon(state, time);
    drawPickups(state, time);
    for (const car of state.cars) drawCar(car, time);
    for (const ped of state.peds) drawPed(ped);
    for (const officer of state.officers) drawOfficer(officer, time);
    drawPlayer(state, time);
    drawBullets(state);
    drawParticles(state);
    // Back to screen space for the HUD and panels.
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[3] = `Best cash $${best.toLocaleString('en-US')}`;
      drawPanel('SOLARA BAY', TITLE_LINES, 'Press Enter or click to start');
      return;
    }
    drawHud(state, ui);
    drawMinimap(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', ['The city will wait for you.'], 'Press P to resume');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', [`The police caught you. Cash kept: $${state.cash.toLocaleString('en-US')}.`, `Best cash $${best.toLocaleString('en-US')}.`], 'Press Enter to play again');
    } else if (screen === SCREEN_WASTED) {
      drawPanel('WASTED', [`You did not make it. Cash kept: $${state.cash.toLocaleString('en-US')}.`, `Best cash $${best.toLocaleString('en-US')}.`], 'Press Enter to play again');
    } else if (screen === SCREEN_MISSION) {
      drawPanel('JOB COMPLETE', [ui.missionLine || '', `Cash $${state.cash.toLocaleString('en-US')}  •  REP ${state.rep}`], 'Press Enter to keep playing');
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, screenToWorld };
}
