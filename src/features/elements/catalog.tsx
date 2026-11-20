import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import type { Locale } from '@/store/ui';
import { REFRESH_EVENT } from './probe';
import type { ElKey, ElT } from './strings';

/**
 * Every element in the Element Lab and its variants. Each variant renders one control
 * whose id and data-testid are both `el-<slug>-<variant key>` (the `id` passed in).
 * Helper parts of a variant use that id plus a suffix, e.g. `el-dialog-modal-open`.
 */

export interface SpecimenProps {
  id: string;
  t: ElT;
  locale: Locale;
}

export interface Variant {
  key: string;
  label: ElKey;
  hint?: ElKey;
  /** The variant renders its own <form> (or must not be inside one), so no wrapper form is added. */
  ownForm?: boolean;
  render: ComponentType<SpecimenProps>;
}

export type GroupKey = 'text' | 'datetime' | 'choice' | 'range' | 'files' | 'buttons' | 'structure' | 'validation';

export interface ElementSpec {
  slug: string;
  group: GroupKey;
  /** The markup it demonstrates, shown as the page title. */
  code: string;
  desc: ElKey;
  variants: Variant[];
}

export const GROUPS: { key: GroupKey; label: ElKey }[] = [
  { key: 'text', label: 'g.text' },
  { key: 'datetime', label: 'g.datetime' },
  { key: 'choice', label: 'g.choice' },
  { key: 'range', label: 'g.range' },
  { key: 'files', label: 'g.files' },
  { key: 'buttons', label: 'g.buttons' },
  { key: 'structure', label: 'g.structure' },
  { key: 'validation', label: 'g.validation' },
];

// ---------------------------------------------------------------------------
// Building blocks

const LABEL = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-200';
const BOX = 'h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600';
const HELP = 'text-xs text-slate-500 dark:text-slate-400';

function refresh(el: Element | null) {
  el?.dispatchEvent(new Event(REFRESH_EVENT, { bubbles: true }));
}

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      {children}
    </div>
  );
}

/** A form field name from a label key: 'f.fullName' → 'fullName'. */
function nameOf(key: ElKey): string {
  return key.slice(key.indexOf('.') + 1);
}

type Attrs = InputHTMLAttributes<HTMLInputElement>;

/** A labelled <input> variant. `attrs` may depend on the language (placeholders). */
function input(
  key: string,
  label: ElKey,
  field: ElKey,
  attrs: Attrs | ((t: ElT) => Attrs),
  hint?: ElKey,
): Variant {
  return {
    key,
    label,
    hint,
    render: ({ id, t }) => {
      const a = typeof attrs === 'function' ? attrs(t) : attrs;
      const box = a.type === 'checkbox' || a.type === 'radio';
      if (box) {
        return (
          <div className="flex items-center gap-2">
            <input id={id} data-testid={id} name={nameOf(field)} value="yes" className={BOX} {...a} />
            <label htmlFor={id} className="text-sm text-slate-700 dark:text-slate-200">
              {t(field)}
            </label>
          </div>
        );
      }
      return (
        <Field id={id} label={t(field)}>
          <input id={id} data-testid={id} name={nameOf(field)} className="input" {...a} />
        </Field>
      );
    },
  };
}

function Options({ t, keys }: { t: ElT; keys: { value: string; label: ElKey; disabled?: boolean }[] }) {
  return (
    <>
      {keys.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {t(o.label)}
        </option>
      ))}
    </>
  );
}

const PRIORITIES: { value: string; label: ElKey }[] = [
  { value: 'low', label: 'opt.low' },
  { value: 'medium', label: 'opt.medium' },
  { value: 'high', label: 'opt.high' },
  { value: 'urgent', label: 'opt.urgent' },
];

const CATEGORIES: { value: string; label: ElKey }[] = [
  { value: 'billing', label: 'opt.billing' },
  { value: 'technical', label: 'opt.technical' },
  { value: 'account', label: 'opt.account' },
  { value: 'shipping', label: 'opt.shipping' },
  { value: 'returns', label: 'opt.returns' },
  { value: 'feedback', label: 'opt.feedback' },
];

const REGIONS: { label: ElKey; codes: string[] }[] = [
  { label: 'opt.europe', codes: ['DE', 'FR', 'NL'] },
  { label: 'opt.asia', codes: ['BD', 'IN', 'JP'] },
  { label: 'opt.americas', codes: ['BR', 'CA', 'US'] },
];

/** Country names in the page language; the option values stay ISO codes. */
function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

// ---------------------------------------------------------------------------
// Variants with their own behavior

function PasswordToggle({ id, t }: SpecimenProps) {
  const [shown, setShown] = useState(false);
  return (
    <Field id={id} label={t('f.password')}>
      <div className="flex gap-2">
        <input
          id={id}
          data-testid={id}
          name="password"
          type={shown ? 'text' : 'password'}
          autoComplete="current-password"
          className="input"
        />
        <button
          type="button"
          className="btn-secondary shrink-0"
          aria-pressed={shown}
          aria-controls={id}
          data-testid={`${id}-toggle`}
          onClick={() => setShown((s) => !s)}
        >
          {t(shown ? 'b.hide' : 'b.show')}
        </button>
      </div>
    </Field>
  );
}

function TextareaCounter({ id, t }: SpecimenProps) {
  const [count, setCount] = useState(0);
  return (
    <Field id={id} label={t('f.message')}>
      <textarea
        id={id}
        data-testid={id}
        name="message"
        rows={3}
        maxLength={140}
        className="input"
        aria-describedby={`${id}-count`}
        onInput={(e) => setCount(e.currentTarget.value.length)}
      />
      <p id={`${id}-count`} className={`mt-1 ${HELP}`} data-testid={`${id}-count`} aria-live="polite">
        {t('c.chars', { n: count })}
      </p>
    </Field>
  );
}

