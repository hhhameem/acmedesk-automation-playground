import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  ExternalLink,
  KeyRound,
  Lock,
  MailCheck,
  RefreshCw,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import {
  TEST_USERNAME,
  checkCredentials,
  generatePassword,
  useAuthStore,
} from "@/store/auth";
import { OTP_MAILBOX, issueOtp, verifyOtp } from "@/lib/otp";
import { toast } from "@/store/toast";
import { ToastHost } from "@/components/ToastHost";
import { cn } from "@/lib/cn";
import { Logo } from "@/components/Logo";

interface FromState {
  from?: { pathname?: string };
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const signIn = useAuthStore((s) => s.signIn);

  const [step, setStep] = useState<1 | 2>(1);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  // A fresh random password every time the page loads (and on "Back").
  const [expectedPassword, setExpectedPassword] = useState(generatePassword);
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [resent, setResent] = useState(false);

  // Drive the expiry countdown while on the OTP step.
  useEffect(() => {
    if (step !== 2) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [step]);

  const secondsLeft = Math.max(0, Math.ceil((otpExpiresAt - now) / 1000));
  const expired = step === 2 && secondsLeft === 0;

  const target = (location.state as FromState | null)?.from?.pathname || "/";

  if (isAuthenticated) return <Navigate to={target} replace />;

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError("");
    setPending(true);
    await wait(450);
    if (checkCredentials(username, password, expectedPassword)) {
      sendCode(false);
      setPending(false);
      setStep(2);
    } else {
      setPending(false);
      setError(
        "Invalid username or password. Use the test credentials shown above.",
      );
    }
  }

  function sendCode(isResend: boolean) {
    const message = issueOtp();
    setOtpExpiresAt(message.expiresAt);
    setNow(Date.now());
    setResent(isResend);
  }

  function resendCode() {
    // Resend is only allowed once the current code has expired.
    if (!expired) return;
    sendCode(true);
    setOtp("");
    setError("");
    toast.success({
      title: "New code sent",
      message: `A fresh 6-digit code was emailed to ${OTP_MAILBOX}. Open the demo inbox to get it.`,
    });
  }

  async function submitOtp(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    await wait(400);
    const result = verifyOtp(otp);
    if (result === "ok") {
      signIn(username.trim());
      navigate(target, { replace: true });
      return;
    }
    setPending(false);
    setError(
      result === "expired"
        ? 'This code has expired. Click "Resend code" to get a new one from the demo inbox.'
        : "That code is not valid. Use the code from the latest email in your inbox.",
    );
  }

  function backToCredentials(e?: React.MouseEvent<HTMLButtonElement>) {
    // Guard against the click's default action firing after React reuses this
    // button node for the step-1 submit button (which would resubmit and bounce
    // straight back to the OTP step).
    e?.preventDefault();
    setStep(1);
    setOtp("");
    setError("");
    setResent(false);
    // Returning to step 1 issues a new password, like a fresh page load.
    setPassword("");
    setExpectedPassword(generatePassword());
  }

