// Every tuning number and colour in one place. The camera shows a 1280x720 window onto a
// 3200x2400 city; the renderer scales that window to the browser, so no rule below depends on
// the screen size.

/** The camera window, in world units. */
export const VIEW = { width: 1280, height: 720 };
/** The whole city, in world units. */
export const WORLD = { width: 3200, height: 2400 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Roads: centre lines, spacing and width. Blocks sit between neighbouring roads. */
export const ROADS = {
  width: 64,
  vertical: [200, 500, 800, 1100, 1400, 1700, 2000, 2300, 2600, 2900],
  horizontal: [150, 450, 750, 1050, 1350, 1650, 1950, 2250],
};

/** Water on the west edge (the marina) and sand along the south edge (the beach). */
export const COAST = { waterWest: 140, sandTop: 2260 };

export const PLAYER = {
  radius: 14,
  walk: 175,
  run: 305,
  health: 100,
  regenDelay: 6,
  regenRate: 3,
  punchRange: 48,
  punchDamage: 20,
  punchCooldown: 0.45,
  gunRange: 620,
  gunDamage: 34,
  gunCooldown: 0.22,
  stealRange: 70,
  pickupRange: 30,
};

/** Four drivable kinds: length and width in world units, speed in units per second. */
export const CAR_TYPES = {
  sedan: { length: 64, width: 32, maxSpeed: 520, accel: 430, brake: 640, reverseMax: 130, steer: 2.35, colours: ['#c94f4f', '#4f7ec9', '#c9c9c9', '#3f4a56', '#7a5fb0'] },
  taxi: { length: 64, width: 32, maxSpeed: 480, accel: 420, brake: 640, reverseMax: 120, steer: 2.35, colours: ['#f2c230'] },
  van: { length: 78, width: 36, maxSpeed: 400, accel: 330, brake: 560, reverseMax: 110, steer: 2.0, colours: ['#e8e4da', '#5f7a68', '#8a6f4d'] },
  sports: { length: 68, width: 32, maxSpeed: 690, accel: 560, brake: 700, reverseMax: 150, steer: 2.7, colours: ['#d21f3c', '#f2a007', '#1f9ed2', '#e8e8e8'] },
};

export const TRAFFIC = {
  count: 14,
  parked: 10,
  cruise: 190,
  cruiseJitter: 60,
  turnChance: 0.3,
  followGap: 78,
  spawnClear: 420,
};

export const PEDS = { count: 26, walk: 62, flee: 265, fleeSeconds: 3.5, health: 30 };

export const POLICE = {
  officerHealth: 50,
  officerSpeed: 235,
  carSpeed: 560,
  bustRangeFoot: 36,
  bustRangeCar: 48,
  bustSeconds: 0.8,
  spawnRange: 620,
  despawnRange: 1100,
  maxCars: 6,
  maxOfficers: 8,
};

/** Wanted level: what raises it, and how it falls when the police lose sight of the player. */
export const WANTED = {
  max: 5,
  steal: 1,
  hitPed: 1,
  punchPed: 1,
  shoot: 1,
  hitPolice: 1,
  sightRange: 700,
  decaySeconds: 10,
};

export const BULLET = { speed: 900, life: 0.8, radius: 3 };

export const GUN_PICKUPS = 5;
export const GUN_AMMO = 12;

/** Mission definitions: three main jobs in a chain, then two repeatable side jobs. */
export const MISSIONS = {
  main: [
    {
      id: 'm1',
      title: 'Marina Delivery',
      brief: 'Take the package to the marina drop point.',
      stages: [{ label: 'Drive to the marina drop point', x: 200, y: 450 }],
      time: 110,
      reward: 500,
      rep: 10,
    },
    {
      id: 'm2',
      title: 'Getaway Driver',
      brief: 'Pick up the passenger, then lose the heat and reach the safe house.',
      stages: [
        { label: 'Pick up the passenger in Old Town', x: 2450, y: 450 },
        { label: 'Reach the safe house in the Marina', x: 200, y: 1350 },
      ],
      time: 120,
      reward: 800,
      rep: 15,
      heatOnPickup: 2,
    },
    {
      id: 'm3',
      title: 'Yacht Club Pickup',
      brief: 'Collect the guest at the yacht club and drop them at the beachfront.',
      stages: [
        { label: 'Reach the yacht club', x: 420, y: 1950 },
        { label: 'Drop the guest at the beachfront', x: 1700, y: 2160 },
      ],
      time: 130,
      reward: 1200,
      rep: 20,
    },
  ],
  side: [
    { id: 'taxi', title: 'Cab Fare', brief: 'Pick up the rider and drop them off.', reward: 150, rep: 3, time: 75 },
    { id: 'courier', title: 'Courier Run', brief: 'Collect the parcel and deliver it.', reward: 100, rep: 2, time: 70 },
  ],
};

export const CLOCK = { startHour: 8, minutesPerSecond: 1 };

export const PALETTE = {
  backdrop: '#0d1420',
  water: '#1d6f8e',
  waterDeep: '#155a75',
  sand: '#e0c896',
  grass: '#4d8a4f',
  park: '#3f7d44',
  sidewalk: '#b9b3a4',
  road: '#33373d',
  roadLine: '#d8c95a',
  buildingDowntown: ['#8a7f74', '#7d8a99', '#9a8a7a', '#6f7d8a', '#a08a6a'],
  buildingOldtown: ['#b08a6a', '#a07a5a', '#c09a72', '#8a6f52'],
  buildingMarina: ['#7fa8b0', '#6f9aa8', '#8ab0a8', '#5f8a9a'],
  buildingBeach: ['#e8d8b8', '#dfc8a0', '#f0e0c0'],
  roof: '#00000033',
  tree: '#2f6b34',
  palm: '#3f8a4a',
  player: '#f2c230',
  playerDark: '#2b2b2b',
  ped: ['#c96a5a', '#5a8ac9', '#6ac95a', '#c9a45a', '#8a5ac9', '#5ac9b0'],
  police: '#2b4ac9',
  policeLight: '#ff2b2b',
  policeLightB: '#2b6bff',
  carGlass: '#20262e',
  bullet: '#ffe9a8',
  beacon: '#f2c230',
  marker: '#ff5a3c',
  panel: '#141a24ee',
  text: '#eef1f5',
  muted: '#9aa3b2',
  cash: '#7ddc7d',
  danger: '#ff5a5a',
  star: '#ffd23c',
  starEmpty: '#5a6472',
  minimapBg: '#10161fee',
  minimapRoad: '#4a5058',
  minimapWater: '#1d6f8e',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best cash and the finished main jobs are kept between visits (this browser only). */
export const BEST_KEY = 'solara-bay.best-cash';
export const PROGRESS_KEY = 'solara-bay.progress';