function HiddenDemo({ id, t }: SpecimenProps) {
  const ref = useRef<HTMLInputElement>(null);
  const n = useRef(1);
  return (
    <div className="space-y-2">
      <input ref={ref} type="hidden" id={id} data-testid={id} name="token" defaultValue="token-1" />
      <button
        type="button"
        className="btn-secondary"
        data-testid={`${id}-change`}
        onClick={() => {
          n.current += 1;
          if (ref.current) ref.current.value = `token-${n.current}`;
          refresh(ref.current);
        }}
      >
        {t('b.changeHidden')}
      </button>
    </div>
  );
}

function SelectAllDemo({ id, t }: SpecimenProps) {
  const [items, setItems] = useState({ email: true, sms: false, push: false });
  const parent = useRef<HTMLInputElement>(null);
  const count = Object.values(items).filter(Boolean).length;
  const all = count === 3;

  // `indeterminate` exists only as a property; there is no HTML attribute for it.
  useLayoutEffect(() => {
    if (!parent.current) return;
    parent.current.indeterminate = count > 0 && count < 3;
    refresh(parent.current);
  }, [count]);

  const children: { key: keyof typeof items; label: ElKey }[] = [
    { key: 'email', label: 'f.alertEmail' },
    { key: 'sms', label: 'f.alertSms' },
    { key: 'push', label: 'f.alertPush' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <input
          ref={parent}
          type="checkbox"
          id={id}
          data-testid={id}
          name="all"
          className={BOX}
          checked={all}
          onChange={(e) => {
            const on = e.currentTarget.checked;
            setItems({ email: on, sms: on, push: on });
          }}
        />
        <label htmlFor={id} className="text-sm font-medium text-slate-700 dark:text-slate-200">
          {t('f.selectAll')}
        </label>
      </div>
      <div className="space-y-1.5 ps-6">
        {children.map((c) => (
          <div key={c.key} className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`${id}-${c.key}`}
              data-testid={`${id}-${c.key}`}
              name="alerts"
              value={c.key}
              className={BOX}
              checked={items[c.key]}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setItems((prev) => ({ ...prev, [c.key]: on }));
              }}
            />
            <label htmlFor={`${id}-${c.key}`} className="text-sm text-slate-700 dark:text-slate-200">
              {t(c.label)}
            </label>
          </div>
        ))}
      </div>
    </div>
  );
}

function radioGroup(opts: { preset?: string; required?: boolean; disabled?: string }) {
  return function RadioGroup({ id, t }: SpecimenProps) {
    const plans: { value: string; label: ElKey }[] = [
      { value: 'free', label: 'opt.free' },
      { value: 'pro', label: 'opt.pro' },
      { value: 'team', label: 'opt.team' },
    ];
    return (
      <fieldset id={id} data-testid={id}>
        <legend className={LABEL}>{t('f.plan')}</legend>
        <div className="flex flex-wrap gap-4">
          {plans.map((p) => (
            <div key={p.value} className="flex items-center gap-2">
              <input
                type="radio"
                id={`${id}-${p.value}`}
                data-testid={`${id}-${p.value}`}
                name="plan"
                value={p.value}
                className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-slate-600"
                defaultChecked={opts.preset === p.value}
                required={opts.required}
                disabled={opts.disabled === p.value}
              />
              <label htmlFor={`${id}-${p.value}`} className="text-sm text-slate-700 dark:text-slate-200">
                {t(p.label)}
              </label>
            </div>
          ))}
        </div>
      </fieldset>
    );
  };
}

function RangeOutput({ id, t }: SpecimenProps) {
  const [value, setValue] = useState(70);
  return (
    <Field id={id} label={t('f.brightness')}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          id={id}
          data-testid={id}
          name="brightness"
          min={0}
          max={100}
          defaultValue={70}
          className="w-full accent-brand-600"
          onInput={(e) => setValue(Number(e.currentTarget.value))}
        />
        <output htmlFor={id} className="w-10 text-end font-mono text-sm" data-testid={`${id}-output`}>
          {value}
        </output>
      </div>
    </Field>
  );
}

function ProgressDemo({ id, t }: SpecimenProps) {
  const [value, setValue] = useState(30);
  const change = (next: number) => setValue(Math.max(0, Math.min(100, next)));
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={LABEL}>
        {t('f.uploadProgress')}
      </label>
      <progress id={id} data-testid={id} value={value} max={100} className="w-full accent-brand-600">
        {value}%
      </progress>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" data-testid={`${id}-decrease`} onClick={() => change(value - 10)}>
          −10
        </button>
        <button type="button" className="btn-secondary" data-testid={`${id}-increase`} onClick={() => change(value + 10)}>
          +10
        </button>
        <button type="button" className="btn-secondary" data-testid={`${id}-complete`} onClick={() => change(100)}>
          {t('b.complete')}
        </button>
        <button type="button" className="btn-ghost" data-testid={`${id}-restart`} onClick={() => change(0)}>
          {t('b.restart')}
        </button>
      </div>
    </div>
  );
}

function IndeterminateProgress({ id, t }: SpecimenProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={LABEL}>
        {t('f.uploadProgress')}
      </label>
      <progress id={id} data-testid={id} className="w-full accent-brand-600" />
    </div>
  );
}

function MeterDemo({ id, t }: SpecimenProps) {
  const [value, setValue] = useState(50);
  const change = (next: number) => setValue(Math.max(0, Math.min(100, next)));
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={LABEL}>
        {t('f.diskUsage')}
      </label>
      <meter id={id} data-testid={id} min={0} max={100} low={30} high={70} optimum={80} value={value} className="w-full">
        {value}%
      </meter>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-secondary" data-testid={`${id}-decrease`} onClick={() => change(value - 10)}>
          −10
        </button>
        <button type="button" className="btn-secondary" data-testid={`${id}-increase`} onClick={() => change(value + 10)}>
          +10
        </button>
      </div>
    </div>
  );
}

