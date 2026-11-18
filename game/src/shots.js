// Staged shots for ?shot= : drive the real rules forward a fixed number of
// steps to pose each scene, draw twice, then flag window.__shotReady.
// Shots (must match shots.json): chase, start, foot, mission.
import { CFG } from './config.js';

function fakeInput() {
  return {
    keys: new Set(), pressed: new Set(),
    down: () => false, hit: () => false,
    axis: () => ({ x: 0, y: 0 }), running: false,
    mouseX: 640, mouseY: 300, mouseDown: false, mouseClicked: false,
    endStep() {},
  };
}
function driveForward(world, steps, input, audio) {
  const dt = CFG.step;
  for (let i = 0; i < steps; i++) world.step(dt, input, audio);
}

export function runShot(world, draw, audio) {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  if (!shot) return false;
  const input = fakeInput();
  const silent = { pickup() {}, shoot() {}, punch() {}, crash() {}, steal() {}, mission() {}, busted() {}, engine() {}, stopEngine() {}, siren() {} };
  world.state.screen = 'play';
  if (shot === 'start') {
    world.state.screen = 'title';
  } else if (shot === 'foot') {
    // on foot downtown, pedestrians + traffic around
    world.player.x = 620; world.player.y = 200;
    world.player.angle = Math.PI / 2;
    driveForward(world, 60 * 4, input, silent);
    world.state.screen = 'play';
  } else if (shot === 'chase') {
    // 3-star chase in a stolen car, cops behind, minimap + mission marker live
    const car = world.cars.find((c) => c.parked) || world.cars[0];
    world.player.inCar = car; car.parked = false; car.traffic = false; car.driver = false;
    world.player.x = car.x; world.player.y = car.y;
    car.speed = 260;
    world.addWanted(3, 'shot');
    world.startMission(0);
    world.state.screen = 'play';
    driveForward(world, 60 * 3, input, silent);
    world.state.screen = 'play';
    // keep the chase readable: hold wanted at 3 and the player in the car
    world.state.wanted = 3;
  } else if (shot === 'mission') {
    world.startMission(0);
    const m = world.state.mission;
    m.pickedUp = true; world.state.missionStage = 'deliver';
    world.player.x = m.to.x; world.player.y = m.to.y + 10;
    world.state.screen = 'play';
    driveForward(world, 2, input, silent);
    // completing the mission flips the screen to 'complete'
    world.state.screen = 'complete';
  }
  // two draws, then signal readiness
  draw(); draw();
  window.__shotReady = true;
  return true;
}
