import { useEffect, useMemo, useState } from 'react';
import { Inbox as InboxIcon, Mail, RefreshCw, Trash2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { cn } from '@/lib/cn';
import {
  OTP_MAILBOX,
  OTP_EXPIRY_SECONDS,
  clearInbox,
  deliveredMessages,
  subscribeOtp,
  type OtpMessage,
} from '@/lib/otp';

const SENDER = 'TestDesk Security';
const SENDER_EMAIL = 'no-reply@testdesk.io';
const SUBJECT = 'Your TestDesk sign-in code';

function relativeTime(from: number, now: number): string {
  const s = Math.max(0, Math.round((now - from) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return new Date(from).toLocaleTimeString();
}

/**
 * Demo mailbox that receives the sign-in one-time codes. Opened from the OTP
 * step of /login in a new tab; updates live as new codes are sent.
 */
export function Inbox() {
  const [now, setNow] = useState(() => Date.now());
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    document.title = 'Inbox · TestDesk Mail';
    const unsubscribe = subscribeOtp(() => setVersion((v) => v + 1));
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => {
      unsubscribe();
      window.clearInterval(timer);
    };
  }, []);

  // `version` forces a re-read when another tab writes to the mailbox.
  const messages = useMemo(() => deliveredMessages(now), [now, version]);
  const open: OtpMessage | undefined = messages.find((m) => m.id === openId);
  const unread = messages.filter((m) => !readIds.has(m.id)).length;

  function openMessage(id: string) {
    setOpenId(id);
    setReadIds((prev) => new Set(prev).add(id));
  }

  function handleClear() {
    clearInbox();
    setOpenId(null);
    setReadIds(new Set());
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950" data-testid="inbox-page">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-3 px-4 py-3">
          <Logo />
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            Mail · demo
          </span>
          <span className="ms-auto text-sm text-slate-500 dark:text-slate-400" data-testid="inbox-address">
            {OTP_MAILBOX}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            <InboxIcon className="h-5 w-5" /> Inbox
            {unread > 0 && (
              <span
                className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-semibold text-white"
                data-testid="inbox-unread-count"
              >
                {unread}
              </span>
            )}
          </h1>
          <div className="ms-auto flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setVersion((v) => v + 1)}
              data-testid="inbox-refresh"
            >
              <RefreshCw className="h-4 w-4" /> Refresh
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={handleClear}
              disabled={messages.length === 0}
              data-testid="inbox-clear"
            >
              <Trash2 className="h-4 w-4" /> Clear
            </button>
          </div>
        </div>

        <div className="card grid overflow-hidden md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul
            className="divide-y divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800 md:border-b-0 md:border-e"
            data-testid="inbox-list"
            aria-label="Messages"
          >
            {messages.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-slate-500" data-testid="inbox-empty">
                No messages yet. New mail shows up here automatically.
              </li>
            ) : (
              messages.map((m) => {
                const isUnread = !readIds.has(m.id);
                return (
                  <li key={m.id}>
                    <button
                      type="button"
                      onClick={() => openMessage(m.id)}
                      className={cn(
                        'flex w-full items-start gap-3 px-4 py-3 text-start hover:bg-slate-50 dark:hover:bg-slate-800/60',
                        openId === m.id && 'bg-brand-50 dark:bg-brand-950/40',
                      )}
                      data-testid="inbox-message"
                      data-unread={isUnread ? 'true' : 'false'}
                    >
                      <span
                        className={cn(
                          'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                          isUnread ? 'bg-brand-600' : 'bg-transparent',
                        )}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={cn('truncate text-sm', isUnread && 'font-semibold')}>{SENDER}</span>
                          <span className="ms-auto shrink-0 text-xs text-slate-400">
                            {relativeTime(m.deliverAt, now)}
                          </span>
                        </span>
                        <span className={cn('block truncate text-sm', isUnread && 'font-semibold')}>{SUBJECT}</span>
                        <span className="block truncate text-xs text-slate-500">
                          Use this code to finish signing in to TestDesk…
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>

          <section className="min-h-[18rem] p-6" data-testid="inbox-reader" aria-live="polite">
            {open ? (
              <article>
                <h2 className="text-lg font-semibold" data-testid="inbox-subject">
                  {SUBJECT}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  From {SENDER} &lt;{SENDER_EMAIL}&gt; · To {OTP_MAILBOX} ·{' '}
                  {new Date(open.deliverAt).toLocaleTimeString()}
                </p>
                <div className="mt-6 space-y-4 text-sm text-slate-700 dark:text-slate-300">
                  <p>Hi analyst,</p>
                  <p>Use the code below to finish signing in to TestDesk:</p>
                  <p
                    className="inline-block rounded-lg bg-slate-100 px-4 py-2 font-mono text-2xl font-semibold tracking-[0.3em] text-slate-900 dark:bg-slate-800 dark:text-white"
                    data-testid="otp-code"
                  >
                    {open.code}
                  </p>
                  <p>
                    This code expires in {OTP_EXPIRY_SECONDS} seconds and can be used once. Requesting a new
                    code makes this one invalid.
                  </p>
                  <p className="text-xs text-slate-500">
                    If you didn't try to sign in, you can ignore this email.
                  </p>
                </div>
              </article>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-500">
                <Mail className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                Select a message to read it.
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
