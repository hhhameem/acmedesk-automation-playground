/**
 * Reads the state of a native control (or a group of them) for the Element Lab readout.
 * Reading never fires events: it uses `validity`, not `checkValidity()`.
 */

export interface Snapshot {
  value: string;
  /** null when the browser does not validate the element (disabled, read-only, not a form control). */
  valid: boolean | null;
  flags: string[];
  message: string;
}

export const EMPTY_SNAPSHOT: Snapshot = { value: '', valid: null, flags: [], message: '' };

/** Events the readout logs. Listened to in the capture phase so non-bubbling ones are seen too. */
export const LOGGED_EVENTS = [
  'input',
  'change',
  'focusin',
  'focusout',
  'invalid',
  'click',
  'toggle',
  'close',
  'cancel',
  'submit',
  'reset',
] as const;

/** Dispatch this (bubbling) from inside a specimen after changing it with JavaScript. */
export const REFRESH_EVENT = 'elementlab:refresh';

const FLAGS = [
  'valueMissing',
  'typeMismatch',
  'patternMismatch',
  'tooLong',
  'tooShort',
  'rangeUnderflow',
  'rangeOverflow',
  'stepMismatch',
  'badInput',
  'customError',
] as const;

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement | HTMLOutputElement;

const CONTROL_SELECTOR = 'input, select, textarea';

function isControl(el: Element): el is Control {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLButtonElement ||
    el instanceof HTMLOutputElement
  );
}

function validated(el: Element): el is Control {
  return isControl(el) && el.willValidate;
}

function flagsOf(el: Control): string[] {
  return FLAGS.filter((f) => el.validity[f]);
}

function validityOf(controls: Element[]): Pick<Snapshot, 'valid' | 'flags' | 'message'> {
  const checked = controls.filter(validated);
  if (checked.length === 0) return { valid: null, flags: [], message: '' };
  const bad = checked.find((c) => !c.validity.valid);
  return bad
    ? { valid: false, flags: flagsOf(bad), message: bad.validationMessage }
    : { valid: true, flags: [], message: '' };
}

/** Serializes form data as `name=value; …`, with file names in place of files. */
export function serializeFormData(data: FormData): string {
  return Array.from(data.entries())
    .map(([k, v]) => `${k}=${typeof v === 'string' ? v : v.name}`)
    .join('; ');
}

function controlValue(el: Element): string {
  if (el instanceof HTMLInputElement) {
    if (el.type === 'checkbox' || el.type === 'radio') {
      return el.indeterminate ? 'indeterminate' : el.checked ? 'checked' : 'unchecked';
    }
    if (el.type === 'file') return Array.from(el.files ?? []).map((f) => f.name).join(', ');
    return el.value;
  }
  if (el instanceof HTMLSelectElement) {
    return el.multiple ? Array.from(el.selectedOptions).map((o) => o.value).join(', ') : el.value;
  }
  if (isControl(el)) return el.value;
  return '';
}

/** Value of a group: the checked radio, the ticked checkboxes, or `name=value` pairs. */
function groupValue(controls: Element[]): string {
  const inputs = controls.filter((c): c is HTMLInputElement => c instanceof HTMLInputElement);
  if (inputs.length > 0 && inputs.length === controls.length) {
    if (inputs.every((i) => i.type === 'radio')) return inputs.find((i) => i.checked)?.value ?? '';
    if (inputs.every((i) => i.type === 'checkbox')) {
      return inputs.filter((i) => i.checked).map((i) => i.value).join(', ');
    }
  }
  return controls
    .filter(isControl)
    .map((c) => `${c.name || c.id}=${controlValue(c)}`)
    .join('; ');
}

export function readSnapshot(el: HTMLElement): Snapshot {
  // A specimen can state its own value (e.g. a click counter on a button).
  const own = el.getAttribute('data-probe-value');

  if (el instanceof HTMLFormElement) {
    return { value: own ?? serializeFormData(new FormData(el)), ...validityOf(Array.from(el.elements)) };
  }
  if (isControl(el)) {
    return { value: own ?? controlValue(el), ...validityOf([el]) };
  }
  if (el instanceof HTMLProgressElement) {
    return { ...EMPTY_SNAPSHOT, value: own ?? (el.position === -1 ? 'indeterminate' : `${el.value}/${el.max}`) };
  }
  if (el instanceof HTMLMeterElement) {
    return { ...EMPTY_SNAPSHOT, value: own ?? String(el.value) };
  }
  if (el instanceof HTMLDetailsElement) {
    return { ...EMPTY_SNAPSHOT, value: own ?? (el.open ? 'open' : 'closed') };
  }
  if (el instanceof HTMLDialogElement) {
    return { ...EMPTY_SNAPSHOT, value: own ?? `${el.open ? 'open' : 'closed'}; returnValue=${el.returnValue}` };
  }
  if (el.isContentEditable) {
    return { ...EMPTY_SNAPSHOT, value: own ?? el.textContent ?? '' };
  }

  // A container: fieldset, radio group, a set of <details>…
  const controls = Array.from(el.querySelectorAll(CONTROL_SELECTOR));
  if (controls.length > 0) return { value: own ?? groupValue(controls), ...validityOf(controls) };
  const details = Array.from(el.querySelectorAll('details'));
  if (details.length > 0) {
    return { ...EMPTY_SNAPSHOT, value: own ?? details.filter((d) => d.open).map((d) => d.id).join(', ') };
  }
  return { ...EMPTY_SNAPSHOT, value: own ?? '' };
}

/** The first validated control in an element (or the element itself), for "Check validity". */
export function validationTarget(el: HTMLElement): HTMLFormElement | Control | null {
  if (el instanceof HTMLFormElement || validated(el)) return el;
  return (Array.from(el.querySelectorAll(CONTROL_SELECTOR)).find(validated) as Control | undefined) ?? null;
}

function nameOf(target: EventTarget | null): string {
  if (!(target instanceof Element)) return '';
  const name = target.getAttribute('name') || target.getAttribute('data-testid');
  return target.id || name || target.tagName.toLowerCase();
}

function clip(text: string, max = 28): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

const CLICK_LOGGED = 'button, summary, input[type="button"], input[type="submit"], input[type="reset"], input[type="image"]';

/** A short log line for an event, or null when it is not worth logging (e.g. a click on plain text). */
export function describeEvent(e: Event): { type: string; text: string } | null {
  const type = e.type === 'focusin' ? 'focus' : e.type === 'focusout' ? 'blur' : e.type;
  const target = e.target;

  if (e.type === 'click') {
    if (!(target instanceof Element) || !target.closest(CLICK_LOGGED)) return null;
    const el = target.closest(CLICK_LOGGED)!;
    if (el instanceof HTMLInputElement && el.type === 'image' && e instanceof MouseEvent) {
      return { type, text: `click ${nameOf(el)} (${Math.round(e.offsetX)}, ${Math.round(e.offsetY)})` };
    }
    return { type, text: `click ${nameOf(el)}` };
  }

  if ((e.type === 'input' || e.type === 'change') && target instanceof Element) {
    const value = target instanceof HTMLElement && target.isContentEditable ? target.textContent ?? '' : controlValue(target);
    return { type, text: `${type} ${nameOf(target)} = "${clip(value)}"` };
  }

  if (e.type === 'submit' && e instanceof SubmitEvent) {
    return { type, text: e.submitter ? `submit by ${nameOf(e.submitter)}` : 'submit' };
  }

  return { type, text: `${type} ${nameOf(target)}` };
}
