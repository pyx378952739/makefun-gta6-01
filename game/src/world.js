// The game's rules and state, with no drawing and no browser in it: the city, the player on
// foot and in a car, traffic, pedestrians, the police and the wanted level, combat, missions and
// money. step() advances one fixed step and returns what happened as bit flags, so the caller
// can react (sounds, toasts, screens) without the world knowing about screens or sound.
// Nothing here allocates after createWorld returns, apart from short-lived event objects.
import {
  BULLET,
  CAR_TYPES,
  CLOCK,
  COAST,
  GUN_AMMO,
  GUN_PICKUPS,
  MISSIONS,
  PEDS,
  PLAYER,
  POLICE,
  ROADS,
  TRAFFIC,
  VIEW,
  WANTED,
  WORLD,
} from './config.js';
import { ACTION_INTERACT, ACTION_JOB, ACTION_PUNCH } from './input.js';

export const EVENT_NONE = 0;
export const EVENT_CRASH = 1;
export const EVENT_STEAL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_SHOT = 8;
export const EVENT_PUNCH = 16;
export const EVENT_MISSION_DONE = 32;
export const EVENT_MISSION_FAIL = 64;
export const EVENT_BUSTED = 128;
export const EVENT_WASTED = 256;
export const EVENT_HIT_PED = 512;

const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}
function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
/** Push a circle out of a rectangle; returns true when they overlapped. */
function circleRectResolve(circle, rect) {
  const cx = clamp(circle.x, rect.x, rect.x + rect.w);
  const cy = clamp(circle.y, rect.y, rect.y + rect.h);
  const dx = circle.x - cx;
  const dy = circle.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 >= circle.radius * circle.radius) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    circle.x = cx + (dx / d) * circle.radius;
    circle.y = cy + (dy / d) * circle.radius;
  } else {
    circle.y = rect.y - circle.radius;
  }
  return true;
}

function districtAt(x, y) {
  if (x < 640) return 'marina';
  if (y > 1980) return 'beach';
  if (x > 2250 && y < 1000) return 'oldtown';
  return 'downtown';
}

const DISTRICT_HEIGHT = { downtown: [3, 6], oldtown: [1, 2], marina: [2, 3], beach: [1, 2] };
const DISTRICT_COLOURS = {
  downtown: ['#8a7f74', '#7d8a99', '#9a8a7a', '#6f7d8a', '#a08a6a'],
  oldtown: ['#b08a6a', '#a07a5a', '#c09a72', '#8a6f52'],
  marina: ['#7fa8b0', '#6f9aa8', '#8ab0a8', '#5f8a9a'],
  beach: ['#e8d8b8', '#dfc8a0', '#f0e0c0'],
};

