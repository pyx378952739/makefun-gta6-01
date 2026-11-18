// SOLARA BAY renderer: draws the city, cars, people, effects, HUD,
// minimap and every screen. Canvas 2D only, all art procedural.
import { CFG, districtAt } from './config.js';
import { clockString } from './world.js';

const TAU = Math.PI * 2;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawCity(ctx, w) {
  const { state } = w;
  ctx.fillStyle = CFG.colors.grass; ctx.fillRect(0, 0, CFG.worldW, CFG.worldH);
  // sea + beach on the east edge
  ctx.fillStyle = CFG.colors.seaDeep; ctx.fillRect(1200, 0, 80, CFG.worldH);
  ctx.fillStyle = CFG.colors.sea; ctx.fillRect(1180, 0, 24, CFG.worldH);
  ctx.fillStyle = CFG.colors.sand; ctx.fillRect(1120, 0, 60, CFG.worldH);
  // marina water (west)
  ctx.fillStyle = CFG.colors.sea; ctx.fillRect(0, 60, 150, 130);
  ctx.fillStyle = '#c9a86a'; ctx.fillRect(w.pier.x, w.pier.y, w.pier.w, w.pier.h);
  // parks
  for (const p of w.parks) { ctx.fillStyle = CFG.colors.park; ctx.fillRect(p.x, p.y, p.w, p.h); ctx.strokeStyle = '#4f8f3f'; ctx.lineWidth = 3; ctx.strokeRect(p.x + 2, p.y + 2, p.w - 4, p.h - 4); }
  // sidewalks + roads
  ctx.fillStyle = CFG.colors.sidewalk;
  for (const x of w.roadsV) ctx.fillRect(x - 30, 0, 60, CFG.worldH);
  for (const y of w.roadsH) ctx.fillRect(0, y - 30, CFG.worldW, 60);
  ctx.fillStyle = CFG.colors.road;
  for (const x of w.roadsV) ctx.fillRect(x - 20, 0, 40, CFG.worldH);
  for (const y of w.roadsH) ctx.fillRect(0, y - 20, CFG.worldW, 40);
  // dashed center lines
  ctx.fillStyle = CFG.colors.roadLine;
  for (const x of w.roadsV) for (let y = 0; y < CFG.worldH; y += 36) ctx.fillRect(x - 2, y, 4, 18);
  for (const y of w.roadsH) for (let x = 0; x < CFG.worldW; x += 36) ctx.fillRect(x, y - 2, 18, 4);
  // buildings
  for (const b of w.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(b.x + 5, b.y + 6, b.w, b.h);
    ctx.fillStyle = b.color; ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof; ctx.fillRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const cols = Math.max(2, Math.floor(b.w / 18)), rows = Math.max(2, Math.floor(b.h / 18));
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) ctx.fillRect(b.x + 8 + i * ((b.w - 16) / cols), b.y + 8 + j * ((b.h - 16) / rows), 7, 9);
    if (b.floors >= 4) { ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(b.x + b.w / 2 - 2, b.y - 10, 4, 10); }
  }
  // palms
  for (const p of w.palms) {
    ctx.strokeStyle = CFG.colors.trunk; ctx.lineWidth = 3 * p.s; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3 * p.s, p.y - 12 * p.s); ctx.stroke();
    ctx.fillStyle = CFG.colors.palm;
    for (let i = 0; i < 5; i++) { const a = (i / 5) * TAU; ctx.beginPath(); ctx.ellipse(p.x + 3 * p.s + Math.cos(a) * 9 * p.s, p.y - 12 * p.s + Math.sin(a) * 6 * p.s, 10 * p.s, 4 * p.s, a, 0, TAU); ctx.fill(); }
  }
  // district labels
  ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'left';
  for (const d of CFG.districts) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(d.name, d.x + 10, d.y + 22); }
  void state;
}