  return (
    <div className='flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10 dark:bg-slate-950'>
      <div className='w-full max-w-md'>
        <div className='mb-6 flex flex-col items-center gap-2 text-center'>
          <Logo markOnly markClassName='h-12 w-12' />
          <h1 className='text-xl font-semibold tracking-tight'>
            Sign in to TestDesk
          </h1>
          <p className='text-sm text-slate-500 dark:text-slate-400'>
            Two-step verification · test automation portal
          </p>
        </div>

        <div className='card p-6'>
          <div
            className='mb-5 flex items-center gap-2'
            data-testid='auth-step'
            data-step={step}
          >
            {[1, 2].map((n) => (
              <div key={n} className='flex flex-1 items-center gap-2'>
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                    step === n
                      ? "bg-brand-600 text-white"
                      : step > n
                        ? "bg-brand-100 text-brand-700 dark:bg-brand-950 dark:text-brand-300"
                        : "bg-slate-100 text-slate-400 dark:bg-slate-800",
                  )}
                >
                  {n}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    step === n
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-400",
                  )}
                >
                  {n === 1 ? "Credentials" : "One-time code"}
                </span>
                {n === 1 && (
                  <span className='ms-auto h-px flex-1 bg-slate-200 dark:bg-slate-700' />
                )}
              </div>
            ))}
          </div>

          {error && (
            <div
              role='alert'
              data-testid='auth-error'
              className='mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300'
            >
              <span className='flex-1'>{error}</span>
              <button
                type='button'
                aria-label='Dismiss error'
                onClick={() => setError("")}
                className='-me-1 rounded p-0.5 opacity-60 hover:opacity-100'
                data-testid='auth-error-dismiss'
              >
                <X className='h-4 w-4' />
              </button>
            </div>
          )}

          {step === 1 ? (
            <form
              key='credentials'
              onSubmit={submitCredentials}
              className='space-y-4'
              noValidate
            >
              <div className='rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200'>
                <p className='font-semibold uppercase tracking-wide'>
                  Test credentials
                </p>
                <p className='mt-1 font-mono'>
                  username:{" "}
                  <span data-testid='hint-username'>{TEST_USERNAME}</span>
                </p>
                <p className='flex flex-wrap items-center gap-x-2 gap-y-1 font-mono'>
                  <span>
                    password:{" "}
                    <span data-testid='hint-password'>{expectedPassword}</span>
                  </span>
                  <span
                    className='inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-px font-sans text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-900/60 dark:text-amber-200'
                    data-testid='hint-password-dynamic'
                  >
                    <RefreshCw className='h-2.5 w-2.5' /> Resets every load
                  </span>
                </p>
              </div>

              <div>
                <label className='label' htmlFor='username'>
                  Username
                </label>
                <div className='relative'>
                  <User className='pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <input
                    id='username'
                    name='username'
                    autoComplete='username'
                    className='input ps-9'
                    placeholder={TEST_USERNAME}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    data-testid='login-username'
                  />
                </div>
              </div>

              <div>
                <label className='label' htmlFor='password'>
                  Password
                </label>
                <div className='relative'>
                  <Lock className='pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <input
                    id='password'
                    name='password'
                    type='password'
                    autoComplete='current-password'
                    className='input ps-9'
                    placeholder='••••••••'
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid='login-password'
                  />
                </div>
              </div>

              <button
                type='submit'
                className='btn-primary w-full'
                disabled={pending}
                data-testid='login-submit'
              >
                {pending ? "Checking…" : "Continue"}
              </button>
            </form>
          ) : (
            <form
              key='otp'
              onSubmit={submitOtp}
              className='space-y-4'
              noValidate
            >
              <div
                className='rounded-lg border border-dashed border-brand-300 bg-brand-50 px-3 py-2 text-xs text-brand-800 dark:border-brand-800 dark:bg-brand-950 dark:text-brand-200'
                data-testid='otp-sent-notice'
              >
                <p className='flex items-center gap-1.5 font-semibold uppercase tracking-wide'>
                  <MailCheck className='h-3.5 w-3.5' />{" "}
                  {resent ? "New code sent" : "Check your email"}
                </p>
                <p className='mt-1'>
                  Enter the latest 6-digit code sent to{" "}
                  <span className='font-mono font-bold'>{OTP_MAILBOX}</span>.
                  Open the demo inbox below to get it—it may take a few seconds
                  to arrive.
                </p>
                <a
                  href='/inbox'
                  target='_blank'
                  rel='noopener'
                  className='mt-1.5 inline-flex items-center gap-1 font-semibold underline underline-offset-2'
                  data-testid='open-inbox'
                >
                  Open demo inbox <ExternalLink className='h-3 w-3' />
                </a>
              </div>

              <div>
                <label className='label' htmlFor='otp'>
                  One-time code
                </label>
                <div className='relative'>
                  <KeyRound className='pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400' />
                  <input
                    id='otp'
                    name='otp'
                    inputMode='numeric'
                    autoComplete='one-time-code'
                    maxLength={6}
                    className='input ps-9 font-mono tracking-[0.4em]'
                    placeholder='······'
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    data-testid='otp-input'
                  />
                </div>
                <div className='mt-1.5 flex items-center justify-between text-xs'>
                  <span
                    className={cn(
                      expired
                        ? "font-medium text-rose-600 dark:text-rose-400"
                        : "text-slate-500",
                    )}
                    data-testid='otp-countdown'
                    data-seconds-left={secondsLeft}
                  >
                    {expired
                      ? "Code expired"
                      : `Code expires in ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
                  </span>
                  <button
                    type='button'
                    className='font-semibold text-brand-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline dark:text-brand-400 dark:disabled:text-slate-500'
                    onClick={resendCode}
                    disabled={pending || !expired}
                    title={
                      expired
                        ? undefined
                        : "You can request a new code once this one expires"
                    }
                    data-testid='otp-resend'
                  >
                    Resend code
                  </button>
                </div>
              </div>

              <button
                type='submit'
                className='btn-primary w-full'
                disabled={pending}
                data-testid='otp-submit'
              >
                {pending ? "Verifying…" : "Verify & sign in"}
              </button>

              <button
                type='button'
                className='btn-ghost w-full'
                onClick={backToCredentials}
                disabled={pending}
                data-testid='auth-back'
              >
                Back
              </button>
            </form>
          )}
        </div>

        <ToastHost />

        <p className='mt-4 flex items-center justify-center gap-1.5 text-xs text-slate-400'>
          <ShieldCheck className='h-3.5 w-3.5' /> Demo authentication — no real
          accounts are used.
        </p>
      </div>
    </div>
  );
}
