/**
 * Landing page interactions (index.html only, not part of the app bundle):
 *  - the animated test run in the hero,
 *  - the three "try it right now" mini-challenges,
 *  - "Start practicing" links pointing at the dashboard for signed-in visitors.
 * All content is already in the HTML, so the page reads fine without this script.
 */

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<T>(sel));

// ---------------------------------------------------------------- Test run ---

/**
 * Plays the fake `npx playwright test` output: each step shows a spinner while it
 * "runs", then turns into a green ✓ with its time; the summary line comes last.
 * Styles are set inline (not via utility classes) so the effect never depends on
 * which classes the stylesheet happens to contain. Reduced motion only drops the fade.
 */
function setupTestRun() {
  const panel = $('[data-testid="landing-test-run"]');
  const lines = $$('[data-run-lines] > li');
  const again = $<HTMLButtonElement>('[data-run-again]');
  if (!panel || lines.length < 2 || !again) return;

  const steps = lines.slice(0, -1);
  const summary = lines[lines.length - 1];
  // How long each step "runs" (ms), roughly in proportion to the time it reports.
  const durations = [650, 350, 1500, 700];
  const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let timers: number[] = [];
  let spinner = 0; // the one spinner interval running at a time

  const at = (ms: number, fn: () => void) => timers.push(window.setTimeout(fn, ms));
  const show = (el: HTMLElement) => {
    el.style.visibility = 'visible';
    if (!reducedMotion) {
      el.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }], {
        duration: 200,
        easing: 'ease-out',
      });
    }
  };
  const parts = (li: HTMLElement) => {
    const spans = li.querySelectorAll<HTMLElement>(':scope > span');
    return { mark: spans[0], time: spans[spans.length - 1] };
  };

  const reset = () => {
    timers.forEach((t) => clearTimeout(t));
    timers = [];
    clearInterval(spinner);
    again.style.display = 'none';
    for (const li of lines) li.style.visibility = 'hidden';
    // A child with visibility: visible stays visible inside a hidden parent, so each
    // step's time must be hidden too; it reappears only when that step passes.
    for (const li of steps) parts(li).time.style.visibility = 'hidden';
  };

  const run = () => {
    reset();
    panel.dataset.state = 'running';
    let t = 350;
    steps.forEach((li, i) => {
      const { mark, time } = parts(li);
      at(t, () => {
        let frame = 0;
        mark.textContent = SPINNER[0];
        mark.style.color = '#94a3b8';
        time.style.visibility = 'hidden';
        show(li);
        clearInterval(spinner);
        spinner = window.setInterval(() => {
          frame = (frame + 1) % SPINNER.length;
          mark.textContent = SPINNER[frame];
        }, 80);
      });
      t += durations[i] ?? 500;
      at(t, () => {
        clearInterval(spinner);
        mark.textContent = '✓';
        mark.style.color = '';
        time.style.visibility = 'visible';
      });
    });
    at(t + 250, () => {
      show(summary);
      panel.dataset.state = 'done';
    });
    at(t + 700, () => {
      again.style.display = '';
      again.classList.remove('hidden');
    });
  };

  again.addEventListener('click', run);
  // Start when the panel first comes on screen. Hide the results until then, so
  // the run plays from the start instead of flashing the finished output.
  reset();
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      io.disconnect();
      run();
    }
  });
  io.observe(panel);
}

// --------------------------------------------------------- Mini-challenges ---

