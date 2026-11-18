// The screenshot scenes behind ?shot=chase|start|foot|mission. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot, so the
// frame is what real play looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_BUSTED, EVENT_MISSION_DONE, EVENT_WASTED } from './world.js';
import { SCREEN_MISSION, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const FOOT_SECONDS = 9;
const CHASE_SECONDS = 10;
const MISSION_LIMIT_SECONDS = 60;

/** No keys, no mouse: a step that just lets the world idle. */
const IDLE_INPUT = { move: { x: 0, y: 0 }, run: false, brake: false, actions: 0, aim: null, mouseDown: false, mousePressed: false };

/** A waypoint list the foot autopilot walks between, in order, looping. */
const FOOT_WAYPOINTS = [
  { x: 2000, y: 1350 },
  { x: 2000, y: 1650 },
  { x: 1700, y: 1650 },
  { x: 1700, y: 1350 },
];

/** Steer a car toward a point: -1..1, positive turning right. */
function steerToward(fromX, fromY, angle, toX, toY) {
  const want = Math.atan2(toY - fromY, toX - fromX);
  let diff = want - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return Math.max(-1, Math.min(1, diff * 2.2));
}

/**
 * Set `world` to the named scene (chase, start, foot or mission; any other name is start) and
 * return the screen to draw over it, the best cash to show, and the mission line for the
 * mission screen.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'chase' && name !== 'foot' && name !== 'mission') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, IDLE_INPUT, true);
    return { screen: SCREEN_TITLE, best: 0, missionLine: '' };
  }

  if (name === 'foot') {
    world.teleport(1700, 1350);
    let waypoint = 0;
    for (let index = 0; index < FOOT_SECONDS / STEP; index += 1) {
      const target = FOOT_WAYPOINTS[waypoint];
      const dx = target.x - state.player.x;
      const dy = target.y - state.player.y;
      const len = Math.hypot(dx, dy) || 1;
      if (len < 40) waypoint = (waypoint + 1) % FOOT_WAYPOINTS.length;
      world.step(STEP, { move: { x: dx / len, y: dy / len }, run: false, brake: false, actions: 0, aim: null, mouseDown: false, mousePressed: false }, false);
    }
    return { screen: SCREEN_PLAY, best: 0, missionLine: '' };
  }

  if (name === 'chase') {
    world.giveCar('sports', 1400, 1050, 0);
    world.setWanted(3);
    world.addPoliceCarNear();
    world.addPoliceCarNear();
    world.addPoliceCarNear();
    // A loop around downtown: brake into the corners so the car holds the road.
    const loop = [
      { x: 2300, y: 1050 },
      { x: 2300, y: 1650 },
      { x: 1400, y: 1650 },
      { x: 1400, y: 1050 },
    ];
    let waypoint = 0;
    for (let index = 0; index < CHASE_SECONDS / STEP; index += 1) {
      const car = state.player.car;
      const target = loop[waypoint];
      if (Math.hypot(target.x - car.x, target.y - car.y) < 150) waypoint = (waypoint + 1) % loop.length;
      const steer = steerToward(car.x, car.y, car.angle, target.x, target.y);
      const brake = Math.abs(steer) > 0.6 && Math.abs(car.speed) > 320;
      const events = world.step(STEP, { move: { x: steer, y: -1 }, run: false, brake, actions: 0, aim: null, mouseDown: false, mousePressed: false }, false);
      if (events & (EVENT_BUSTED | EVENT_WASTED)) break;
    }
    // The drive may have raised the heat by ramming a police car; the frame is a 3-star chase.
    world.setWanted(3);
    return { screen: SCREEN_PLAY, best: 0, missionLine: '' };
  }

  // mission: start the first main job, walk the player to its door, and let the real rules
  // complete it, so the frame shows the job-complete screen over a finished run.
  world.startMission('main');
  const target = state.mission.target;
  world.teleport(target.x, target.y + 420);
  let done = false;
  for (let index = 0; index < MISSION_LIMIT_SECONDS / STEP && !done; index += 1) {
    const dx = target.x - state.player.x;
    const dy = target.y - state.player.y;
    const len = Math.hypot(dx, dy) || 1;
    const events = world.step(STEP, { move: { x: dx / len, y: dy / len }, run: true, brake: false, actions: 0, aim: null, mouseDown: false, mousePressed: false }, false);
    if (events & EVENT_MISSION_DONE) done = true;
    if (events & (EVENT_BUSTED | EVENT_WASTED)) break;
  }
  const line = done ? `${state.doneMain.length > 0 ? 'Marina Delivery' : 'Job'} complete. +$500` : 'Marina Delivery';
  return { screen: SCREEN_MISSION, best: state.cash, missionLine: line };
}