function drawCar(ctx, c) {
  ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(-c.w / 2 + 3, -c.h / 2 + 3, c.w, c.h);
  ctx.fillStyle = c.color; rr(ctx, -c.w / 2, -c.h / 2, c.w, c.h, 7); ctx.fill();
  ctx.fillStyle = 'rgba(20,30,45,0.85)'; rr(ctx, -c.w / 2 + 10, -c.h / 2 + 4, c.w / 3, c.h - 8, 3); ctx.fill();
  ctx.fillStyle = '#ffe9a8'; ctx.fillRect(c.w / 2 - 4, -c.h / 2 + 3, 3, 5); ctx.fillRect(c.w / 2 - 4, c.h / 2 - 8, 3, 5);
  ctx.fillStyle = '#ff5f5f'; ctx.fillRect(-c.w / 2, -c.h / 2 + 3, 3, 5); ctx.fillRect(-c.w / 2, c.h / 2 - 8, 3, 5);
  if (c.kind === 'taxi') { ctx.fillStyle = '#222'; ctx.font = 'bold 9px system-ui'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3); ctx.fillStyle = '#e8c33d'; ctx.fillRect(-8, -c.h / 2 - 3, 16, 4); }
  if (c.cop) {
    ctx.fillStyle = '#f2f2f2'; ctx.fillRect(-c.w / 2 + 4, -c.h / 2, c.w - 8, 4);
    const t = Date.now() / 180 % 2 < 1;
    ctx.fillStyle = t ? '#ff3b30' : '#2f7bff'; ctx.beginPath(); ctx.arc(-6, -c.h / 2, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = t ? '#2f7bff' : '#ff3b30'; ctx.beginPath(); ctx.arc(6, -c.h / 2, 4, 0, TAU); ctx.fill();
    ctx.fillStyle = '#222'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('POLICE', 0, 3);
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, shirt, pants, scale = 1, running = false) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle + Math.PI / 2); ctx.scale(scale, scale);
  const bob = running ? Math.sin(Date.now() / 90) * 2 : 0;
  ctx.fillStyle = pants || '#33415c'; ctx.fillRect(-5, 2 + bob, 4, 10); ctx.fillRect(1, 2 - bob, 4, 10);
  ctx.fillStyle = shirt; rr(ctx, -7, -8, 14, 13, 4); ctx.fill();
  ctx.fillStyle = '#f2c89b'; ctx.beginPath(); ctx.arc(0, -12, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.arc(0, -14, 6, Math.PI, TAU); ctx.fill();
  ctx.restore();
}

export function drawWorld(ctx, w) {
  drawCity(ctx, w);
  // pickups
  for (const pk of w.pickups) {
    if (pk.taken) continue;
    ctx.save(); ctx.translate(pk.x, pk.y);
    ctx.fillStyle = pk.kind === 'gun' ? '#222831' : '#2f9e44';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ffd34f'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 11px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(pk.kind === 'gun' ? 'P' : '$', 0, 4);
    ctx.restore();
  }
  // mission markers
  const target = missionTarget(w);
  if (target) {
    const pulse = 1 + Math.sin(Date.now() / 300) * 0.15;
    ctx.save(); ctx.translate(target.x, target.y); ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffd34f'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 22, 0, TAU); ctx.stroke();
    ctx.fillStyle = '#ffd34f'; ctx.beginPath(); ctx.moveTo(0, -34); ctx.lineTo(-8, -14); ctx.lineTo(8, -14); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(target.label, target.x, target.y - 42);
  }
  for (const c of w.cars) drawCar(ctx, c);
  for (const p of w.peds) drawPerson(ctx, p.x, p.y, p.angle, p.shirt, '#33415c', 1, p.flee > 0);
  for (const c of w.cops) {
    if (c.hp !== undefined && c.hp <= 0) continue;
    if (c.car && Math.hypot(c.x - c.car.x, c.y - c.car.y) < 4) continue; // in car: car already drawn
    drawPerson(ctx, c.x, c.y, c.angle, '#1f3a93', '#141c2e', 1.05, true);
  }
  // player
  const pl = w.player;
  if (pl.alive && !pl.inCar) drawPerson(ctx, pl.x, pl.y, pl.angle, '#e8e8e8', '#2f6fb8', 1.1, pl.speed > 200);
  if (pl.alive && !pl.inCar) { // aim line when armed
    if (pl.hasGun) { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + Math.cos(pl.angle) * 46, pl.y + Math.sin(pl.angle) * 46); ctx.stroke(); }
  }
  for (const b of w.bullets) { ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, TAU); ctx.fill(); }
  for (const p of w.state.particles) { ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }
  if (w.state.crimeFlash > 0) { ctx.fillStyle = `rgba(255,40,40,${w.state.crimeFlash * 0.12})`; ctx.fillRect(0, 0, CFG.worldW, CFG.worldH); }
}