function setupChallenges() {
  const countEl = $('[data-try-count]');
  const done = $('[data-try-done]');
  const timeEl = $('[data-try-time]');
  const solved = new Set<string>();
  let startedAt = 0;

  const touch = () => {
    if (!startedAt) startedAt = performance.now();
  };

  const solve = (name: string) => {
    if (solved.has(name)) return;
    solved.add(name);
    const card = $(`[data-try-card="${name}"]`);
    if (card) {
      card.dataset.solved = 'true';
      card.classList.add('ring-2', 'ring-emerald-400');
      const status = $('[data-try-status]', card);
      if (status) {
        status.textContent = 'Solved ✓';
        status.className = 'tag bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300';
      }
      $('[data-try-hint]', card)?.classList.remove('hidden');
    }
    if (countEl) countEl.textContent = String(solved.size);
    if (solved.size === 3 && done) {
      const seconds = startedAt ? Math.max(1, Math.round((performance.now() - startedAt) / 1000)) : 0;
      if (timeEl && seconds) timeEl.textContent = ` in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
      done.classList.remove('hidden');
      done.classList.add('flex');
    }
  };

  // 1. Runaway button: dodges the pointer a few times, then gives up.
  const arena = $('[data-runaway-arena]');
  const runaway = $<HTMLButtonElement>('[data-runaway]');
  if (arena && runaway) {
    let dodges = 0;
    const MOUSE_DODGES = 6;
    const TOUCH_DODGES = 3;
    const dodge = () => {
      dodges++;
      const pad = 8;
      const maxX = arena.clientWidth - runaway.offsetWidth - pad * 2;
      const maxY = arena.clientHeight - runaway.offsetHeight - pad * 2;
      // Positions are of the button's centre (it is translated by -50%).
      const x = pad + Math.random() * Math.max(0, maxX) + runaway.offsetWidth / 2;
      const y = pad + Math.random() * Math.max(0, maxY) + runaway.offsetHeight / 2;
      runaway.style.left = `${x}px`;
      runaway.style.top = `${y}px`;
    };
    // Mouse: dodge on approach. Touch/pen: dodge the first few taps (there is no hover).
    runaway.addEventListener('pointerenter', (e) => {
      touch();
      if (e.pointerType !== 'mouse' || dodges >= MOUSE_DODGES || solved.has('runaway')) return;
      dodge();
      if (dodges === MOUSE_DODGES) runaway.textContent = 'Fine, click me';
    });
    // A touch browser still sends the tap's click to the button after it moves, so
    // swallow the click that belongs to a tap the button just dodged.
    let dodgedTapAt = -Infinity;
    runaway.addEventListener('pointerdown', (e) => {
      touch();
      if (e.pointerType === 'mouse' || dodges >= TOUCH_DODGES || solved.has('runaway')) return;
      dodge();
      dodgedTapAt = performance.now();
      if (dodges === TOUCH_DODGES) runaway.textContent = 'Fine, tap me';
    });
    runaway.addEventListener('click', () => {
      touch();
      if (performance.now() - dodgedTapAt < 800) return;
      runaway.textContent = 'Caught!';
      solve('runaway');
    });
  }

  // 2. Iframe: the button is in a same-origin srcdoc frame, so we can listen to it
  //    directly. The frame may finish loading before or after this script runs.
  const frame = $<HTMLIFrameElement>('[data-try-frame]');
  if (frame) {
    let bound = false;
    const bind = () => {
      const btn = frame.contentDocument?.querySelector<HTMLButtonElement>('button');
      if (bound || !btn) return;
      bound = true;
      btn.addEventListener('click', () => {
        touch();
        btn.textContent = 'Got out ✓';
        btn.disabled = true;
        solve('frame');
      });
    };
    frame.addEventListener('load', bind);
    bind();
  }

  // 3. Shadow DOM: the button is rendered by declarative shadow DOM in the HTML.
  const host = $('try-shadow');
  if (host) {
    // Older browsers without declarative shadow DOM: attach the root from the template.
    if (!host.shadowRoot) {
      const tpl = $<HTMLTemplateElement>('template', host);
      if (tpl) host.attachShadow({ mode: 'open' }).appendChild(tpl.content.cloneNode(true));
    }
    const btn = host.shadowRoot?.querySelector<HTMLButtonElement>('button');
    btn?.addEventListener('click', () => {
      touch();
      btn.textContent = 'Found it ✓';
      solve('shadow');
    });
  }
}

// ------------------------------------------------------------ Start CTA ---

/** "Start practicing" goes to sign-in, or straight to the dashboard when already signed in. */
function setupStartLinks() {
  try {
    const auth = JSON.parse(localStorage.getItem('testdesk-auth') || '{}').state || {};
    if (!auth.isAuthenticated) return;
    $$<HTMLAnchorElement>('a[data-cta]').forEach((a) => (a.href = '/dashboard'));
  } catch {
    // Storage blocked or unreadable: keep the sign-in links.
  }
}

/** Keep the page in step if the system switches between light and dark while it is open. */
function followSystemTheme() {
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const apply = () => document.documentElement.classList.toggle('dark', query.matches);
  apply();
  query.addEventListener('change', apply);
}

followSystemTheme();
setupStartLinks();
setupTestRun();
setupChallenges();