function SumDemo({ id, t }: SpecimenProps) {
  const [sum, setSum] = useState(5);
  const a = `${id}-a`;
  const b = `${id}-b`;
  function recalc(e: FormEvent<HTMLDivElement>) {
    const root = e.currentTarget;
    const x = Number(root.querySelector<HTMLInputElement>(`#${CSS.escape(a)}`)?.value || 0);
    const y = Number(root.querySelector<HTMLInputElement>(`#${CSS.escape(b)}`)?.value || 0);
    setSum(x + y);
  }
  return (
    <div className="grid gap-3 sm:grid-cols-3" onInput={recalc}>
      <Field id={a} label={t('f.first')}>
        <input type="number" id={a} data-testid={a} name="first" defaultValue={2} className="input" />
      </Field>
      <Field id={b} label={t('f.second')}>
        <input type="number" id={b} data-testid={b} name="second" defaultValue={3} className="input" />
      </Field>
      <div>
        <label htmlFor={id} className={LABEL}>
          {t('f.total')}
        </label>
        <output
          id={id}
          data-testid={id}
          name="total"
          htmlFor={`${a} ${b}`}
          className="block rounded-lg bg-slate-100 px-3 py-2 font-mono text-sm dark:bg-slate-800"
        >
          {sum}
        </output>
      </div>
    </div>
  );
}

function ClickCounter({ id, t }: SpecimenProps) {
  const [n, setN] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        id={id}
        data-testid={id}
        className="btn-primary"
        data-probe-value={`clicks=${n}`}
        onClick={() => setN((c) => c + 1)}
      >
        {t('b.clickMe')}
      </button>
      <span className="text-sm text-slate-600 dark:text-slate-300" data-testid={`${id}-count`}>
        {t('b.clicks', { n })}
      </span>
    </div>
  );
}

function InputClickCounter({ id, t }: SpecimenProps) {
  const [n, setN] = useState(0);
  return (
    <div className="flex items-center gap-3">
      <input
        type="button"
        id={id}
        data-testid={id}
        className="btn-primary"
        value={t('b.clickMe')}
        data-probe-value={`clicks=${n}`}
        onClick={() => setN((c) => c + 1)}
      />
      <span className="text-sm text-slate-600 dark:text-slate-300" data-testid={`${id}-count`}>
        {t('b.clicks', { n })}
      </span>
    </div>
  );
}

function SubmitButtons({ id, t }: SpecimenProps) {
  const comment = `${id}-comment`;
  return (
    <div className="space-y-3">
      <Field id={comment} label={t('f.comment')}>
        <input id={comment} data-testid={comment} name="comment" className="input" />
      </Field>
      <div className="flex gap-2">
        <button type="submit" id={id} data-testid={id} name="action" value="save" className="btn-primary">
          {t('b.save')}
        </button>
        <button type="submit" id={`${id}-send`} data-testid={`${id}-send`} name="action" value="send" className="btn-secondary">
          {t('b.send')}
        </button>
      </div>
    </div>
  );
}

function ResetButton({ id, t }: SpecimenProps) {
  return (
    <div className="space-y-3">
      <Field id={id} label={t('f.fullName')}>
        <input id={id} data-testid={id} name="fullName" defaultValue="Alex Morgan" className="input" />
      </Field>
      <button type="reset" id={`${id}-button`} data-testid={`${id}-button`} className="btn-secondary">
        {t('b.resetForm')}
      </button>
    </div>
  );
}

function InputSubmit({ id, t }: SpecimenProps) {
  const comment = `${id}-comment`;
  return (
    <div className="space-y-3">
      <Field id={comment} label={t('f.comment')}>
        <input id={comment} data-testid={comment} name="comment" className="input" />
      </Field>
      <input type="submit" id={id} data-testid={id} name="action" value={t('b.send')} className="btn-primary" />
    </div>
  );
}

function InputReset({ id, t }: SpecimenProps) {
  return (
    <div className="space-y-3">
      <Field id={id} label={t('f.fullName')}>
        <input id={id} data-testid={id} name="fullName" defaultValue="Alex Morgan" className="input" />
      </Field>
      <input type="reset" id={`${id}-button`} data-testid={`${id}-button`} value={t('b.resetForm')} className="btn-secondary" />
    </div>
  );
}

function InputImage({ id, t }: SpecimenProps) {
  return (
    <input
      type="image"
      id={id}
      data-testid={id}
      name="pos"
      src="/favicon.svg"
      alt={t('b.imageAlt')}
      width={64}
      height={64}
      className="rounded-lg border border-slate-200 p-2 dark:border-slate-700"
    />
  );
}

function FieldsetDemo({ id, t, disabledAtStart }: SpecimenProps & { disabledAtStart?: boolean }) {
  const [enabled, setEnabled] = useState(!disabledAtStart);
  return (
    <div className="space-y-3">
      {disabledAtStart && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`${id}-enable`}
            data-testid={`${id}-enable`}
            className={BOX}
            checked={enabled}
            onChange={(e) => setEnabled(e.currentTarget.checked)}
          />
          <label htmlFor={`${id}-enable`} className="text-sm text-slate-700 dark:text-slate-200">
            {t('b.enable')}
          </label>
        </div>
      )}
      <fieldset
        id={id}
        data-testid={id}
        name="contact"
        disabled={!enabled}
        className="rounded-lg border border-slate-200 p-3 disabled:opacity-60 dark:border-slate-700"
      >
        <legend className="px-1 text-sm font-semibold">{t('f.contact')}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id={`${id}-name`} label={t('f.name')}>
            <input id={`${id}-name`} data-testid={`${id}-name`} name="name" required className="input" />
          </Field>
          <Field id={`${id}-email`} label={t('f.email')}>
            <input id={`${id}-email`} data-testid={`${id}-email`} name="email" type="email" className="input" />
          </Field>
        </div>
      </fieldset>
    </div>
  );
}

