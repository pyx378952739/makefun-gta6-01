// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between six screens: title, play, paused, busted, wasted and mission complete.
//
// ?seed=N fixes the city and the traffic. ?shot=chase|start|foot|mission (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, PROGRESS_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_CRASH, EVENT_HIT_PED, EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_PUNCH, EVENT_SHOT, EVENT_STEAL, EVENT_WASTED } from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_JOB, ACTION_MUTE, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_MISSION, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WASTED } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;
/** How long the job-complete screen stays up before play resumes on its own. */
const MISSION_SCREEN_SECONDS = 2.5;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function readProgress() {
  try {
    return JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? 'null') || null;
  } catch {
    return null;
  }
}

function saveProgress(best) {
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify({
      cash: world.state.cash,
      rep: world.state.rep,
      doneMain: world.state.doneMain,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  const ui = { clock: world.clockText(), muted: false, aim: null, missionLine: scene.missionLine };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, ui);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const progress = readProgress();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let missionLine = '';
  let missionTimer = 0;
  let muted = false;
  let accumulator = 0;
  let last = performance.now();

  if (progress !== null) {
    world.state.cash = progress.cash || 0;
    world.state.rep = progress.rep || 0;
    world.state.doneMain = progress.doneMain || [];
    world.state.nextMain = world.state.doneMain.length;
  }

  // Screen readers (and anyone watching the page's text) hear the screen changes and the big events.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    if (progress !== null) {
      world.state.cash = progress.cash || 0;
      world.state.rep = progress.rep || 0;
      world.state.doneMain = progress.doneMain || [];
      world.state.nextMain = world.state.doneMain.length;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Explore Solara Bay: walk, drive, take jobs, watch the heat.');
  }

  function endRun(nextScreen, message) {
    screen = nextScreen;
    if (world.state.cash > best) best = world.state.cash;
    saveProgress(best);
    announce(message);
  }

  function handleEvents(events) {
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_STEAL) audio.pickup();
    if (events & EVENT_HIT_PED) announce('Someone was hurt. The heat rises.');
    if (events & EVENT_MISSION_DONE) {
      missionLine = world.state.toast || 'Job complete.';
      missionTimer = MISSION_SCREEN_SECONDS;
      screen = SCREEN_MISSION;
      audio.mission();
      if (world.state.cash > best) best = world.state.cash;
      saveProgress(best);
      announce(missionLine);
    }
    if (events & EVENT_MISSION_FAIL) {
      audio.fail();
      announce('Job failed: out of time.');
    }
    if (events & EVENT_BUSTED) {
      audio.fail();
      endRun(SCREEN_BUSTED, `Busted. Cash kept: $${world.state.cash}. Best $${best}.`);
    }
    if (events & EVENT_WASTED) {
      audio.fail();
      endRun(SCREEN_WASTED, `Wasted. Cash kept: $${world.state.cash}. Best $${best}.`);
    }
  }

  function step() {
    const mouse = lastMouse;
    const aim = mouse === null ? null : renderer.screenToWorld(mouse.x, mouse.y);
    const gameActions = pendingActions;
    pendingActions = 0;
    const inputState = {
      move: input.move(),
      run: input.run(),
      brake: input.brake(),
      actions: gameActions,
      aim,
      mouseDown: mouse !== null && mouse.down,
      mousePressed: mouse !== null && mouse.pressed,
    };
    const events = world.step(STEP, inputState, screen === SCREEN_TITLE);
    handleEvents(events);
  }

  let pendingActions = 0;
  let lastMouse = null;

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_BUSTED || screen === SCREEN_WASTED) {
      if ((actions & ACTION_CONFIRM) || (lastMouse !== null && lastMouse.pressed)) {
        audio.unlock();
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_MISSION) {
      if (actions & ACTION_CONFIRM || (lastMouse !== null && lastMouse.pressed)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
    pendingActions = actions & (ACTION_INTERACT | ACTION_JOB | ACTION_PUNCH);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    accumulator += dt;
    lastMouse = input.mouse();
    handleActions();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { move: { x: 0, y: 0 }, run: false, brake: false, actions: 0, aim: null, mouseDown: false, mousePressed: false }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_MISSION) {
      missionTimer -= dt;
      if (missionTimer <= 0) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
    } else {
      accumulator = 0;
    }
    // Sound follows the world: engine hum with the car, siren while wanted.
    const car = world.state.player.car;
    audio.engine(screen === SCREEN_PLAY && car !== null ? Math.abs(car.speed) / 690 : 0);
    audio.siren(screen === SCREEN_PLAY && world.state.wanted > 0);
    renderer.draw(world.state, screen, best, {
      clock: world.clockText(),
      muted,
      aim: lastMouse === null ? null : renderer.screenToWorld(lastMouse.x, lastMouse.y),
      missionLine,
    });
  }

  // Leaving the tab pauses a running game rather than letting the city move unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // Browsers block audio before a gesture: unlock on the first key or click.
  window.addEventListener('keydown', () => audio.unlock());
  window.addEventListener('pointerdown', () => audio.unlock());

  announce('Solara Bay. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
