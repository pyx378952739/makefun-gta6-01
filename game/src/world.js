// SOLARA BAY world: city generation, player, cars, traffic, pedestrians,
// police, missions, combat and wanted level. Pure rules — no drawing here.
import { CFG, districtAt } from './config.js';
import { makeRng } from './random.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

export function makeWorld(seed) {
  const rng = makeRng(seed);
  const W = CFG.worldW, H = CFG.worldH;
  // --- city grid: roads every 160 px, blocks between them ---
  const roadsV = [], roadsH = [];
  for (let x = 80; x < W; x += 160) roadsV.push(x);
  for (let y = 80; y < H; y += 160) roadsH.push(y);
  const buildings = [], palms = [], parks = [];
  for (let bx = 0; bx < 7; bx++) for (let by = 0; by < 4; by++) {
    const x0 = 96 + bx * 160, y0 = 96 + by * 160;
    const cx = x0 + 64, cy = y0 + 64;
    const inBeach = cx > 880, inMarina = cx < 420 && cy < 240;
    if (inBeach && rng.chance(0.55)) { // beachfront: palms + sand lots
      for (let i = 0; i < 4; i++) palms.push({ x: x0 + rng.range(10, 118), y: y0 + rng.range(10, 118), s: rng.range(0.8, 1.3) });
      continue;
    }
    if (rng.chance(0.14)) { parks.push({ x: x0, y: y0, w: 128, h: 128 }); for (let i = 0; i < 3; i++) palms.push({ x: x0 + rng.range(10, 118), y: y0 + rng.range(10, 118), s: 1 }); continue; }
    const tall = cx > 420 && cx < 860 && cy < 360;
    buildings.push({
      x: x0 + rng.range(4, 18), y: y0 + rng.range(4, 18),
      w: rng.range(70, 104), h: rng.range(60, 96),
      color: rng.pick(CFG.colors.building), roof: rng.pick(CFG.colors.roof),
      floors: tall ? rng.int(4, 8) : rng.int(1, 3), district: districtAt(cx, cy),
    });
  }
  // marina pier + beach strip on the east edge
  const pier = { x: 40, y: 120, w: 130, h: 26 };
  const beach = { x: 1180, y: 0, w: 100, h: H };
  for (let i = 0; i < 14; i++) palms.push({ x: rng.range(900, 1160), y: rng.range(20, H - 20), s: rng.range(0.8, 1.4) });

  const onRoad = (x, y) => roadsV.some((rx) => Math.abs(x - rx) < 26) || roadsH.some((ry) => Math.abs(y - ry) < 26);
  const inBuilding = (x, y, pad = 2) => buildings.some((b) => x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad);
  const roadPoint = () => {
    for (let t = 0; t < 40; t++) {
      const vertical = rng.chance(0.5);
      const x = vertical ? rng.pick(roadsV) + rng.range(-8, 8) : rng.range(60, W - 60);
      const y = vertical ? rng.range(60, H - 60) : rng.pick(roadsH) + rng.range(-8, 8);
      if (!inBuilding(x, y)) return { x, y };
    }
    return { x: 240, y: 240 };
  };
  const sidewalkPoint = () => {
    for (let t = 0; t < 40; t++) {
      const x = rng.range(60, W - 60), y = rng.range(60, H - 60);
      if (!inBuilding(x, y) && !onRoad(x, y)) return { x, y };
    }
    return { x: 200, y: 200 };
  };

  // --- entities ---
  const player = { x: 560, y: 400, angle: -Math.PI / 2, speed: 0, health: CFG.playerHealth, money: CFG.moneyStart, rep: CFG.repStart, inCar: null, ammo: 0, hasGun: false, punchTimer: 0, shotTimer: 0, alive: true };
  const cars = [];
  const carColors = CFG.carPaint;
  function spawnCar(x, y, angle, kind, opts = {}) {
    const type = CFG.carTypes.find((t) => t.kind === kind) || CFG.carTypes[0];
    const car = { x, y, angle, speed: 0, kind: type.kind, w: type.w, h: type.h, top: type.top, accel: type.accel, color: opts.color || rng.pick(carColors), parked: !!opts.parked, traffic: !!opts.traffic, driver: opts.traffic ? true : !!opts.driver, targetRoad: null, honk: 0, id: cars.length };
    cars.push(car); return car;
  }
  // parked cars along roads
  for (let i = 0; i < 14; i++) {
    const p = roadPoint();
    spawnCar(p.x + rng.range(-14, 14), p.y + rng.range(-14, 14), rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]), rng.pick(['sedan', 'sedan', 'taxi', 'van', 'sport']), { parked: true });
  }
  // traffic cars
  for (let i = 0; i < 10; i++) {
    const p = roadPoint();
    const vertical = rng.chance(0.5);
    spawnCar(p.x, p.y, vertical ? (rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) : (rng.chance(0.5) ? 0 : Math.PI), rng.pick(['sedan', 'taxi', 'van', 'sedan']), { traffic: true });
  }
  // player starter car near spawn
  spawnCar(640, 420, 0, 'sedan', { parked: true, color: '#3d7bd9' });

  const peds = [];
  for (let i = 0; i < 26; i++) {
    const p = sidewalkPoint();
    peds.push({ x: p.x, y: p.y, angle: rng.range(0, TAU), speed: CFG.pedSpeed * rng.range(0.7, 1.3), color: rng.pick(['#e87ab8', '#3d7bd9', '#e8c33d', '#3db87a', '#f2f2f2', '#d94f3d']), shirt: rng.pick(['#e87ab8', '#3d7bd9', '#e8c33d', '#3db87a', '#8a5fd9']), flee: 0, tx: p.x, ty: p.y, wait: rng.range(0, 2) });
  }
  const cops = []; // {x,y,angle,speed,car,onFoot}
  const bullets = [];
  const pickups = [];
  for (let i = 0; i < 3; i++) { const p = sidewalkPoint(); pickups.push({ x: p.x, y: p.y, kind: 'gun', taken: false }); }
  for (let i = 0; i < 4; i++) { const p = sidewalkPoint(); pickups.push({ x: p.x, y: p.y, kind: 'cash', amount: rng.int(40, 120), taken: false }); }

  // --- missions ---
  const missionSpots = [
    { x: 120, y: 140, label: 'Marina Pier' }, { x: 620, y: 120, label: 'Downtown Plaza' },
    { x: 1080, y: 560, label: 'Beachfront' }, { x: 200, y: 560, label: 'Old Town Square' },
    { x: 980, y: 180, label: 'Yacht Club' }, { x: 520, y: 560, label: 'South Market' },
  ];
  const story = [
    { id: 'delivery', name: 'Harbor Delivery', text: 'Pick up the crate at Marina Pier, deliver it to Downtown Plaza.', from: missionSpots[0], to: missionSpots[1], reward: CFG.missionRewards.delivery, time: 150 },
    { id: 'getaway', name: 'Getaway Driver', text: 'Lose the heat, then reach Beachfront. Keep the car in one piece.', from: missionSpots[1], to: missionSpots[2], reward: CFG.missionRewards.getaway, time: 180 },
    { id: 'yacht', name: 'Yacht Club Pickup', text: 'Collect the guest at Old Town Square and bring them to the Yacht Club.', from: missionSpots[3], to: missionSpots[4], reward: CFG.missionRewards.yacht, time: 180 },
  ];
  const state = {
    seed, time: 9 * 3600 + 12 * 60, // 09:12 in-game clock
    wanted: 0, wantedTimer: 0, heatTimer: 0,
    screen: 'title', // title | play | paused | busted | wasted | complete
    missionIndex: 0, mission: null, missionStage: 'idle', missionTimer: 0,
    side: null, sideTimer: 0,
    toast: '', toastTimer: 0, message: '',
    kills: 0, carsStolen: 0, missionsDone: 0, bestCash: 0,
    elapsed: 0, camera: { x: 640, y: 360 },
    crimeFlash: 0, particles: [], shells: [],
  };

  function setToast(t, dur = 3) { state.toast = t; state.toastTimer = dur; }
  function addWanted(n, reason) {
    state.wanted = clamp(state.wanted + n, 0, CFG.wantedMax);
    state.wantedTimer = 0; state.heatTimer = 0;
    if (n > 0) { state.crimeFlash = 0.6; scarePeds(player.x, player.y, 260); }
  }
  function scarePeds(x, y, r) {
    for (const p of peds) if (dist(p.x, p.y, x, y) < r) { p.flee = rng.range(2, 4); const a = Math.atan2(p.y - y, p.x - x); p.tx = clamp(p.x + Math.cos(a) * 220, 30, W - 30); p.ty = clamp(p.y + Math.sin(a) * 220, 30, H - 30); }
  }
  function nearestCar(x, y, maxD) {
    let best = null, bd = maxD;
    for (const c of cars) { const d = dist(x, y, c.x, c.y); if (d < bd) { bd = d; best = c; } }
    return best;
  }
  function startMission(i) {
    const m = story[i];
    state.mission = { ...m, pickedUp: false };
    state.missionIndex = i; state.missionStage = 'go-pickup'; state.missionTimer = m.time;
    setToast(`Mission: ${m.name} — ${m.text}`, 4);
  }
  function startSide(kind) {
    const from = kind === 'taxi' ? missionSpots[1] : missionSpots[5];
    const to = kind === 'taxi' ? missionSpots[2] : missionSpots[0];
    state.side = { kind, name: kind === 'taxi' ? 'Taxi Fare' : 'Courier Drop', from, to, pickedUp: false, reward: kind === 'taxi' ? CFG.taxiFare : CFG.courierPay };
    state.sideTimer = 120; setToast(`${state.side.name}: reach the marker, then deliver.`, 4);
  }
  function completeMission() {
    const m = state.mission;
    player.money += m.reward; player.rep += 25; state.missionsDone++;
    state.bestCash = Math.max(state.bestCash, player.money);
    setToast(`Mission complete: ${m.name}  +$${m.reward}`, 4);
    state.screen = 'complete'; state.mission = null; state.missionStage = 'idle';
    state.missionIndex = Math.min(state.missionIndex + 1, story.length - 1);
  }
  function completeSide() {
    const s = state.side;
    player.money += s.reward; player.rep += 8; state.bestCash = Math.max(state.bestCash, player.money);
    setToast(`${s.name} done  +$${s.reward}`, 3);
    state.side = null;
  }
  function spawnCop() {
    const p = roadPoint();
    const car = spawnCar(p.x, p.y, 0, 'sedan', { color: '#222831' });
    car.cop = true; car.traffic = false;
    cops.push({ x: p.x, y: p.y, angle: 0, speed: 0, car, onFoot: false });
  }
  function ensureCops() {
    const want = state.wanted >= 4 ? 3 : state.wanted >= 2 ? 2 : state.wanted >= 1 ? 1 : 0;
    while (cops.length < want) spawnCop();
    while (cops.length > want) { const c = cops.pop(); if (c.car) { const i = cars.indexOf(c.car); if (i >= 0) cars.splice(i, 1); } }
  }
  function burst(x, y, color, n = 10, speed = 160) {
    for (let i = 0; i < n; i++) { const a = rng.range(0, TAU); state.particles.push({ x, y, vx: Math.cos(a) * rng.range(40, speed), vy: Math.sin(a) * rng.range(40, speed), life: rng.range(0.3, 0.8), max: 0.8, color, size: rng.range(2, 5) }); }
  }

  function step(dt, input, audio) {
    state.elapsed += dt;
    state.time = (state.time + dt * 12) % 86400; // in-game clock runs fast
    if (state.toastTimer > 0) state.toastTimer -= dt;
    if (state.crimeFlash > 0) state.crimeFlash -= dt;
    for (const p of state.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
    state.particles = state.particles.filter((p) => p.life > 0);
    if (state.screen !== 'play') return;
    const px = player.inCar ? player.inCar.x : player.x;
    const py = player.inCar ? player.inCar.y : player.y;

    // --- player on foot ---
    if (!player.inCar) {
      const a = input.axis();
      const sp = input.running ? CFG.runSpeed : CFG.walkSpeed;
      const len = Math.hypot(a.x, a.y) || 1;
      let nx = player.x + (a.x / len) * sp * dt * (a.x || a.y ? 1 : 0);
      let ny = player.y + (a.y / len) * sp * dt * (a.x || a.y ? 1 : 0);
      if (a.x || a.y) player.angle = Math.atan2(a.y, a.x);
      if (!inBuilding(nx, player.y)) player.x = clamp(nx, 20, W - 20);
      if (!inBuilding(player.x, ny)) player.y = clamp(ny, 20, H - 20);
      player.speed = (a.x || a.y) ? sp : 0;
      if (player.punchTimer > 0) player.punchTimer -= dt;
      if (player.shotTimer > 0) player.shotTimer -= dt;
      if (input.hit('KeyE')) {
        const car = nearestCar(player.x, player.y, 52);
        if (car) {
          player.inCar = car; car.parked = false; car.traffic = false;
          if (car.driver) { car.driver = false; state.carsStolen++; addWanted(1, 'theft'); setToast('Car stolen — the heat is on.', 2.5); audio && audio.steal(); }
          else setToast(`${car.kind === 'taxi' ? 'Taxi' : car.kind === 'sport' ? 'Sport car' : car.kind === 'van' ? 'Van' : 'Sedan'} — yours now.`, 2);
        }
      }
      if (input.hit('KeyF') && player.punchTimer <= 0) { // punch
        player.punchTimer = CFG.punchCooldown;
        let hitAny = false;
        for (const p of peds) if (dist(player.x, player.y, p.x, p.y) < CFG.punchRange + 14) { p.flee = 3; hitAny = true; }
        for (const c of cops) if (dist(player.x, player.y, c.x, c.y) < CFG.punchRange + 14) { c.hp = (c.hp || 3) - 1; hitAny = true; }
        if (hitAny) { addWanted(1, 'assault'); audio && audio.punch(); burst(player.x + Math.cos(player.angle) * 24, player.y + Math.sin(player.angle) * 24, '#ffd34f', 6, 120); }
      }
      if (input.mouseClicked && player.hasGun && player.ammo > 0 && player.shotTimer <= 0) {
        player.shotTimer = CFG.shotCooldown; player.ammo--;
        const cam = state.camera;
        const wx = cam.x - CFG.viewW / 2 + input.mouseX, wy = cam.y - CFG.viewH / 2 + input.mouseY;
        const ang = Math.atan2(wy - player.y, wx - player.x);
        bullets.push({ x: player.x + Math.cos(ang) * 20, y: player.y + Math.sin(ang) * 20, vx: Math.cos(ang) * CFG.bulletSpeed, vy: Math.sin(ang) * CFG.bulletSpeed, life: 0.7 });
        player.angle = ang; addWanted(1, 'shooting'); audio && audio.shoot();
      }
      // pickups
      for (const pk of pickups) {
        if (pk.taken) continue;
        if (dist(player.x, player.y, pk.x, pk.y) < 26) {
          pk.taken = true;
          if (pk.kind === 'gun') { player.hasGun = true; player.ammo += CFG.pistolAmmo; setToast(`Pistol picked up — ${player.ammo} rounds.`, 2.5); }
          else { player.money += pk.amount; setToast(`Found $${pk.amount} cash.`, 2); }
          audio && audio.pickup();
        }
      }
    } else {
      // --- driving ---
      const car = player.inCar;
      const fwd = (input.down('KeyW') || input.down('ArrowUp')) ? 1 : 0;
      const back = (input.down('KeyS') || input.down('ArrowDown')) ? 1 : 0;
      const steer = (input.down('KeyA') || input.down('ArrowLeft') ? -1 : 0) + (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0);
      const hand = input.down('Space');
      const dir = car.speed >= 0 ? 1 : -1;
      if (fwd) car.speed += CFG.carAccel * car.accel * dt;
      if (back) car.speed -= (car.speed > 5 ? CFG.carBrake : CFG.carAccel * 0.6) * dt;
      car.speed -= car.speed * (hand ? CFG.handbrakeDrag : CFG.carDrag) * dt;
      car.speed = clamp(car.speed, -CFG.carReverseMax, car.top);
      if (Math.abs(car.speed) > 4) car.angle += steer * CFG.carTurn * dt * dir * clamp(Math.abs(car.speed) / 120, 0.25, 1);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      let hitWall = false;
      if (inBuilding(nx, car.y, 12)) hitWall = true; else car.x = clamp(nx, 24, W - 24);
      if (inBuilding(car.x, ny, 12)) hitWall = true; else car.y = clamp(ny, 24, H - 24);
      if (hitWall && Math.abs(car.speed) > 120) { burst(car.x, car.y, '#ffb347', 12, 200); audio && audio.crash(); addWanted(0, ''); scarePeds(car.x, car.y, 200); }
      if (hitWall) car.speed *= 0.45;
      // car-car bumps
      for (const o of cars) {
        if (o === car) continue;
        const d = dist(car.x, car.y, o.x, o.y);
        if (d < 40 && d > 0.01) {
          const push = (40 - d) / 2;
          const a = Math.atan2(car.y - o.y, car.x - o.x);
          car.x += Math.cos(a) * push; car.y += Math.sin(a) * push;
          if (Math.abs(car.speed) > 140) { car.speed *= 0.6; if (o.cop) addWanted(1, 'hit cop'); audio && audio.crash(); burst(car.x, car.y, '#ffb347', 8, 160); }
          if (o.traffic) o.speed = Math.max(0, o.speed - 60);
        }
      }
      // run over peds (crime!)
      for (const p of peds) if (dist(car.x, car.y, p.x, p.y) < 26 && Math.abs(car.speed) > 60) { p.flee = 4; addWanted(1, 'hit ped'); burst(p.x, p.y, '#ff5f5f', 10, 180); }
      player.x = car.x; player.y = car.y; player.angle = car.angle; player.speed = Math.abs(car.speed);
      if (input.hit('KeyE')) { player.inCar = null; car.speed = 0; car.parked = true; }
      if (input.hit('Space') && hand) { /* handbrake handled above */ }
    }

    // --- traffic ---
    for (const c of cars) {
      if (!c.traffic) continue;
      // steer toward nearest road direction, slow at intersections
      const nearX = roadsV.reduce((b, rx) => Math.abs(rx - c.x) < Math.abs(b - c.x) ? rx : b, roadsV[0]);
      const nearY = roadsH.reduce((b, ry) => Math.abs(ry - c.y) < Math.abs(b - c.y) ? ry : b, roadsH[0]);
      const onV = Math.abs(c.x - nearX) < 14, onH = Math.abs(c.y - nearY) < 14;
      let target = c.angle;
      if (onV && !onH) target = c.angle > 0 && c.angle < Math.PI ? Math.PI / 2 : -Math.PI / 2;
      else if (onH && !onV) target = Math.abs(c.angle) < Math.PI / 2 ? 0 : Math.PI;
      else if (onV && onH) target = c.angle; // intersection: keep going, slower
      c.angle += clamp(angDiff(target, c.angle), -1.6 * dt, 1.6 * dt);
      const atCross = onV && onH;
      const want = atCross ? CFG.trafficSpeed * 0.45 : CFG.trafficSpeed;
      // simple avoidance: slow if a car is ahead
      let blocked = false;
      for (const o of cars) if (o !== c && dist(c.x, c.y, o.x, o.y) < 58) { const a = Math.atan2(o.y - c.y, o.x - c.x); if (Math.abs(angDiff(a, c.angle)) < 0.6) blocked = true; }
      c.speed += ((blocked ? 0 : want) - c.speed) * dt * 1.2;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      if (c.x < 30 || c.x > W - 30 || c.y < 30 || c.y > H - 30) { const p = roadPoint(); c.x = p.x; c.y = p.y; c.angle = rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]); }
    }

    // --- pedestrians ---
    for (const p of peds) {
      if (p.flee > 0) { p.flee -= dt; const a = Math.atan2(p.ty - p.y, p.tx - p.x); p.x += Math.cos(a) * CFG.pedSpeed * 2.2 * dt; p.y += Math.sin(a) * CFG.pedSpeed * 2.2 * dt; p.angle = a; continue; }
      if (p.wait > 0) { p.wait -= dt; continue; }
      const d = dist(p.x, p.y, p.tx, p.ty);
      if (d < 8) { const q = sidewalkPoint(); p.tx = q.x; p.ty = q.y; p.wait = rng.range(0, 2.5); continue; }
      const a = Math.atan2(p.ty - p.y, p.tx - p.x);
      p.angle = a;
      const nx = p.x + Math.cos(a) * p.speed * dt, ny = p.y + Math.sin(a) * p.speed * dt;
      if (!inBuilding(nx, p.y) && !onRoad(nx, p.y)) p.x = nx;
      if (!inBuilding(p.x, ny) && !onRoad(p.x, ny)) p.y = ny;
    }

    // --- bullets ---
    for (const b of bullets) { b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt; }
    for (let i = bullets.length - 1; i >= 0; i--) { const b = bullets[i]; if (b.life <= 0 || b.x <= 0 || b.x >= W || b.y <= 0 || b.y >= H) bullets.splice(i, 1); }
    for (const b of bullets) {
      for (const c of cops) if (dist(b.x, b.y, c.x, c.y) < 24) { c.hp = (c.hp || 3) - 1; b.life = 0; burst(b.x, b.y, '#ff5f5f', 8, 140); if (c.hp <= 0) { state.kills++; addWanted(1, 'cop down'); } }
      for (const p of peds) if (dist(b.x, b.y, p.x, p.y) < 16) { p.flee = 4; b.life = 0; }
    }

    // --- wanted / police ---
    ensureCops();
    if (state.wanted > 0) {
      state.heatTimer += dt;
      const seen = dist(px, py, state.camera.x, state.camera.y) < 900; // police stay aware while near
      if (state.heatTimer > CFG.wantedDecay + state.wanted * 4) { state.wanted = Math.max(0, state.wanted - 1); state.heatTimer = 0; setToast(state.wanted === 0 ? 'You lost the heat.' : `Heat down to ${state.wanted} star${state.wanted > 1 ? 's' : ''}.`, 2.5); }
    }
    for (const cop of cops) {
      cop.hp = cop.hp ?? 3;
      if (cop.hp <= 0) continue;
      const d = dist(cop.x, cop.y, px, py);
      if (state.wanted === 0) { cop.speed = 0; continue; }
      const a = Math.atan2(py - cop.y, px - cop.x);
      if (cop.car && d > 60) {
        cop.car.angle += clamp(angDiff(a, cop.car.angle), -2.4 * dt, 2.4 * dt);
        cop.car.speed += (CFG.copSpeed - cop.car.speed) * dt;
        cop.car.x += Math.cos(cop.car.angle) * cop.car.speed * dt;
        cop.car.y += Math.sin(cop.car.angle) * cop.car.speed * dt;
        cop.x = cop.car.x; cop.y = cop.car.y; cop.angle = cop.car.angle;
        if (player.inCar && d < 46 && Math.abs(player.inCar.speed) < 40) { state.screen = 'busted'; }
      } else {
        cop.angle = a; cop.speed = 210;
        cop.x += Math.cos(a) * cop.speed * dt; cop.y += Math.sin(a) * cop.speed * dt;
        if (d < CFG.copCatchDist && !player.inCar && player.speed < 120) state.screen = 'busted';
        if (d < CFG.copCatchDist && player.inCar && Math.abs(player.inCar.speed) < 40) state.screen = 'busted';
      }
    }
    for (let i = cops.length - 1; i >= 0; i--) { if (cops[i].hp <= 0 && state.wanted === 0) { const dead = cops.splice(i, 1)[0]; if (dead.car) { const ci = cars.indexOf(dead.car); if (ci >= 0) cars.splice(ci, 1); } } }

    // --- missions ---
    if (!state.mission && state.missionIndex < story.length && state.screen === 'play') {
      // auto-offer next story mission once per run
      if (state.elapsed > 2 && !state._offered) { state._offered = true; startMission(state.missionIndex); }
    }
    if (state.mission) {
      state.missionTimer -= dt;
      const m = state.mission;
      const target = m.pickedUp ? m.to : m.from;
      if (dist(px, py, target.x, target.y) < 46) {
        if (!m.pickedUp) { m.pickedUp = true; state.missionStage = 'deliver'; setToast(`Got it — now head to ${m.to.label}.`, 3); }
        else completeMission();
      }
      if (state.missionTimer <= 0 && state.mission) { setToast(`Mission failed: ${m.name} — out of time.`, 3); state.mission = null; state.missionStage = 'idle'; state.missionIndex = Math.min(state.missionIndex + 1, story.length - 1); state._offered = false; }
    }
    if (state.side) {
      state.sideTimer -= dt;
      const s = state.side, target = s.pickedUp ? s.to : s.from;
      if (dist(px, py, target.x, target.y) < 46) {
        if (!s.pickedUp) { s.pickedUp = true; setToast('Passenger aboard — drive to the marker.', 3); }
        else completeSide();
      }
      if (state.sideTimer <= 0) { setToast(`${s.name} expired.`, 2.5); state.side = null; }
    }
    // side-job keys: T taxi, C courier
    if (input.hit('KeyT') && !state.side) startSide('taxi');
    if (input.hit('KeyC') && !state.side) startSide('courier');

    // health / death
    if (player.health <= 0) { state.screen = 'wasted'; player.alive = false; }
    state.playerCashAtEnd = player.money;

    // camera follows player
    const tx = clamp(px, CFG.viewW / 2, W - CFG.viewW / 2), ty = clamp(py, CFG.viewH / 2, H - CFG.viewH / 2);
    // world is exactly view-sized, so camera is fixed center; keep smooth anyway
    state.camera.x += (640 - state.camera.x) * 0.2;
    state.camera.y += (360 - state.camera.y) * 0.2;
    void tx; void ty;
  }

  function resetRun() {
    player.x = 560; player.y = 400; player.health = CFG.playerHealth; player.money = CFG.moneyStart;
    player.rep = CFG.repStart; player.inCar = null; player.ammo = 0; player.hasGun = false; player.alive = true;
    state.wanted = 0; state.mission = null; state.missionIndex = 0; state.missionStage = 'idle';
    state.side = null; state._offered = false; state.screen = 'play'; state.elapsed = 0;
    for (const c of cops) { const i = cars.indexOf(c.car); if (i >= 0) cars.splice(i, 1); }
    cops.length = 0;
  }

  return {
    state, player, cars, peds, cops, bullets, pickups,
    buildings, palms, parks, roadsV, roadsH, pier, beach, missionSpots, story,
    districtAt, step, startMission, startSide, addWanted, resetRun, setToast, scarePeds,
  };
}
export function clockString(seconds) {
  const h = Math.floor(seconds / 3600) % 24, m = Math.floor(seconds / 60) % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