const SECTIONS: { key: string; title: ElKey; body: ElKey }[] = [
  { key: 'shipping', title: 's.shipping', body: 's.shippingBody' },
  { key: 'returns', title: 's.returns', body: 's.returnsBody' },
  { key: 'payment', title: 's.payment', body: 's.paymentBody' },
];

const DETAILS = 'rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700';
const SUMMARY = 'cursor-pointer text-sm font-medium';

function details(open: boolean) {
  return function Details({ id, t }: SpecimenProps) {
    return (
      <details id={id} data-testid={id} open={open} className={DETAILS}>
        <summary className={SUMMARY} data-testid={`${id}-summary`}>
          {t('s.shipping')}
        </summary>
        <p className={`mt-2 ${HELP}`}>{t('s.shippingBody')}</p>
      </details>
    );
  };
}

function ExclusiveDetails({ id, t }: SpecimenProps) {
  // Same `name` = an exclusive group: the browser closes the others when one opens.
  const group = { name: `${id}-group` } as Record<string, string>;
  return (
    <div id={id} data-testid={id} className="space-y-2">
      {SECTIONS.map((s) => (
        <details key={s.key} id={`${id}-${s.key}`} data-testid={`${id}-${s.key}`} className={DETAILS} {...group}>
          <summary className={SUMMARY}>{t(s.title)}</summary>
          <p className={`mt-2 ${HELP}`}>{t(s.body)}</p>
        </details>
      ))}
    </div>
  );
}

function dialog(modal: boolean) {
  return function DialogDemo({ id, t }: SpecimenProps) {
    const ref = useRef<HTMLDialogElement>(null);
    return (
      <div className="space-y-2">
        <button
          type="button"
          className="btn-secondary"
          data-testid={`${id}-open`}
          onClick={() => {
            const d = ref.current;
            if (!d || d.open) return;
            if (modal) d.showModal();
            else d.show();
            refresh(d);
          }}
        >
          {t(modal ? 'b.openModal' : 'b.openDialog')}
        </button>
        <dialog
          ref={ref}
          id={id}
          data-testid={id}
          aria-labelledby={`${id}-heading`}
          className={
            modal
              ? 'w-[min(24rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-5 text-slate-800 shadow-xl backdrop:bg-slate-900/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
              : 'relative m-0 mt-2 w-full rounded-xl border border-slate-200 bg-white p-4 text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100'
          }
        >
          <form method="dialog" className="space-y-3">
            <h4 id={`${id}-heading`} className="font-semibold">
              {t(modal ? 'dlg.title' : 'dlg.panelTitle')}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-300">{t(modal ? 'dlg.body' : 'dlg.panelBody')}</p>
            <div className="flex justify-end gap-2">
              {modal ? (
                <>
                  <button value="cancel" className="btn-secondary" data-testid={`${id}-cancel`}>
                    {t('b.cancel')}
                  </button>
                  <button value="confirm" className="btn-danger" data-testid={`${id}-confirm`}>
                    {t('b.confirm')}
                  </button>
                </>
              ) : (
                <button value="close" className="btn-secondary" data-testid={`${id}-close`}>
                  {t('b.close')}
                </button>
              )}
            </div>
          </form>
        </dialog>
      </div>
    );
  };
}

function editable(mode: 'true' | 'plaintext-only') {
  return function Editable({ id, t }: SpecimenProps) {
    return (
      <div>
        <p id={`${id}-label`} className={LABEL}>
          {t('f.notes')}
        </p>
        <div
          id={id}
          data-testid={id}
          role="textbox"
          aria-multiline="true"
          aria-labelledby={`${id}-label`}
          tabIndex={0}
          {...({ contentEditable: mode } as Record<string, string>)}
          suppressContentEditableWarning
          className="input min-h-[5rem] whitespace-pre-wrap"
        >
          {mode === 'true' ? (
            <>
              <b>TestDesk</b> notes
            </>
          ) : (
            'TestDesk notes'
          )}
        </div>
      </div>
    );
  };
}

function NativeValidation({ id, t }: SpecimenProps) {
  return <SignupFields id={id} t={t} constraints />;
}