export function createWorld(random) {
  // ------------------------------------------------------------ the city
  const buildings = [];
  const trees = [];
  const parks = [];
  const piers = [];

  function addBlock(x0, y0, x1, y1) {
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const district = districtAt(cx, cy);
    if (random() < 0.16) {
      parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      const count = 4 + Math.floor(random() * 6);
      for (let i = 0; i < count; i += 1) {
        trees.push({ x: x0 + 20 + random() * (x1 - x0 - 40), y: y0 + 20 + random() * (y1 - y0 - 40), palm: district === 'beach' });
      }
      return;
    }
    const colours = DISTRICT_COLOURS[district];
    const heightRange = DISTRICT_HEIGHT[district];
    const cols = (x1 - x0) > 200 ? 2 : 1;
    const rows = (y1 - y0) > 200 ? 2 : 1;
    for (let c = 0; c < cols; c += 1) {
      for (let r = 0; r < rows; r += 1) {
        if (random() < 0.18) continue;
        const bx0 = x0 + (c * (x1 - x0)) / cols + 14 + random() * 10;
        const by0 = y0 + (r * (y1 - y0)) / rows + 14 + random() * 10;
        const bw = (x1 - x0) / cols - 28 - random() * 24;
        const bh = (y1 - y0) / rows - 28 - random() * 24;
        if (bw < 40 || bh < 40) continue;
        buildings.push({
          x: bx0,
          y: by0,
          w: bw,
          h: bh,
          color: colours[Math.floor(random() * colours.length)],
          height: heightRange[0] + Math.floor(random() * (heightRange[1] - heightRange[0] + 1)),
          district,
        });
      }
    }
    const treeCount = Math.floor(random() * 4);
    for (let i = 0; i < treeCount; i += 1) {
      trees.push({ x: x0 + 12 + random() * (x1 - x0 - 24), y: y0 + 12 + random() * (y1 - y0 - 24), palm: district === 'beach' || district === 'marina' });
    }
  }

  // Blocks between neighbouring roads, plus the strips along the north and east edges.
  for (let i = 0; i < ROADS.vertical.length - 1; i += 1) {
    for (let j = 0; j < ROADS.horizontal.length - 1; j += 1) {
      addBlock(ROADS.vertical[i] + ROADS.width / 2, ROADS.horizontal[j] + ROADS.width / 2,
        ROADS.vertical[i + 1] - ROADS.width / 2, ROADS.horizontal[j + 1] - ROADS.width / 2);
    }
  }
  for (let i = 0; i < ROADS.vertical.length - 1; i += 1) {
    addBlock(ROADS.vertical[i] + ROADS.width / 2, 20, ROADS.vertical[i + 1] - ROADS.width / 2, ROADS.horizontal[0] - ROADS.width / 2);
  }
  for (let j = 0; j < ROADS.horizontal.length - 1; j += 1) {
    addBlock(ROADS.vertical[ROADS.vertical.length - 1] + ROADS.width / 2, ROADS.horizontal[j] + ROADS.width / 2,
      WORLD.width - 24, ROADS.horizontal[j + 1] - ROADS.width / 2);
  }
  // Marina piers reaching into the water on the west edge.
  for (const py of [400, 900, 1400]) piers.push({ x: 24, y: py, w: 116, h: 26 });

  const city = { buildings, trees, parks, piers };

  // ------------------------------------------------------------ entities
  const player = {
    x: 1400, y: 1050, angle: -Math.PI / 2, radius: PLAYER.radius,
    onFoot: true, car: null, ammo: 0, punchCd: 0, gunCd: 0, moving: false,
  };
  const cars = [];
  const peds = [];
  const officers = [];
  const bullets = [];
  const pickups = [];
  const particles = [];

  const state = {
    time: 0, cash: 0, rep: 0, health: PLAYER.health, wanted: 0, unseen: 0,
    bustTimer: 0, lastHurt: -99, busted: false, wasted: false,
    player, cars, peds, officers, bullets, pickups, particles, city,
    mission: null, nextMain: 0, doneMain: [], lastSide: 'courier',
    toast: null, toastT: 0, camera: { x: 1400, y: 1050 },
    policeTimer: 0, clockMinutes: CLOCK.startHour * 60,
  };

  function showToast(text) {
    state.toast = text;
    state.toastT = 3;
  }

  function nearestRoadPoint(x, y, minD, maxD) {
    for (let tries = 0; tries < 40; tries += 1) {
      const vertical = random() < 0.5;
      const px = vertical
        ? ROADS.vertical[Math.floor(random() * ROADS.vertical.length)]
        : 200 + random() * (WORLD.width - 400);
      const py = vertical
        ? 200 + random() * (WORLD.height - 400)
        : ROADS.horizontal[Math.floor(random() * ROADS.horizontal.length)];
      const d = dist(x, y, px, py);
      if (d >= minD && d <= maxD) return { x: clamp(px, 180, WORLD.width - 40), y: clamp(py, 60, WORLD.height - 60) };
    }
    return { x: 1400, y: 1050 };
  }

  function spawnParticles(x, y, count, color, speed) {
    for (let i = 0; i < count; i += 1) {
      if (particles.length >= 120) return;
      const a = random() * TAU;
      const s = (0.3 + random() * 0.7) * speed;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + random() * 0.4, max: 0.8, color, size: 2 + random() * 3 });
    }
  }

  function fleeNear(x, y, radius) {
    for (const ped of peds) {
      if (ped.state !== 'down' && dist(ped.x, ped.y, x, y) < radius) {
        ped.state = 'flee';
        ped.fleeT = PEDS.fleeSeconds;
        ped.fleeX = x;
        ped.fleeY = y;
      }
    }
  }

  function makeCar(type, x, y, angle, driver) {
    const def = CAR_TYPES[type];
    return {
      type, x, y, angle, speed: 0, radius: def.width / 2 + 2,
      color: def.colours[Math.floor(random() * def.colours.length)],
      driver,
      cruise: TRAFFIC.cruise + (random() - 0.5) * TRAFFIC.cruiseJitter,
      axis: Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? 'x' : 'y',
      dir: 1, lane: 0, turnCd: 0, brakeLight: false, buildingTouch: false, bumpCd: 0,
    };
  }

  function roadPointNear(x, y, range) {
    const vertical = random() < 0.5;
    if (vertical) {
      const rx = ROADS.vertical[Math.floor(random() * ROADS.vertical.length)];
      return { x: rx, y: clamp(y + (random() - 0.5) * range * 2, 120, WORLD.height - 120), axis: 'y' };
    }
    const ry = ROADS.horizontal[Math.floor(random() * ROADS.horizontal.length)];
    return { x: clamp(x + (random() - 0.5) * range * 2, 200, WORLD.width - 200), y: ry, axis: 'x' };
  }

  function spawnTrafficCar() {
    const types = ['sedan', 'sedan', 'taxi', 'van', 'sports'];
    for (let tries = 0; tries < 8; tries += 1) {
      const type = types[Math.floor(random() * types.length)];
      const p = roadPointNear(player.x, player.y, 1400);
      if (dist(p.x, p.y, player.x, player.y) < TRAFFIC.spawnClear) continue;
      const car = makeCar(type, p.x, p.y, p.axis === 'x' ? 0 : Math.PI / 2, 'traffic');
      car.axis = p.axis;
      car.dir = random() < 0.5 ? 1 : -1;
      car.speed = car.cruise * 0.7;
      car.lane = car.dir === 1 ? 16 : -16;
      cars.push(car);
      return;
    }
  }

  function spawnParkedCar() {
    const types = ['sedan', 'sedan', 'taxi', 'van', 'sports'];
    const type = types[Math.floor(random() * types.length)];
    const vertical = random() < 0.5;
    let x;
    let y;
    let angle;
    if (vertical) {
      const rx = ROADS.vertical[Math.floor(random() * ROADS.vertical.length)];
      x = rx + (random() < 0.5 ? 24 : -24);
      y = 200 + random() * (WORLD.height - 400);
      angle = Math.PI / 2;
    } else {
      const ry = ROADS.horizontal[Math.floor(random() * ROADS.horizontal.length)];
      x = 240 + random() * (WORLD.width - 480);
      y = ry + (random() < 0.5 ? 24 : -24);
      angle = 0;
    }
    const car = makeCar(type, x, y, angle, 'none');
    cars.push(car);
  }

  function spawnPed() {
    const p = roadPointNear(player.x, player.y, 1200);
    const vertical = random() < 0.5;
    const ped = {
      x: p.x + (vertical ? (random() < 0.5 ? 44 : -44) : 0),
      y: p.y + (vertical ? 0 : (random() < 0.5 ? 44 : -44)),
      angle: random() * TAU, speed: PEDS.walk * (0.8 + random() * 0.4),
      state: 'walk', health: PEDS.health, fleeT: 0, fleeX: 0, fleeY: 0, downT: 0,
      color: ['#c96a5a', '#5a8ac9', '#6ac95a', '#c9a45a', '#8a5ac9', '#5ac9b0'][Math.floor(random() * 6)],
      axis: vertical ? 'y' : 'x', dir: random() < 0.5 ? 1 : -1, turnCd: 0,
    };
    peds.push(ped);
  }

  function spawnGunPickup() {
    const p = nearestRoadPoint(player.x, player.y, 200, 1600);
    pickups.push({ x: p.x + (random() - 0.5) * 60, y: p.y + (random() - 0.5) * 60, ammo: GUN_AMMO });
  }

  function spawnPoliceCar() {
    const p = roadPointNear(player.x, player.y, POLICE.spawnRange);
    const car = makeCar('sedan', p.x, p.y, 0, 'police');
    car.color = '#1c2a4a';
    car.cruise = POLICE.carSpeed;
    cars.push(car);
  }

  function spawnOfficer() {
    const p = nearestRoadPoint(player.x, player.y, 300, 600);
    officers.push({ x: p.x, y: p.y, angle: 0, health: POLICE.officerHealth, radius: 14 });
  }

  function reset() {
    state.time = 0;
    state.cash = 0;
    state.rep = 0;
    state.health = PLAYER.health;
    state.wanted = 0;
    state.unseen = 0;
    state.bustTimer = 0;
    state.lastHurt = -99;
    state.busted = false;
    state.wasted = false;
    state.mission = null;
    state.nextMain = 0;
    state.doneMain = [];
    state.lastSide = 'courier';
    state.toast = null;
    state.toastT = 0;
    state.policeTimer = 0;
    state.clockMinutes = CLOCK.startHour * 60;
    player.x = 1400;
    player.y = 1050;
    player.angle = -Math.PI / 2;
    player.onFoot = true;
    player.car = null;
    player.ammo = 0;
    player.punchCd = 0;
    player.gunCd = 0;
    player.moving = false;
    cars.length = 0;
    peds.length = 0;
    officers.length = 0;
    bullets.length = 0;
    pickups.length = 0;
    particles.length = 0;
    for (let i = 0; i < TRAFFIC.count; i += 1) spawnTrafficCar();
    for (let i = 0; i < TRAFFIC.parked; i += 1) spawnParkedCar();
    for (let i = 0; i < PEDS.count; i += 1) spawnPed();
    for (let i = 0; i < GUN_PICKUPS; i += 1) spawnGunPickup();
    state.camera.x = player.x;
    state.camera.y = player.y;
  }

  // ------------------------------------------------------------ missions
  function startMission(kind) {
    if (state.mission !== null) return false;
    if (kind === 'main') {
      if (state.nextMain >= MISSIONS.main.length) return false;
      const def = MISSIONS.main[state.nextMain];
      const stage = def.stages[0];
      state.mission = { kind: 'main', def, stage: 0, target: { x: stage.x, y: stage.y, label: stage.label }, timer: def.time, reward: def.reward, rep: def.rep };
      showToast(`${def.title}: ${stage.label}`);
      return true;
    }
    const def = MISSIONS.side.find((s) => s.id !== state.lastSide);
    state.lastSide = def.id;
    const pickup = nearestRoadPoint(player.x, player.y, 250, 800);
    state.mission = { kind: 'side', def, stage: 0, target: { x: pickup.x, y: pickup.y, label: def.id === 'taxi' ? 'Pick up the rider' : 'Collect the parcel' }, timer: def.time, reward: def.reward, rep: def.rep, drop: null };
    showToast(`${def.title}: ${state.mission.target.label}`);
    return true;
  }

  function advanceMission() {
    const m = state.mission;
    if (m.kind === 'main') {
      const def = m.def;
      if (m.stage + 1 < def.stages.length) {
        m.stage += 1;
        const stage = def.stages[m.stage];
        m.target = { x: stage.x, y: stage.y, label: stage.label };
        if (def.heatOnPickup) {
          state.wanted = Math.max(state.wanted, def.heatOnPickup);
          showToast('Passenger aboard. Lose the heat, then reach the safe house.');
        } else {
          showToast(stage.label);
        }
        return EVENT_NONE;
      }
      state.cash += m.reward;
      state.rep += m.rep;
      state.doneMain.push(def.id);
      state.nextMain += 1;
      state.mission = null;
      showToast(`${def.title} complete. +$${m.reward}`);
      return EVENT_MISSION_DONE;
    }
    // Side job: stage 0 is the pickup, stage 1 the drop-off.
    if (m.stage === 0) {
      const drop = nearestRoadPoint(m.target.x, m.target.y, 400, 1200);
      m.stage = 1;
      m.drop = drop;
      m.target = { x: drop.x, y: drop.y, label: m.def.id === 'taxi' ? 'Drop the rider off' : 'Deliver the parcel' };
      showToast(m.target.label);
      return EVENT_NONE;
    }
    state.cash += m.reward;
    state.rep += m.rep;
    state.mission = null;
    showToast(`${m.def.title} complete. +$${m.reward}`);
    return EVENT_MISSION_DONE;
  }

  function updateMission(dt) {
    const m = state.mission;
    if (m === null) return EVENT_NONE;
    m.timer -= dt;
    if (m.timer <= 0) {
      state.mission = null;
      showToast('Job failed: out of time.');
      return EVENT_MISSION_FAIL;
    }
    if (dist(player.x, player.y, m.target.x, m.target.y) < 80) return advanceMission();
    return EVENT_NONE;
  }

  // ------------------------------------------------------------ combat
  function hurtPlayer(amount) {
    state.health = Math.max(0, state.health - amount);
    state.lastHurt = state.time;
    if (state.health <= 0) state.wasted = true;
  }

  function fireBullet(aimX, aimY) {
    if (player.ammo <= 0 || player.gunCd > 0 || !player.onFoot) return EVENT_NONE;
    player.ammo -= 1;
    player.gunCd = PLAYER.gunCooldown;
    const angle = Math.atan2(aimY - player.y, aimX - player.x);
    player.angle = angle;
    bullets.push({ x: player.x + Math.cos(angle) * 20, y: player.y + Math.sin(angle) * 20, angle, speed: BULLET.speed, life: BULLET.life });
    spawnParticles(player.x + Math.cos(angle) * 26, player.y + Math.sin(angle) * 26, 4, '#ffe9a8', 160);
    return EVENT_SHOT;
  }

  function punch() {
    if (player.punchCd > 0 || !player.onFoot) return EVENT_NONE;
    player.punchCd = PLAYER.punchCooldown;
    let events = EVENT_PUNCH;
    const reach = PLAYER.punchRange;
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (dist(player.x, player.y, ped.x, ped.y) > reach + 12) continue;
      if (Math.abs(angleDiff(Math.atan2(ped.y - player.y, ped.x - player.x), player.angle)) > 1.1) continue;
      ped.health -= PLAYER.punchDamage;
      ped.x += Math.cos(player.angle) * 14;
      ped.y += Math.sin(player.angle) * 14;
      if (ped.health <= 0) {
        ped.state = 'down';
        ped.downT = 4;
        state.wanted = Math.min(WANTED.max, state.wanted + WANTED.punchPed);
        events |= EVENT_HIT_PED;
      }
      fleeNear(ped.x, ped.y, 260);
    }
    for (const officer of officers) {
      if (dist(player.x, player.y, officer.x, officer.y) > reach + 12) continue;
      if (Math.abs(angleDiff(Math.atan2(officer.y - player.y, officer.x - player.x), player.angle)) > 1.1) continue;
      officer.health -= PLAYER.punchDamage;
      state.wanted = Math.min(WANTED.max, state.wanted + WANTED.hitPolice);
      fleeNear(officer.x, officer.y, 200);
    }
    return events;
  }

  function nearestCar(maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of cars) {
      if (car.driver === 'player' || car.driver === 'police') continue;
      const d = dist(player.x, player.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    if (car.driver === 'traffic') {
      // The driver bails out on foot and runs.
      const ped = {
        x: car.x, y: car.y, angle: random() * TAU, speed: PEDS.flee,
        state: 'flee', health: PEDS.health, fleeT: PEDS.fleeSeconds, fleeX: car.x, fleeY: car.y, downT: 0,
        color: '#c96a5a', axis: 'x', dir: 1, turnCd: 0,
      };
      peds.push(ped);
      state.wanted = Math.min(WANTED.max, state.wanted + WANTED.steal);
      fleeNear(car.x, car.y, 300);
      showToast('Car stolen. The police are on their way.');
    } else {
      state.wanted = Math.min(WANTED.max, state.wanted + WANTED.steal);
      showToast('Car stolen. The police are on their way.');
    }
    car.driver = 'player';
    car.speed = 0;
    player.car = car;
    player.onFoot = false;
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    return EVENT_STEAL;
  }

  function exitCar() {
    const car = player.car;
    if (car === null) return EVENT_NONE;
    car.driver = 'none';
    car.speed = 0;
    player.car = null;
    player.onFoot = true;
    player.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    player.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    player.x = clamp(player.x, 150, WORLD.width - 10);
    player.y = clamp(player.y, 10, WORLD.height - 10);
    return EVENT_NONE;
  }

  // ------------------------------------------------------------ movement
  function collideBuildings(circle) {
    let hit = false;
    for (const b of buildings) {
      if (circle.x + circle.radius < b.x || circle.x - circle.radius > b.x + b.w ||
          circle.y + circle.radius < b.y || circle.y - circle.radius > b.y + b.h) continue;
      if (circleRectResolve(circle, b)) hit = true;
    }
    return hit;
  }

  function updatePlayerOnFoot(dt, input) {
    const move = input.move || { x: 0, y: 0 };
    const len = Math.hypot(move.x, move.y);
    player.moving = len > 0;
    if (len > 0) {
      const speed = input.run ? PLAYER.run : PLAYER.walk;
      const nx = move.x / len;
      const ny = move.y / len;
      player.x += nx * speed * dt;
      player.y += ny * speed * dt;
      if (player.ammo > 0 && input.aim) {
        player.angle = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
      } else {
        player.angle = Math.atan2(ny, nx);
      }
    } else if (player.ammo > 0 && input.aim) {
      player.angle = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
    }
    player.x = clamp(player.x, 150, WORLD.width - 10);
    player.y = clamp(player.y, 10, WORLD.height - 10);
    collideBuildings(player);
    // Gun pickups: walk over one to take it.
    for (let i = pickups.length - 1; i >= 0; i -= 1) {
      const p = pickups[i];
      if (dist(player.x, player.y, p.x, p.y) < PLAYER.pickupRange) {
        player.ammo += p.ammo;
        pickups.splice(i, 1);
        showToast(`Picked up a pistol. ${player.ammo} rounds.`);
        return EVENT_PICKUP;
      }
    }
    return EVENT_NONE;
  }

  function updatePlayerCar(dt, input) {
    const car = player.car;
    const def = CAR_TYPES[car.type];
    const move = input.move || { x: 0, y: 0 };
    const throttle = move.y < 0 ? 1 : move.y > 0 ? -0.7 : 0;
    const steer = move.x;
    if (throttle > 0) car.speed += def.accel * throttle * dt;
    else if (throttle < 0) {
      if (car.speed > 30) car.speed -= def.brake * dt;
      else car.speed += def.accel * 0.6 * throttle * dt;
    } else {
      car.speed -= Math.sign(car.speed) * 120 * dt;
      if (Math.abs(car.speed) < 8) car.speed = 0;
    }
    if (input.brake) {
      car.speed -= Math.sign(car.speed) * 900 * dt;
      if (Math.abs(car.speed) < 12) car.speed = 0;
    }
    car.speed = clamp(car.speed, -def.reverseMax, def.maxSpeed);
    const grip = clamp(Math.abs(car.speed) / 160, 0, 1) * Math.sign(car.speed || 1);
    car.angle += steer * def.steer * grip * dt * (input.brake ? 1.35 : 1);
    car.brakeLight = input.brake || throttle < 0;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 150, WORLD.width - 10);
    car.y = clamp(car.y, 10, WORLD.height - 10);
    const before = car.speed;
    const wasTouching = car.buildingTouch;
    const hitWall = collideBuildings(car);
    car.buildingTouch = hitWall;
    if (hitWall) {
      if (!wasTouching && Math.abs(before) > 240) {
        spawnParticles(car.x, car.y, 10, '#ffb84d', 220);
        hurtPlayer((Math.abs(before) - 240) / 18);
        fleeNear(car.x, car.y, 220);
        car.speed *= 0.45;
        return EVENT_CRASH;
      }
      // A first touch scrubs speed; sliding along a wall afterwards only drags a little,
      // so a car pushed off line can steer back instead of grinding to a stop.
      car.speed *= wasTouching ? 0.995 : 0.6;
    }
    // Running over a pedestrian.
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      if (dist(car.x, car.y, ped.x, ped.y) < car.radius + 10 && Math.abs(car.speed) > 60) {
        ped.health = 0;
        ped.state = 'down';
        ped.downT = 4;
        state.wanted = Math.min(WANTED.max, state.wanted + WANTED.hitPed);
        fleeNear(ped.x, ped.y, 260);
        spawnParticles(ped.x, ped.y, 8, '#ff5a5a', 180);
        return EVENT_HIT_PED;
      }
    }
    // Hitting another car: separate the two, and only count a hard hit once per half second —
    // a police car tailing the player must not grind its speed away by touching it.
    for (const other of cars) {
      if (other === car || other.driver === 'player') continue;
      const d = dist(car.x, car.y, other.x, other.y);
      if (d < car.radius + other.radius) {
        const rel = Math.abs(car.speed - other.speed);
        const push = (car.radius + other.radius - d) / 2;
        const nx = (car.x - other.x) / (d || 1);
        const ny = (car.y - other.y) / (d || 1);
        car.x += nx * push;
        car.y += ny * push;
        other.x -= nx * push;
        other.y -= ny * push;
        if (rel > 200 && car.bumpCd <= 0) {
          car.bumpCd = 0.5;
          other.bumpCd = 0.5;
          spawnParticles((car.x + other.x) / 2, (car.y + other.y) / 2, 8, '#ffb84d', 200);
          car.speed *= 0.55;
          other.speed *= 0.5;
          if (other.driver === 'police') {
            state.wanted = Math.min(WANTED.max, state.wanted + WANTED.hitPolice);
            fleeNear(car.x, car.y, 200);
          }
          return EVENT_CRASH;
        }
      }
    }
    player.x = car.x;
    player.y = car.y;
    player.angle = car.angle;
    player.moving = Math.abs(car.speed) > 10;
    return EVENT_NONE;
  }

  function updateTrafficCar(dt, car) {
    const roadW = ROADS.width;
    let targetSpeed = car.cruise;
    // Slow down for the car ahead in the same lane.
    for (const other of cars) {
      if (other === car || other.axis !== car.axis || other.dir !== car.dir) continue;
      const ahead = car.axis === 'x' ? (other.x - car.x) * car.dir : (other.y - car.y) * car.dir;
      const lateral = car.axis === 'x' ? Math.abs(other.y - car.y) : Math.abs(other.x - car.x);
      if (ahead > 0 && ahead < TRAFFIC.followGap && lateral < 40) targetSpeed = Math.min(targetSpeed, Math.max(0, other.speed * 0.8));
    }
    car.speed += clamp(targetSpeed - car.speed, -260 * dt, 200 * dt);
    if (car.axis === 'x') {
      car.x += car.dir * car.speed * dt;
      car.angle = car.dir === 1 ? 0 : Math.PI;
    } else {
      car.y += car.dir * car.speed * dt;
      car.angle = car.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
    }
    car.turnCd -= dt;
    // At an intersection, sometimes turn onto the crossing road.
    if (car.turnCd <= 0) {
      const roads = car.axis === 'x' ? ROADS.vertical : ROADS.horizontal;
      const pos = car.axis === 'x' ? car.x : car.y;
      for (const r of roads) {
        if (Math.abs(pos - r) < 10 && random() < TRAFFIC.turnChance) {
          car.axis = car.axis === 'x' ? 'y' : 'x';
          car.dir = random() < 0.5 ? 1 : -1;
          car.lane = car.dir === 1 ? 16 : -16;
          car.turnCd = 2;
          break;
        }
      }
    }
    // Keep on the road: snap the lateral position to its lane.
    if (car.axis === 'x') {
      let best = ROADS.horizontal[0];
      for (const r of ROADS.horizontal) if (Math.abs(r - car.y) < Math.abs(best - car.y)) best = r;
      car.y += (best + car.lane - car.y) * Math.min(1, 6 * dt);
    } else {
      let best = ROADS.vertical[0];
      for (const r of ROADS.vertical) if (Math.abs(r - car.x) < Math.abs(best - car.x)) best = r;
      car.x += (best + car.lane - car.x) * Math.min(1, 6 * dt);
    }
    // Turn around at the city edge instead of leaving the map.
    if (car.x < 180 || car.x > WORLD.width - 30 || car.y < 60 || car.y > WORLD.height - 30) {
      car.dir = -car.dir;
      car.lane = -car.lane;
      car.x = clamp(car.x, 190, WORLD.width - 40);
      car.y = clamp(car.y, 70, WORLD.height - 40);
    }
  }

  function updatePoliceCar(dt, car) {
    const want = Math.atan2(player.y - car.y, player.x - car.x);
    const diff = angleDiff(want, car.angle);
    // Close behind the player, match its speed and tail it instead of grinding into it.
    let target = POLICE.carSpeed;
    if (player.car !== null) {
      const d = dist(car.x, car.y, player.x, player.y);
      if (d < 90) target = Math.abs(player.car.speed) * 0.95;
    }
    car.speed += clamp(target - car.speed, -600 * dt, 420 * dt);
    car.angle += clamp(diff, -2.6 * dt, 2.6 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 150, WORLD.width - 10);
    car.y = clamp(car.y, 10, WORLD.height - 10);
    const wasTouching = car.buildingTouch;
    const hitWall = collideBuildings(car);
    car.buildingTouch = hitWall;
    if (hitWall) car.speed *= wasTouching ? 0.995 : 0.5;
    player.x = player.car === car ? car.x : player.x;
    // Ramming the player's car slows it; a slow player next to a police car gets caught.
    if (player.car !== null) {
      const d = dist(car.x, car.y, player.x, player.y);
      if (d < car.radius + player.car.radius + 6 && Math.abs(player.car.speed) < 90) {
        state.bustTimer += dt;
      }
    }
  }

  function updatePed(dt, ped) {
    if (ped.state === 'down') {
      ped.downT -= dt;
      return false;
    }
    if (ped.state === 'flee') {
      ped.fleeT -= dt;
      const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
      ped.angle = away;
      ped.x += Math.cos(away) * PEDS.flee * dt;
      ped.y += Math.sin(away) * PEDS.flee * dt;
      ped.x = clamp(ped.x, 150, WORLD.width - 10);
      ped.y = clamp(ped.y, 10, WORLD.height - 10);
      if (ped.fleeT <= 0) ped.state = 'walk';
      return false;
    }
    ped.turnCd -= dt;
    if (ped.axis === 'x') ped.x += ped.dir * ped.speed * dt;
    else ped.y += ped.dir * ped.speed * dt;
    ped.angle = ped.axis === 'x' ? (ped.dir === 1 ? 0 : Math.PI) : (ped.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
    if (ped.turnCd <= 0) {
      const roads = ped.axis === 'x' ? ROADS.vertical : ROADS.horizontal;
      const pos = ped.axis === 'x' ? ped.x : ped.y;
      for (const r of roads) {
        if (Math.abs(pos - r) < 12 && random() < 0.3) {
          ped.axis = ped.axis === 'x' ? 'y' : 'x';
          ped.dir = random() < 0.5 ? 1 : -1;
          ped.turnCd = 2;
          break;
        }
      }
    }
    if (ped.axis === 'x') {
      let best = ROADS.horizontal[0];
      for (const r of ROADS.horizontal) if (Math.abs(r - ped.y) < Math.abs(best - ped.y)) best = r;
      ped.y += (best + (ped.dir === 1 ? 44 : -44) - ped.y) * Math.min(1, 4 * dt);
    } else {
      let best = ROADS.vertical[0];
      for (const r of ROADS.vertical) if (Math.abs(r - ped.x) < Math.abs(best - ped.x)) best = r;
      ped.x += (best + (ped.dir === 1 ? 44 : -44) - ped.x) * Math.min(1, 4 * dt);
    }
    if (ped.x < 160 || ped.x > WORLD.width - 20 || ped.y < 40 || ped.y > WORLD.height - 20) {
      ped.dir = -ped.dir;
      ped.x = clamp(ped.x, 170, WORLD.width - 30);
      ped.y = clamp(ped.y, 50, WORLD.height - 30);
    }
    return ped.downT <= 0 && ped.state === 'down';
  }

  function updateOfficer(dt, officer) {
    const d = dist(officer.x, officer.y, player.x, player.y);
    const want = Math.atan2(player.y - officer.y, player.x - officer.x);
    officer.angle = want;
    officer.x += Math.cos(want) * POLICE.officerSpeed * dt;
    officer.y += Math.sin(want) * POLICE.officerSpeed * dt;
    officer.x = clamp(officer.x, 150, WORLD.width - 10);
    officer.y = clamp(officer.y, 10, WORLD.height - 10);
    collideBuildings(officer);
    if (player.onFoot && d < POLICE.bustRangeFoot) {
      state.bustTimer += dt;
      if (d < 30) hurtPlayer(10 * dt);
    }
    return officer.health <= 0;
  }

  function updateBullets(dt) {
    let events = EVENT_NONE;
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const b = bullets[i];
      b.x += Math.cos(b.angle) * b.speed * dt;
      b.y += Math.sin(b.angle) * b.speed * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height;
      if (!dead) {
        for (const rect of buildings) {
          if (b.x > rect.x && b.x < rect.x + rect.w && b.y > rect.y && b.y < rect.y + rect.h) {
            spawnParticles(b.x, b.y, 4, '#ffb84d', 120);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of peds) {
          if (ped.state === 'down') continue;
          if (dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.health -= PLAYER.gunDamage;
            spawnParticles(b.x, b.y, 6, '#ff5a5a', 160);
            if (ped.health <= 0) {
              ped.state = 'down';
              ped.downT = 4;
              state.wanted = Math.min(WANTED.max, state.wanted + WANTED.shoot);
              events |= EVENT_HIT_PED;
            }
            fleeNear(ped.x, ped.y, 300);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const officer of officers) {
          if (dist(b.x, b.y, officer.x, officer.y) < 16) {
            officer.health -= PLAYER.gunDamage;
            spawnParticles(b.x, b.y, 6, '#ff5a5a', 160);
            state.wanted = Math.min(WANTED.max, state.wanted + WANTED.shoot);
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of cars) {
          if (car.driver === 'player') continue;
          if (dist(b.x, b.y, car.x, car.y) < car.radius) {
            spawnParticles(b.x, b.y, 4, '#ffb84d', 120);
            if (car.driver === 'police') state.wanted = Math.min(WANTED.max, state.wanted + WANTED.hitPolice);
            dead = true;
            break;
          }
        }
      }
      if (dead) bullets.splice(i, 1);
    }
    return events;
  }

  function updateWanted(dt) {
    const policeCars = cars.filter((c) => c.driver === 'police').length;
    const nearest = Math.min(
      ...cars.filter((c) => c.driver === 'police').map((c) => dist(c.x, c.y, player.x, player.y)),
      ...officers.map((o) => dist(o.x, o.y, player.x, player.y)),
      Infinity,
    );
    if (state.wanted > 0 && nearest > WANTED.sightRange) {
      state.unseen += dt;
      if (state.unseen >= WANTED.decaySeconds) {
        state.wanted -= 1;
        state.unseen = 0;
        showToast(state.wanted === 0 ? 'You lost them.' : `Heat down: ${state.wanted} star${state.wanted === 1 ? '' : 's'}.`);
      }
    } else {
      state.unseen = 0;
    }
    // Reinforcements arrive while the heat is on.
    state.policeTimer -= dt;
    if (state.wanted > 0 && state.policeTimer <= 0) {
      state.policeTimer = 1.2;
      const wantCars = Math.min(state.wanted, POLICE.maxCars);
      if (policeCars < wantCars) spawnPoliceCar();
      else if (state.wanted >= 2 && officers.length < Math.min(state.wanted, POLICE.maxOfficers)) spawnOfficer();
    }
    // Police give up and drive off once the heat is gone.
    if (state.wanted === 0) {
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        if (cars[i].driver === 'police' && dist(cars[i].x, cars[i].y, player.x, player.y) > POLICE.despawnRange) cars.splice(i, 1);
      }
      for (let i = officers.length - 1; i >= 0; i -= 1) {
        if (dist(officers[i].x, officers[i].y, player.x, player.y) > POLICE.despawnRange) officers.splice(i, 1);
      }
    }
  }

  // ------------------------------------------------------------ the step
  /**
   * One fixed step. `input` carries the movement vector, run/brake flags, one-shot action flags,
   * the mouse aim in world units and the mouse button state. With `ambient` set (the title
   * screen's backdrop) traffic and pedestrians move but the player, the police and missions sit
   * still and nothing can hurt anyone.
   */
  function step(dt, input, ambient) {
    let events = EVENT_NONE;
    state.time += dt;
    state.clockMinutes = CLOCK.startHour * 60 + state.time * CLOCK.minutesPerSecond;
    if (state.toastT > 0) {
      state.toastT -= dt;
      if (state.toastT <= 0) state.toast = null;
    }
    if (player.punchCd > 0) player.punchCd -= dt;
    if (player.gunCd > 0) player.gunCd -= dt;

    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
    }

    for (const car of cars) {
      if (car.bumpCd > 0) car.bumpCd -= dt;
      if (car.driver === 'traffic') updateTrafficCar(dt, car);
      else if (car.driver === 'police') updatePoliceCar(dt, car);
    }
    for (let i = peds.length - 1; i >= 0; i -= 1) {
      const ped = peds[i];
      updatePed(dt, ped);
      if (ped.state === 'down' && ped.downT <= 0) peds.splice(i, 1);
    }
    for (let i = officers.length - 1; i >= 0; i -= 1) {
      if (updateOfficer(dt, officers[i])) officers.splice(i, 1);
    }
    if (ambient) {
      state.camera.x = clamp(player.x, VIEW.width / 2, WORLD.width - VIEW.width / 2);
      state.camera.y = clamp(player.y, VIEW.height / 2, WORLD.height - VIEW.height / 2);
      return EVENT_NONE;
    }

    const actions = input.actions || 0;
    if (actions & ACTION_JOB) startMission(state.nextMain < MISSIONS.main.length ? 'main' : 'side');
    if (actions & ACTION_INTERACT) {
      if (player.onFoot) {
        const car = nearestCar(PLAYER.stealRange);
        if (car !== null) events |= enterCar(car);
      } else {
        events |= exitCar();
      }
    }
    if (actions & ACTION_PUNCH) events |= punch();
    if (input.mousePressed || (input.mouseDown && player.ammo > 0)) {
      if (player.ammo > 0 && input.aim) events |= fireBullet(input.aim.x, input.aim.y);
      else if (input.mousePressed) events |= punch();
    }

    if (player.onFoot) events |= updatePlayerOnFoot(dt, input);
    else events |= updatePlayerCar(dt, input);

    events |= updateBullets(dt);
    events |= updateMission(dt);
    updateWanted(dt);

    // Slow health recovery after a quiet stretch.
    if (state.time - state.lastHurt > PLAYER.regenDelay && state.health > 0 && state.health < PLAYER.health) {
      state.health = Math.min(PLAYER.health, state.health + PLAYER.regenRate * dt);
    }

    // Caught: a police officer or a police car held the player close while slow.
    if (state.wanted > 0 && state.bustTimer >= POLICE.bustSeconds) {
      state.busted = true;
      events |= EVENT_BUSTED;
    } else if (state.bustTimer > 0 && state.wanted > 0) {
      // The player is pulling away: the arrest clock drains.
      const nearPolice = cars.some((c) => c.driver === 'police' && dist(c.x, c.y, player.x, player.y) < 220) ||
        officers.some((o) => dist(o.x, o.y, player.x, player.y) < 120);
      if (!nearPolice) state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }
    if (state.wasted) events |= EVENT_WASTED;

    state.camera.x = clamp(player.x, VIEW.width / 2, WORLD.width - VIEW.width / 2);
    state.camera.y = clamp(player.y, VIEW.height / 2, WORLD.height - VIEW.height / 2);
    return events;
  }

  reset();
  return {
    state, reset, step, startMission, showToast,
    nearestCar,
    /** Put the player (on foot) at a place, for the staged screenshots. */
    teleport(x, y) {
      if (player.car !== null) {
        player.car.driver = 'none';
        player.car = null;
        player.onFoot = true;
      }
      player.x = x;
      player.y = y;
      player.angle = -Math.PI / 2;
      state.camera.x = clamp(x, VIEW.width / 2, WORLD.width - VIEW.width / 2);
      state.camera.y = clamp(y, VIEW.height / 2, WORLD.height - VIEW.height / 2);
    },
    /** Put the player in a fresh car of the given kind at a place, for the staged screenshots. */
    giveCar(type, x, y, angle) {
      const car = makeCar(type, x, y, angle, 'player');
      cars.push(car);
      player.car = car;
      player.onFoot = false;
      player.x = x;
      player.y = y;
      player.angle = angle;
      return car;
    },
    setWanted(n) {
      state.wanted = clamp(n, 0, WANTED.max);
      state.unseen = 0;
    },
    addPoliceCarNear() {
      spawnPoliceCar();
    },
    clockText() {
      const total = Math.floor(state.clockMinutes) % (24 * 60);
      const h = Math.floor(total / 60);
      const m = total % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
  };
}
