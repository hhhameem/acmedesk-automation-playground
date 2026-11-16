import { useEffect, useRef, useState } from 'react';
import { Save, Palette, Globe, Gauge, Plug, Truck, HelpCircle, PanelLeft, Cookie, Database, RotateCcw } from 'lucide-react';
import { useUIStore, type Density, type Theme, type SidebarMode } from '@/store/ui';
import { LOCALES } from '@/lib/i18n';
import { mockConfig, saveMockConfig } from '@/mocks/config';
import { apiPost } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@/store/toast';
import { Accordion } from '@/components/Accordion';
import { Modal } from '@/components/Modal';
import { CONSENT_RESET_EVENT } from '@/components/ConsentBanner';

export function Settings() {
  const { theme, setTheme, locale, setLocale, density, setDensity, sidebarMode, setSidebarMode } =
    useUIStore();
  const [latency, setLatency] = useState(mockConfig.latencyMs);
  const [failureRate, setFailureRate] = useState(Math.round(mockConfig.failureRate * 100));
  const [pageSize, setPageSize] = useState(mockConfig.pageSize);

  const vendorFrameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      // Only trust our own vendor iframe on our own origin; the page also embeds
      // a third-party site that could post look-alike messages.
      if (e.origin !== window.location.origin) return;
      if (!vendorFrameRef.current || e.source !== vendorFrameRef.current.contentWindow) return;
      if (e.data?.source === 'testdesk-vendor' && e.data?.type === 'status-refreshed') {
        toast.info(`Vendor status refreshed (in transit: ${e.data.payload?.transit})`);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  function applyMockConfig() {
    saveMockConfig({ latencyMs: latency, failureRate: failureRate / 100, pageSize });
    toast.success('Backend simulation updated');
  }

  const qc = useQueryClient();
  const [resetting, setResetting] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  async function resetDemoData() {
    setResetting(true);
    try {
      await apiPost('/api/admin/reset-data');
      await qc.invalidateQueries();
      toast.success({ title: 'Demo data reset', message: 'All open tabs now show the original data.' });
    } catch (e) {
      toast.error({ title: 'Reset failed', message: (e as Error).message });
    } finally {
      setResetting(false);
      setConfirmReset(false);
    }
  }

  function resetConsent() {
    try {
      localStorage.removeItem('testdesk-consent');
    } catch {
      // Storage blocked — the event below still re-shows the banner in this tab.
    }
    window.dispatchEvent(new Event(CONSENT_RESET_EVENT));
    toast.info('Consent banner reset');
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold" data-testid="page-title">
        Settings
      </h1>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <HelpCircle className="h-4 w-4" /> Help &amp; FAQ
        </h2>
        <Accordion
          testId="settings-accordion"
          items={[
            {
              id: 'sla',
              title: 'How are response SLAs calculated?',
              content: (
                <p>
                  SLAs are based on priority: urgent = 1h, high = 4h, medium = 24h, low = 72h.
                  Breaching tickets are highlighted in the ticket list.
                </p>
              ),
            },
            {
              id: 'export',
              title: 'What data is included in a CSV export?',
              content: (
                <p>
                  The export honours the active filters and columns: Ref, Subject, Status,
                  Priority, Category, Customer, Assignee and last updated date.
                </p>
              ),
            },
            {
              id: 'integrations',
              title: 'Which integrations are available?',
              content: (
                <p>
                  The warehouse provider (demoqa.com) and the ParcelPal vendor portal are embedded
                  here. Vendors sync stock and shipment status every 15 minutes.
                </p>
              ),
            },
          ]}
        />
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Palette className="h-4 w-4" /> Appearance
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label">Theme</span>
            <div className="flex gap-2">
              {(['light', 'dark'] as Theme[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  data-testid={`theme-${t}`}
                  onClick={() => setTheme(t)}
                  className={`btn ${theme === t ? 'btn-primary' : 'btn-secondary'} capitalize`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label" htmlFor="density">
              Density
            </label>
            <select
              id="density"
              className="input"
              value={density}
              onChange={(e) => setDensity(e.target.value as Density)}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" data-testid="save-appearance" onClick={() => toast.success('Appearance saved')}>
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Globe className="h-4 w-4" /> Language & region
        </h2>
        <label className="label" htmlFor="locale">
          Interface language
        </label>
        <select
          id="locale"
          className="input max-w-xs"
          data-testid="settings-locale"
          value={locale}
          onChange={(e) => setLocale(e.target.value as typeof locale)}
        >
          {LOCALES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.native} ({l.label})
            </option>
          ))}
        </select>
        <p className="mt-2 text-xs text-slate-400">
          Arabic switches the interface to right-to-left (RTL).
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" data-testid="save-language" onClick={() => toast.success('Language saved')}>
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <PanelLeft className="h-4 w-4" /> Navigation
        </h2>
        <fieldset data-testid="settings-sidebar-mode">
          <legend className="label">Sidebar (desktop)</legend>
          <div className="mt-1 space-y-2">
            {(
              [
                { value: 'pinned', label: 'Always open (pinned)', desc: 'Docked and always visible on desktop.' },
                { value: 'drawer', label: 'Collapsed (drawer)', desc: 'Hidden until opened from the ☰ button.' },
              ] as { value: SidebarMode; label: string; desc: string }[]
            ).map((opt) => (
              <label key={opt.value} className="flex cursor-pointer items-start gap-3">
                <input
                  type="radio"
                  name="sidebar-mode"
                  value={opt.value}
                  checked={sidebarMode === opt.value}
                  onChange={() => setSidebarMode(opt.value)}
                  data-testid={`settings-sidebar-mode-${opt.value}`}
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                />
                <span>
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    {opt.label}
                  </span>
                  <span className="block text-xs text-slate-400">{opt.desc}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="mt-3 text-xs text-slate-400">
          On desktop, keep the sidebar docked open, or collapse it into a drawer opened from the ☰
          button. Mobile always uses the drawer.
        </p>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" data-testid="save-navigation" onClick={() => toast.success('Navigation saved')}>
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Gauge className="h-4 w-4" /> Backend simulation
        </h2>
        <div className="space-y-4">
          <div>
            <label className="label" htmlFor="latency">
              Network latency: {latency} ms
            </label>
            <input
              id="latency"
              type="range"
              min={0}
              max={3000}
              step={50}
              value={latency}
              onChange={(e) => setLatency(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="label" htmlFor="failure">
              Failure rate: {failureRate}%
            </label>
            <input
              id="failure"
              type="range"
              min={0}
              max={100}
              step={5}
              value={failureRate}
              onChange={(e) => setFailureRate(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div>
            <label className="label" htmlFor="pagesize">
              Page size
            </label>
            <input
              id="pagesize"
              type="number"
              min={5}
              max={100}
              className="input max-w-32"
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <button type="button" className="btn-primary" data-testid="save-simulation" onClick={applyMockConfig}>
            <Save className="h-4 w-4" /> Save
          </button>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Database className="h-4 w-4" /> Demo data
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Tickets, orders, inventory and other records are saved in this browser and shared by all
          open tabs, so changes survive a reload. Reset to go back to the original data. Automation
          can also open any page with <code className="font-mono text-xs">?reset=1</code> to start clean.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn-secondary text-sm"
            data-testid="reset-demo-data"
            onClick={() => setConfirmReset(true)}
            disabled={resetting}
          >
            <RotateCcw className="h-4 w-4" /> Reset demo data
          </button>
        </div>
        <Modal
          open={confirmReset}
          onClose={() => !resetting && setConfirmReset(false)}
          title="Reset demo data?"
          size="sm"
          testId="reset-demo-data-modal"
          footer={
            <>
              <button
                type="button"
                className="btn-secondary"
                data-testid="reset-demo-data-cancel"
                disabled={resetting}
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger"
                data-testid="reset-demo-data-confirm"
                disabled={resetting}
                onClick={resetDemoData}
              >
                {resetting ? 'Resetting…' : 'Reset data'}
              </button>
            </>
          }
        >
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Every ticket, customer, order, shipment, return, comment and notification goes back to
            its original seed state in all open tabs. Your sign-in, preferences and backend
            simulation settings are kept.
          </p>
        </Modal>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Cookie className="h-4 w-4" /> Privacy &amp; consent
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your cookie choice is stored in local storage. Reset it to show the consent banner again
          right away — handy for practising the overlay/occlusion scenario.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn-secondary text-sm"
            data-testid="reset-consent"
            onClick={resetConsent}
          >
            Reset consent banner
          </button>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Plug className="h-4 w-4" /> Integration
          </h2>
          <span className="text-xs text-slate-400">demoqa.com (external site)</span>
        </div>
        <iframe
          title="Third-party integration"
          data-testid="integration-iframe"
          src="https://demoqa.com/"
          className="h-96 w-full border-t border-slate-200 bg-white dark:border-slate-700"
        />
      </section>

      <section className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 pb-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Truck className="h-4 w-4" /> Vendor portal
          </h2>
          <span className="text-xs text-slate-400">nested iframe</span>
        </div>
        <iframe
          ref={vendorFrameRef}
          title="ParcelPal vendor portal"
          data-testid="vendor-iframe"
          src="/embed/vendor.html"
          className="h-[32rem] w-full border-t border-slate-200 bg-slate-100 dark:border-slate-700"
        />
        <p className="bg-slate-50 px-5 py-2.5 text-xs text-slate-500 dark:bg-slate-800/60 dark:text-slate-400">
          The portal (level 1) embeds a status widget (level 2). Clicking{" "}
          <code className="rounded bg-slate-200 px-1 dark:bg-slate-700">Refresh status</code> inside
          the innermost frame relays a message through both iframe levels to this page.
        </p>
      </section>
    </div>
  );
}
