import { OceanEngine } from '../vendor/ascii-sharks/src/engine';

const canvas = document.querySelector<HTMLCanvasElement>('#ascii-ocean');
const toggle = document.querySelector<HTMLButtonElement>('#ocean-toggle');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let engine: OceanEngine | null = null;
let paused = false;

function update() {
  if (!canvas || !toggle) return;
  if (paused || document.hidden) {
    engine?.destroy();
    engine = null;
  } else if (!engine) {
    try {
      engine = new OceanEngine(canvas, [{kind:'hammerhead', size:1}, {kind:'mako', size:.72}]);
      canvas.dataset.ready = 'true';
      toggle.hidden = false;
    } catch {
      toggle.hidden = true;
      return;
    }
  }
  canvas.dataset.motion = paused || document.hidden ? 'paused' : motion.matches ? 'still' : 'running';
  toggle.disabled = motion.matches;
  toggle.textContent = motion.matches ? 'Still scene' : paused ? 'Resume motion' : 'Pause motion';
  toggle.setAttribute('aria-pressed', String(paused));
}

if (canvas && toggle) {
  toggle.addEventListener('click', () => { paused = !paused; update(); });
  motion.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  window.addEventListener('pagehide', () => { engine?.destroy(); engine = null; });
  window.addEventListener('pageshow', update);
  update();
}