export function missionTarget(w) {
  const s = w.state;
  if (s.mission) { const m = s.mission; return m.pickedUp ? m.to : m.from; }
  if (s.side) { const sd = s.side; return sd.pickedUp ? sd.to : sd.from; }
  return null;
}

export function missionText(w) {
  const s = w.state;
  if (s.mission) {
    const m = s.mission;
    return `${m.name}: ${m.pickedUp ? 'Deliver to ' + m.to.label : 'Go to ' + m.from.label}  •  ${Math.max(0, Math.ceil(s.missionTimer))}s`;
  }
  if (s.side) { const sd = s.side; return `${sd.name}: ${sd.pickedUp ? 'Deliver to ' + sd.to.label : 'Go to ' + sd.from.label}  •  ${Math.max(0, Math.ceil(s.sideTimer))}s`; }
  return 'Free roam — press T for a taxi fare, C for courier work.';
}

export function drawHUD(ctx, w) {
  const s = w.state, pl = w.player;
  // top bar
  ctx.fillStyle = 'rgba(10,16,28,0.72)'; rr(ctx, 12, 10, 300, 44, 8); ctx.fill();
  ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 20px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('$' + pl.money, 26, 40);
  ctx.fillStyle = '#fff'; ctx.font = '13px system-ui'; ctx.fillText('REP ' + pl.rep, 130, 27);
  ctx.fillText(clockString(s.time) + '  •  ' + districtAt(pl.x, pl.y), 130, 44);
  // health bar
  ctx.fillStyle = 'rgba(10,16,28,0.72)'; rr(ctx, 12, 62, 150, 18, 6); ctx.fill();
  ctx.fillStyle = pl.health > 30 ? '#4ade80' : '#ff5f5f'; rr(ctx, 15, 65, 144 * (pl.health / 100), 12, 4); ctx.fill();
  // wanted stars
  ctx.font = '26px system-ui'; ctx.textAlign = 'right';
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < s.wanted ? '#ffd34f' : 'rgba(255,255,255,0.25)'; ctx.fillText('★', 1260 - i * 30, 42); }
  ctx.fillStyle = '#fff'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'right';
  ctx.fillText(s.wanted > 0 ? 'WANTED' : '', 1260, 62);
  // speed
  if (pl.inCar) {
    ctx.fillStyle = 'rgba(10,16,28,0.72)'; rr(ctx, 1150, 640, 118, 52, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 26px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(Math.abs(pl.inCar.speed) * 0.36)), 1209, 672);
    ctx.font = '11px system-ui'; ctx.fillText('km/h  •  ' + pl.inCar.kind.toUpperCase(), 1209, 686);
  }
  // ammo
  if (pl.hasGun) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'left'; ctx.fillText('PISTOL  ' + pl.ammo + ' rds', 16, 700); }
  // mission objective
  ctx.fillStyle = 'rgba(10,16,28,0.72)'; rr(ctx, 12, 92, 420, 30, 8); ctx.fill();
  ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 13px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('◆ ' + missionText(w), 24, 112);
  // toast
  if (s.toastTimer > 0) {
    ctx.globalAlpha = Math.min(1, s.toastTimer);
    ctx.fillStyle = 'rgba(10,16,28,0.85)'; rr(ctx, 380, 130, 520, 40, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui'; ctx.textAlign = 'center';
    ctx.fillText(s.toast, 640, 156); ctx.globalAlpha = 1;
  }
  // controls hint
  ctx.fillStyle = 'rgba(255,255,255,0.65)'; ctx.font = '12px system-ui'; ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive  •  E enter car  •  F punch  •  click shoot  •  T taxi  •  C courier  •  P pause  •  M mute', 16, 716);
  drawMinimap(ctx, w);
}