/** The sign-up fields shared by the validation variants. */
function SignupFields({
  id,
  t,
  constraints,
  errors = {},
}: {
  id: string;
  t: ElT;
  constraints?: boolean;
  errors?: Partial<Record<'name' | 'email' | 'password' | 'terms', string>>;
}) {
  const err = (field: keyof typeof errors) =>
    errors[field] ? (
      <p id={`${id}-${field}-error`} className="mt-1 text-xs text-rose-600 dark:text-rose-400" data-testid={`${id}-${field}-error`}>
        {errors[field]}
      </p>
    ) : null;
  const aria = (field: keyof typeof errors) =>
    errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${id}-${field}-error` } : {};
  return (
    <div className="space-y-3">
      <Field id={`${id}-name`} label={t('f.name')}>
        <input id={`${id}-name`} data-testid={`${id}-name`} name="name" className="input" required={constraints} {...aria('name')} />
        {err('name')}
      </Field>
      <Field id={`${id}-email`} label={t('f.email')}>
        <input
          id={`${id}-email`}
          data-testid={`${id}-email`}
          name="email"
          type={constraints ? 'email' : 'text'}
          className="input"
          required={constraints}
          {...aria('email')}
        />
        {err('email')}
      </Field>
      <Field id={`${id}-password`} label={t('f.password')}>
        <input
          id={`${id}-password`}
          data-testid={`${id}-password`}
          name="password"
          type="password"
          autoComplete="new-password"
          className="input"
          required={constraints}
          minLength={constraints ? 8 : undefined}
          {...aria('password')}
        />
        {err('password')}
      </Field>
      <div>
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={`${id}-terms`}
            data-testid={`${id}-terms`}
            name="terms"
            value="yes"
            className={BOX}
            required={constraints}
            {...aria('terms')}
          />
          <label htmlFor={`${id}-terms`} className="text-sm text-slate-700 dark:text-slate-200">
            {t('f.terms')}
          </label>
        </div>
        {err('terms')}
      </div>
      <button type="submit" className="btn-primary" data-testid={`${id}-submit`}>
        {t('b.signUp')}
      </button>
    </div>
  );
}

function CustomValidation({ id, t }: SpecimenProps) {
  const [errors, setErrors] = useState<Partial<Record<'name' | 'email' | 'password' | 'terms', string>>>({});
  const [sent, setSent] = useState(false);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const password = String(data.get('password') ?? '');
    const next: typeof errors = {};
    if (!name) next.name = t('e.required');
    if (!email) next.email = t('e.required');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = t('e.email');
    if (password.length < 8) next.password = t('e.min8');
    if (!data.get('terms')) next.terms = t('e.terms');
    setErrors(next);
    setSent(Object.keys(next).length === 0);
  }
  return (
    <form id={id} data-testid={id} noValidate onSubmit={onSubmit} className="space-y-3">
      <SignupFields id={id} t={t} errors={errors} />
      {sent && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300" data-testid={`${id}-success`}>
          {t('ok.sent')}
        </p>
      )}
    </form>
  );
}

function CustomValidity({ id, t }: SpecimenProps) {
  const pw = `${id}-password`;
  const confirm = `${id}-confirm`;
  function check(e: FormEvent<HTMLDivElement>) {
    const root = e.currentTarget;
    const a = root.querySelector<HTMLInputElement>(`#${CSS.escape(pw)}`);
    const b = root.querySelector<HTMLInputElement>(`#${CSS.escape(confirm)}`);
    if (a && b) b.setCustomValidity(b.value && a.value !== b.value ? t('e.mismatch') : '');
  }
  return (
    <div className="space-y-3" onInput={check}>
      <Field id={pw} label={t('f.newPassword')}>
        <input id={pw} data-testid={pw} name="password" type="password" autoComplete="new-password" required className="input" />
      </Field>
      <Field id={confirm} label={t('f.confirmPassword')}>
        <input id={confirm} data-testid={confirm} name="confirm" type="password" autoComplete="new-password" required className="input" />
      </Field>
      <button type="submit" className="btn-primary" data-testid={`${id}-submit`}>
        {t('b.setPassword')}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The catalog

export const ELEMENTS: ElementSpec[] = [
  // Text inputs
  {
    slug: 'text',
    group: 'text',
    code: '<input type="text">',
    desc: 'd.text',
    variants: [
      input('default', 'v.default', 'f.fullName', (t) => ({ type: 'text', placeholder: t('ph.fullName'), autoComplete: 'name' })),
      input('required', 'v.required', 'f.fullName', { type: 'text', required: true }),
      input('length', 'v.length', 'f.fullName', { type: 'text', minLength: 3, maxLength: 20 }, 'h.length3to20'),
      input(
        'pattern',
        'v.pattern',
        'f.orderCode',
        (t) => ({ type: 'text', pattern: '[A-Z]{3}-[0-9]{4}', placeholder: 'ABC-1234', title: t('h.orderCode') }),
        'h.orderCode',
      ),
      input('readonly', 'v.readonly', 'f.ticketRef', { type: 'text', defaultValue: 'TD-1042', readOnly: true }),
      input('disabled', 'v.disabled', 'f.fullName', { type: 'text', defaultValue: 'Alex Morgan', disabled: true }),
    ],
  },
  {
    slug: 'password',
    group: 'text',
    code: '<input type="password">',
    desc: 'd.password',
    variants: [
      input('default', 'v.default', 'f.password', { type: 'password', autoComplete: 'current-password' }),
      { key: 'toggle', label: 'v.toggle', render: PasswordToggle },
      input(
        'required',
        'v.required',
        'f.newPassword',
        { type: 'password', required: true, minLength: 8, autoComplete: 'new-password' },
        'h.min8',
      ),
    ],
  },
  {
    slug: 'email',
    group: 'text',
    code: '<input type="email">',
    desc: 'd.email',
    variants: [
      input('default', 'v.default', 'f.email', { type: 'email', autoComplete: 'email' }),
      input('required', 'v.required', 'f.email', { type: 'email', required: true }),
      input('multiple', 'v.multiple', 'f.emails', { type: 'email', multiple: true }, 'h.commaSeparated'),
    ],
  },
  {
    slug: 'url',
    group: 'text',
    code: '<input type="url">',
    desc: 'd.url',
    variants: [
      input('default', 'v.default', 'f.website', { type: 'url', placeholder: 'https://example.com' }),
      input('pattern', 'v.pattern', 'f.website', { type: 'url', required: true, pattern: 'https://.*' }, 'h.httpsOnly'),
    ],
  },
  {
    slug: 'tel',
    group: 'text',
    code: '<input type="tel">',
    desc: 'd.tel',
    variants: [
      input('default', 'v.default', 'f.phone', { type: 'tel', autoComplete: 'tel' }),
      input(
        'pattern',
        'v.pattern',
        'f.phone',
        { type: 'tel', pattern: '[0-9]{3}-[0-9]{3}-[0-9]{4}', placeholder: '555-123-4567' },
        'h.phoneFormat',
      ),
    ],
  },
  {
    slug: 'search',
    group: 'text',
    code: '<input type="search">',
    desc: 'd.search',
    variants: [
      input('default', 'v.default', 'f.search', (t) => ({ type: 'search', placeholder: t('ph.search') })),
      input('required', 'v.required', 'f.search', { type: 'search', required: true }),
    ],
  },
  {
    slug: 'number',
    group: 'text',
    code: '<input type="number">',
    desc: 'd.number',
    variants: [
      input('default', 'v.default', 'f.quantity', { type: 'number' }),
      input('minmax', 'v.minmax', 'f.quantity', { type: 'number', min: 1, max: 10, defaultValue: 1 }, 'h.range1to10'),
      input('decimal', 'v.decimal', 'f.price', { type: 'number', min: 0, step: 0.01 }, 'h.twoDecimals'),
      input('readonly', 'v.readonly', 'f.quantity', { type: 'number', defaultValue: 42, readOnly: true }),
    ],
  },
  {
    slug: 'textarea',
    group: 'text',
    code: '<textarea>',
    desc: 'd.textarea',
    variants: [
      {
        key: 'default',
        label: 'v.default',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.message')}>
            <textarea id={id} data-testid={id} name="message" rows={3} placeholder={t('ph.message')} className="input" />
          </Field>
        ),
      },
      { key: 'counter', label: 'v.counter', render: TextareaCounter },
      {
        key: 'required',
        label: 'v.required',
        hint: 'h.min10',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.message')}>
            <textarea id={id} data-testid={id} name="message" rows={3} required minLength={10} className="input" />
          </Field>
        ),
      },
      {
        key: 'disabled',
        label: 'v.disabled',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.message')}>
            <textarea id={id} data-testid={id} name="message" rows={2} disabled defaultValue="Read me" className="input" />
          </Field>
        ),
      },
    ],
  },
  {
    slug: 'hidden',
    group: 'text',
    code: '<input type="hidden">',
    desc: 'd.hidden',
    variants: [{ key: 'default', label: 'v.default', hint: 'h.hidden', render: HiddenDemo }],
  },

  // Date and time
  {
    slug: 'date',
    group: 'datetime',
    code: '<input type="date">',
    desc: 'd.date',
    variants: [
      input('default', 'v.default', 'f.startDate', { type: 'date' }),
      input('minmax', 'v.minmax', 'f.startDate', { type: 'date', min: '2026-01-01', max: '2026-12-31' }, 'h.dateRange'),
      input('preset', 'v.preset', 'f.startDate', { type: 'date', defaultValue: '2026-07-15' }),
      input('required', 'v.required', 'f.startDate', { type: 'date', required: true }),
    ],
  },
  {
    slug: 'time',
    group: 'datetime',
    code: '<input type="time">',
    desc: 'd.time',
    variants: [
      input('default', 'v.default', 'f.meetingTime', { type: 'time' }),
      input('minmax', 'v.minmax', 'f.meetingTime', { type: 'time', min: '09:00', max: '17:00', step: 900 }, 'h.workingHours'),
      input('seconds', 'v.seconds', 'f.meetingTime', { type: 'time', step: 1, defaultValue: '12:30:45' }),
    ],
  },
  {
    slug: 'datetime-local',
    group: 'datetime',
    code: '<input type="datetime-local">',
    desc: 'd.datetime-local',
    variants: [
      input('default', 'v.default', 'f.appointment', { type: 'datetime-local' }),
      input(
        'minmax',
        'v.minmax',
        'f.appointment',
        { type: 'datetime-local', min: '2026-01-01T08:00', max: '2026-12-31T18:00' },
        'h.dtRange',
      ),
    ],
  },
  {
    slug: 'month',
    group: 'datetime',
    code: '<input type="month">',
    desc: 'd.month',
    variants: [
      input('default', 'v.default', 'f.billingMonth', { type: 'month' }),
      input('minmax', 'v.minmax', 'f.billingMonth', { type: 'month', min: '2026-01', max: '2026-12' }, 'h.monthRange'),
    ],
  },
  {
    slug: 'week',
    group: 'datetime',
    code: '<input type="week">',
    desc: 'd.week',
    variants: [
      input('default', 'v.default', 'f.sprintWeek', { type: 'week' }),
      input('minmax', 'v.minmax', 'f.sprintWeek', { type: 'week', min: '2026-W01', max: '2026-W26' }, 'h.weekRange'),
    ],
  },

  // Choices
  {
    slug: 'checkbox',
    group: 'choice',
    code: '<input type="checkbox">',
    desc: 'd.checkbox',
    variants: [
      input('default', 'v.default', 'f.terms', { type: 'checkbox' }),
      input('checked', 'v.checked', 'f.newsletter', { type: 'checkbox', defaultChecked: true }),
      { key: 'indeterminate', label: 'v.indeterminate', hint: 'h.indeterminate', render: SelectAllDemo },
      input('required', 'v.required', 'f.terms', { type: 'checkbox', required: true }),
      input('disabled', 'v.disabled', 'f.newsletter', { type: 'checkbox', defaultChecked: true, disabled: true }),
    ],
  },
  {
    slug: 'radio',
    group: 'choice',
    code: '<input type="radio">',
    desc: 'd.radio',
    variants: [
      { key: 'default', label: 'v.default', render: radioGroup({}) },
      { key: 'preset', label: 'v.group', render: radioGroup({ preset: 'pro' }) },
      { key: 'required', label: 'v.required', render: radioGroup({ required: true }) },
      { key: 'disabled-option', label: 'v.disabledOption', render: radioGroup({ preset: 'free', disabled: 'team' }) },
    ],
  },
  {
    slug: 'select',
    group: 'choice',
    code: '<select>',
    desc: 'd.select',
    variants: [
      {
        key: 'default',
        label: 'v.default',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.priority')}>
            <select id={id} data-testid={id} name="priority" className="input">
              <Options t={t} keys={PRIORITIES} />
            </select>
          </Field>
        ),
      },
      {
        key: 'required',
        label: 'v.placeholder',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.priority')}>
            <select id={id} data-testid={id} name="priority" className="input" required defaultValue="">
              <option value="">{t('opt.choose')}</option>
              <Options t={t} keys={PRIORITIES} />
            </select>
          </Field>
        ),
      },
      {
        key: 'optgroup',
        label: 'v.optgroup',
        render: ({ id, t, locale }) => (
          <Field id={id} label={t('f.country')}>
            <select id={id} data-testid={id} name="country" className="input">
              {REGIONS.map((r) => (
                <optgroup key={r.label} label={t(r.label)}>
                  {r.codes.map((c) => (
                    <option key={c} value={c}>
                      {countryName(c, locale)}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
        ),
      },
      {
        key: 'disabled-option',
        label: 'v.disabledOption',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.priority')}>
            <select id={id} data-testid={id} name="priority" className="input">
              <Options t={t} keys={PRIORITIES.map((p) => ({ ...p, disabled: p.value === 'urgent' }))} />
            </select>
          </Field>
        ),
      },
      {
        key: 'disabled',
        label: 'v.disabled',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.priority')}>
            <select id={id} data-testid={id} name="priority" className="input" disabled defaultValue="high">
              <Options t={t} keys={PRIORITIES} />
            </select>
          </Field>
        ),
      },
    ],
  },
  {
    slug: 'select-multiple',
    group: 'choice',
    code: '<select multiple>',
    desc: 'd.select-multiple',
    variants: [
      {
        key: 'default',
        label: 'v.default',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.categories')}>
            <select id={id} data-testid={id} name="categories" multiple size={6} className="input">
              <Options t={t} keys={CATEGORIES} />
            </select>
          </Field>
        ),
      },
      {
        key: 'required',
        label: 'v.required',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.categories')}>
            <select id={id} data-testid={id} name="categories" multiple size={6} required className="input">
              <Options t={t} keys={CATEGORIES} />
            </select>
          </Field>
        ),
      },
    ],
  },
  {
    slug: 'datalist',
    group: 'choice',
    code: '<input list> + <datalist>',
    desc: 'd.datalist',
    variants: [
      {
        key: 'countries',
        label: 'v.countries',
        hint: 'h.datalist',
        render: ({ id, t, locale }) => (
          <Field id={id} label={t('f.country')}>
            <input id={id} data-testid={id} name="country" list={`${id}-list`} autoComplete="off" className="input" />
            <datalist id={`${id}-list`}>
              {REGIONS.flatMap((r) => r.codes).map((c) => (
                <option key={c} value={countryName(c, locale)} />
              ))}
            </datalist>
          </Field>
        ),
      },
      {
        key: 'browsers',
        label: 'v.browsers',
        hint: 'h.datalist',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.browser')}>
            <input id={id} data-testid={id} name="browser" list={`${id}-list`} autoComplete="off" className="input" />
            <datalist id={`${id}-list`}>
              {['Chrome', 'Edge', 'Firefox', 'Safari'].map((b) => (
                <option key={b} value={b} />
              ))}
            </datalist>
          </Field>
        ),
      },
    ],
  },

  // Ranges and indicators
  {
    slug: 'range',
    group: 'range',
    code: '<input type="range">',
    desc: 'd.range',
    variants: [
      input('default', 'v.default', 'f.volume', { type: 'range', min: 0, max: 100, defaultValue: 50, className: 'w-full accent-brand-600' }),
      {
        key: 'ticks',
        label: 'v.ticks',
        hint: 'h.ticks',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.volume')}>
            <input
              type="range"
              id={id}
              data-testid={id}
              name="volume"
              min={0}
              max={100}
              step={10}
              defaultValue={30}
              list={`${id}-ticks`}
              className="w-full accent-brand-600"
            />
            <datalist id={`${id}-ticks`}>
              {Array.from({ length: 11 }, (_, i) => (
                <option key={i} value={i * 10} />
              ))}
            </datalist>
          </Field>
        ),
      },
      { key: 'output', label: 'v.output', render: RangeOutput },
      input('disabled', 'v.disabled', 'f.volume', {
        type: 'range',
        defaultValue: 20,
        disabled: true,
        className: 'w-full accent-brand-600',
      }),
    ],
  },
  {
    slug: 'color',
    group: 'range',
    code: '<input type="color">',
    desc: 'd.color',
    variants: [
      input('default', 'v.default', 'f.brandColor', { type: 'color', className: 'h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-700' }),
      input('preset', 'v.preset', 'f.brandColor', {
        type: 'color',
        defaultValue: '#2563eb',
        className: 'h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-700',
      }),
      {
        key: 'swatches',
        label: 'v.swatches',
        render: ({ id, t }) => (
          <Field id={id} label={t('f.brandColor')}>
            <input
              type="color"
              id={id}
              data-testid={id}
              name="brandColor"
              defaultValue="#16a34a"
              list={`${id}-swatches`}
              className="h-10 w-20 cursor-pointer rounded border border-slate-300 dark:border-slate-700"
            />
            <datalist id={`${id}-swatches`}>
              {['#2563eb', '#16a34a', '#dc2626', '#f59e0b', '#7c3aed'].map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        ),
      },
    ],
  },
  {
    slug: 'progress',
    group: 'range',
    code: '<progress>',
    desc: 'd.progress',
    variants: [
      { key: 'determinate', label: 'v.determinate', render: ProgressDemo },
      { key: 'indeterminate', label: 'v.indeterminate', render: IndeterminateProgress },
    ],
  },
  {
    slug: 'meter',
    group: 'range',
    code: '<meter>',
    desc: 'd.meter',
    variants: [{ key: 'levels', label: 'v.levels', render: MeterDemo }],
  },
  {
    slug: 'output',
    group: 'range',
    code: '<output>',
    desc: 'd.output',
    variants: [{ key: 'sum', label: 'v.sum', render: SumDemo }],
  },

  // Files
  {
    slug: 'file',
    group: 'files',
    code: '<input type="file">',
    desc: 'd.file',
    variants: [
      input('single', 'v.single', 'f.attachment', { type: 'file', className: 'input file:me-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 dark:file:bg-slate-700 dark:file:text-slate-100' }),
      input('multiple', 'v.multiple', 'f.attachments', {
        type: 'file',
        multiple: true,
        className: 'input file:me-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 dark:file:bg-slate-700 dark:file:text-slate-100',
      }),
      input(
        'images',
        'v.images',
        'f.avatar',
        {
          type: 'file',
          accept: 'image/*',
          className: 'input file:me-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 dark:file:bg-slate-700 dark:file:text-slate-100',
        },
        'h.images',
      ),
      input(
        'docs',
        'v.docs',
        'f.reportFile',
        {
          type: 'file',
          accept: '.pdf,.csv',
          className: 'input file:me-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 dark:file:bg-slate-700 dark:file:text-slate-100',
        },
        'h.docs',
      ),
      input('required', 'v.required', 'f.attachment', {
        type: 'file',
        required: true,
        className: 'input file:me-3 file:rounded file:border-0 file:bg-slate-100 file:px-2 file:py-1 dark:file:bg-slate-700 dark:file:text-slate-100',
      }),
      input('disabled', 'v.disabled', 'f.attachment', { type: 'file', disabled: true, className: 'input' }),
    ],
  },

  // Buttons
  {
    slug: 'button',
    group: 'buttons',
    code: '<button>',
    desc: 'd.button',
    variants: [
      { key: 'button', label: 'v.typeButton', render: ClickCounter },
      { key: 'submit', label: 'v.typeSubmit', hint: 'h.submit', render: SubmitButtons },
      { key: 'reset', label: 'v.typeReset', hint: 'h.resetForm', render: ResetButton },
      {
        key: 'disabled',
        label: 'v.disabled',
        render: ({ id, t }) => (
          <button type="button" id={id} data-testid={id} className="btn-primary" disabled>
            {t('b.clickMe')}
          </button>
        ),
      },
    ],
  },
  {
    slug: 'input-button',
    group: 'buttons',
    code: '<input type="submit | reset | button | image">',
    desc: 'd.input-button',
    variants: [
      { key: 'submit', label: 'v.typeSubmit', render: InputSubmit },
      { key: 'reset', label: 'v.typeReset', hint: 'h.resetForm', render: InputReset },
      { key: 'button', label: 'v.typeButton', render: InputClickCounter },
      { key: 'image', label: 'v.typeImage', hint: 'h.image', render: InputImage },
    ],
  },

  // Structure and grouping
  {
    slug: 'label',
    group: 'structure',
    code: '<label>',
    desc: 'd.label',
    variants: [
      input('explicit', 'v.explicit', 'f.email', { type: 'email' }),
      {
        key: 'implicit',
        label: 'v.implicit',
        render: ({ id, t }) => (
          <label className={LABEL}>
            {t('f.city')}
            <input id={id} data-testid={id} name="city" className="input mt-1 font-normal" />
          </label>
        ),
      },
      {
        key: 'labelledby',
        label: 'v.labelledby',
        render: ({ id, t }) => (
          <div>
            <span id={`${id}-label`} className={LABEL}>
              {t('f.city')}
            </span>
            <input id={id} data-testid={id} name="city" aria-labelledby={`${id}-label`} className="input" />
          </div>
        ),
      },
      {
        key: 'two-labels',
        label: 'v.twoLabels',
        render: ({ id, t }) => (
          <div>
            <label htmlFor={id} className={LABEL}>
              {t('f.phone')}
            </label>
            <input id={id} data-testid={id} name="phone" type="tel" className="input" />
            <label htmlFor={id} className={`mt-1 block ${HELP}`}>
              {t('h.phoneFormat')}
            </label>
          </div>
        ),
      },
    ],
  },
  {
    slug: 'fieldset',
    group: 'structure',
    code: '<fieldset> + <legend>',
    desc: 'd.fieldset',
    variants: [
      { key: 'legend', label: 'v.legend', render: (p) => <FieldsetDemo {...p} /> },
      { key: 'disabled', label: 'v.disabledFieldset', hint: 'h.disabledFieldset', render: (p) => <FieldsetDemo {...p} disabledAtStart /> },
    ],
  },
  {
    slug: 'details',
    group: 'structure',
    code: '<details> + <summary>',
    desc: 'd.details',
    variants: [
      { key: 'closed', label: 'v.closed', render: details(false) },
      { key: 'open', label: 'v.open', render: details(true) },
      { key: 'exclusive', label: 'v.exclusive', hint: 'h.exclusive', render: ExclusiveDetails },
    ],
  },
  {
    slug: 'dialog',
    group: 'structure',
    code: '<dialog>',
    desc: 'd.dialog',
    variants: [
      { key: 'modal', label: 'v.modal', hint: 'h.modal', ownForm: true, render: dialog(true) },
      { key: 'non-modal', label: 'v.nonModal', ownForm: true, render: dialog(false) },
    ],
  },
  {
    slug: 'contenteditable',
    group: 'structure',
    code: '<div contenteditable>',
    desc: 'd.contenteditable',
    variants: [
      { key: 'rich', label: 'v.richText', render: editable('true') },
      { key: 'plain', label: 'v.plainText', hint: 'h.plain', render: editable('plaintext-only') },
    ],
  },

  // Form validation
  {
    slug: 'form-validation',
    group: 'validation',
    code: '<form>',
    desc: 'd.form-validation',
    variants: [
      { key: 'native', label: 'v.native', hint: 'h.native', render: NativeValidation },
      { key: 'novalidate', label: 'v.novalidate', hint: 'h.novalidate', ownForm: true, render: CustomValidation },
      { key: 'custom-validity', label: 'v.customValidity', hint: 'h.customValidity', render: CustomValidity },
    ],
  },
];

export function findElement(slug: string | undefined): ElementSpec | undefined {
  return ELEMENTS.find((e) => e.slug === slug);
}
