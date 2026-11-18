// SOLARA BAY entry point: boot, fixed-step loop, screen switching,
// save/load, and ?shot= staging.
import { CFG } from './config.js';
import { Input } from './input.js';
import { makeWorld } from './world.js';
import { drawWorld, drawHUD, drawScreen } from './render.js';
import { SoundBank } from './audio.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const seed = Number(params.get('seed') || '7') || 7;

const world = makeWorld(seed);
const input = new Input(canvas);
const audio = new SoundBank();
const SAVE_KEY = 'solara-bay-save-v1';

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const s = JSON.parse(raw);
    world.state.bestCash = s.bestCash || 0;
    world.state.missionsDone = s.missionsDone || 0;
    world.player.money = s.money ?? CFG.moneyStart;
  } catch { /* corrupted save: start fresh */ }
}
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      bestCash: Math.max(world.state.bestCash, world.player.money),
      missionsDone: world.state.missionsDone,
      money: world.player.money,
    }));
  } catch { /* storage unavailable */ }
}
loadSave();

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = world.state.screen;
  if (s === 'title') { drawWorld(ctx, world); drawScreen(ctx, world, 'title'); }
  else if (s === 'paused') { drawWorld(ctx, world); drawHUD(ctx, world); drawScreen(ctx, world, 'paused'); }
  else if (s === 'busted' || s === 'wasted') { drawWorld(ctx, world); drawScreen(ctx, world, s); }
  else if (s === 'complete') { drawWorld(ctx, world); drawHUD(ctx, world); drawScreen(ctx, world, 'complete'); }
  else { drawWorld(ctx, world); drawHUD(ctx, world); }
  if (statusEl) statusEl.textContent = 'SOLARA BAY — ' + s.toUpperCase() + '  •  $' + world.player.money + '  •  ' + world.state.wanted + '★';
}

function handleScreens() {
  const s = world.state.screen;
  if (s === 'title' && (input.hit('Enter') || input.mouseClicked)) {
    world.state.screen = 'play'; audio.ensure(); audio.mission();
  } else if (s === 'play' && (input.hit('KeyP') || input.hit('Escape'))) {
    world.state.screen = 'paused';
  } else if (s === 'paused' && (input.hit('KeyP') || input.hit('Escape'))) {
    world.state.screen = 'play';
  } else if (s === 'paused' && input.hit('KeyR')) {
    world.resetRun(); saveGame();
  } else if ((s === 'busted' || s === 'wasted') && input.hit('Enter')) {
    audio.busted(); world.resetRun(); saveGame();
  } else if (s === 'complete' && input.hit('Enter')) {
    world.state.screen = 'play'; saveGame();
  }
  if (input.hit('KeyM')) {
    const muted = audio.toggleMute();
    world.setToast(muted ? 'Sound muted (M to unmute).' : 'Sound on.', 1.5);
  }
}

// shot mode: stage the scene and stop — no live loop needed
if (runShot(world, draw, audio)) {
  // staged; the page stays on the posed frame for the screenshot
} else {
  let last = performance.now(), acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= CFG.step) {
      acc -= CFG.step;
      handleScreens();
      if (world.state.screen === 'play') {
        world.step(CFG.step, input, audio);
        audio.engine(world.player.inCar ? Math.abs(world.player.inCar.speed) / 430 : 0);
        audio.siren(world.state.wanted > 0);
      } else {
        audio.stopEngine(); audio.siren(false);
      }
      input.endStep();
      if (world.state.screen === 'busted' || world.state.screen === 'wasted') saveGame();
    }
    draw();
  }
  requestAnimationFrame(frame);
}
window.__solara = world;