export function drawMinimap(ctx, w) {
  const s = w.state, pl = w.player;
  const mw = 190, mh = 108, ox = 1278 - mw - 12, oy = 76;
  ctx.fillStyle = 'rgba(10,16,28,0.8)'; rr(ctx, ox - 4, oy - 4, mw + 8, mh + 8, 8); ctx.fill();
  const sx = mw / CFG.worldW, sy = mh / CFG.worldH;
  ctx.save(); ctx.beginPath(); ctx.rect(ox, oy, mw, mh); ctx.clip();
  ctx.fillStyle = '#2f5f3a'; ctx.fillRect(ox, oy, mw, mh);
  ctx.fillStyle = '#2f7fb8'; ctx.fillRect(ox, oy + 60 * sy, 150 * sx, 130 * sy);
  ctx.fillStyle = '#e8d5a0'; ctx.fillRect(ox + 1120 * sx, oy, 60 * sx, mh);
  ctx.fillStyle = '#3a3f46';
  for (const x of w.roadsV) ctx.fillRect(ox + (x - 20) * sx, oy, 40 * sx, mh);
  for (const y of w.roadsH) ctx.fillRect(ox, oy + (y - 20) * sy, mw, 40 * sy);
  const t = missionTarget(w);
  if (t) { ctx.fillStyle = '#ffd34f'; ctx.beginPath(); ctx.arc(ox + t.x * sx, oy + t.y * sy, 5, 0, TAU); ctx.fill(); }
  for (const c of w.cops) { if (c.hp !== undefined && c.hp <= 0) continue; ctx.fillStyle = '#2f7bff'; ctx.beginPath(); ctx.arc(ox + c.x * sx, oy + c.y * sy, 3.5, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ox + pl.x * sx, oy + pl.y * sy, 4, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#ffd34f'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
}

export function drawScreen(ctx, w, kind) {
  const s = w.state;
  ctx.fillStyle = 'rgba(8,12,22,0.82)'; ctx.fillRect(0, 0, CFG.worldW, CFG.worldH);
  ctx.textAlign = 'center';
  if (kind === 'title') {
    ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText('SOLARA BAY', 640, 220);
    ctx.fillStyle = '#7fb8d9'; ctx.font = 'bold 22px system-ui';
    ctx.fillText('A sun-soaked open city — drive it, steal it, survive it.', 640, 268);
    ctx.fillStyle = '#fff'; ctx.font = '16px system-ui';
    ctx.fillText('WASD move / drive   •   E enter & steal cars   •   F punch   •   Mouse aim, click to shoot', 640, 330);
    ctx.fillText('T taxi fare   •   C courier run   •   3 story missions   •   Wanted 1–5 stars   •   P pause   •   M mute', 640, 360);
    ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 24px system-ui';
    ctx.fillText('Press ENTER to start', 640, 440);
    ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.font = '14px system-ui';
    ctx.fillText('Best cash: $' + (s.bestCash || 0) + '   •   Missions done: ' + s.missionsDone, 640, 480);
    ctx.fillText('An original city. No real places, people or brands.', 640, 640);
  } else if (kind === 'paused') {
    ctx.fillStyle = '#fff'; ctx.font = 'bold 56px system-ui'; ctx.fillText('PAUSED', 640, 320);
    ctx.font = '18px system-ui'; ctx.fillText('Press P or Esc to resume  •  R to restart the run', 640, 370);
  } else if (kind === 'busted') {
    ctx.fillStyle = '#2f7bff'; ctx.font = 'bold 72px system-ui'; ctx.fillText('BUSTED', 640, 300);
    ctx.fillStyle = '#fff'; ctx.font = '18px system-ui';
    ctx.fillText('The Solara Bay police caught up with you.', 640, 350);
    ctx.fillText('Cash $' + s.playerCashAtEnd + '  •  Missions done: ' + s.missionsDone, 640, 385);
    ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 22px system-ui'; ctx.fillText('Press ENTER to try again', 640, 450);
  } else if (kind === 'wasted') {
    ctx.fillStyle = '#ff5f5f'; ctx.font = 'bold 72px system-ui'; ctx.fillText('WASTED', 640, 300);
    ctx.fillStyle = '#fff'; ctx.font = '18px system-ui';
    ctx.fillText('That is the end of the run — for now.', 640, 350);
    ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 22px system-ui'; ctx.fillText('Press ENTER to try again', 640, 450);
  } else if (kind === 'complete') {
    ctx.fillStyle = '#7dff8a'; ctx.font = 'bold 56px system-ui'; ctx.fillText('MISSION COMPLETE', 640, 300);
    ctx.fillStyle = '#fff'; ctx.font = '18px system-ui';
    ctx.fillText('Cash $' + w.player.money + '  •  Rep ' + w.player.rep, 640, 350);
    ctx.fillStyle = '#ffd34f'; ctx.font = 'bold 22px system-ui'; ctx.fillText('Press ENTER to keep playing', 640, 420);
  }
}
