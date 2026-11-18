// Keyboard and pointer input. Held keys give a movement direction; one-shot presses (start,
// pause, enter a car, take a job, mute) are queued as bit flags and taken once by the loop, so a
// press between two frames is never lost and never counted twice. The mouse aims and fires.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_JOB = 8;
export const ACTION_MUTE = 16;
export const ACTION_PUNCH = 32;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const RUN = new Set(['ShiftLeft', 'ShiftRight']);
const BRAKE = new Set(['Space']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const INTERACT = new Set(['KeyE']);
const JOB = new Set(['KeyT']);
const MUTE = new Set(['KeyM']);
const PUNCH = new Set(['KeyF']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mousePressed = false;

  function press(code, event) {
    if (UP.has(code) || DOWN.has(code) || LEFT.has(code) || RIGHT.has(code) || RUN.has(code) || BRAKE.has(code)) {
      held.add(code);
    } else if (CONFIRM.has(code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (INTERACT.has(code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (JOB.has(code)) {
      if (!event.repeat) actions |= ACTION_JOB;
    } else if (MUTE.has(code)) {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (PUNCH.has(code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else {
      return;
    }
    event.preventDefault();
  }

  window.addEventListener('keydown', (event) => press(event.code, event));
  window.addEventListener('keyup', (event) => held.delete(event.code));
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    held.clear();
    mouseDown = false;
  });
  // The canvas backing store is device pixels while pointer events report CSS pixels:
  // scale the pointer into the same space the renderer uses for screenToWorld.
  function toCanvas(event) {
    const rect = target.getBoundingClientRect();
    const scale = rect.width > 0 ? target.width / rect.width : 1;
    return { x: (event.clientX - rect.left) * scale, y: (event.clientY - rect.top) * scale };
  }
  target.addEventListener('pointerdown', (event) => {
    const pos = toCanvas(event);
    mouseX = pos.x;
    mouseY = pos.y;
    mouseDown = true;
    mousePressed = true;
  });
  target.addEventListener('pointermove', (event) => {
    const pos = toCanvas(event);
    mouseX = pos.x;
    mouseY = pos.y;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** Movement vector, -1..1 on each axis, from WASD or the arrow keys. */
    move() {
      const x = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      const y = (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0);
      return { x, y };
    },
    run: () => has(RUN),
    brake: () => has(BRAKE),
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** The mouse position in canvas pixels, and whether the button is held or was just pressed. */
    mouse() {
      const pressed = mousePressed;
      mousePressed = false;
      return { x: mouseX, y: mouseY, down: mouseDown, pressed };
    },
  };
}
