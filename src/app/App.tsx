import { Suspense, lazy, useEffect, type ComponentType } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './Layout';
import { RequireAuth } from './RequireAuth';
import { Login } from '@/pages/Login';
import { PracticeLayout } from '@/features/practice/PracticeLayout';
import { applyDocumentChrome, useUIStore } from '@/store/ui';
import { PageSkeleton } from '@/components/Skeleton';

/**
 * Load a page only when its route is visited, so the first load ships just the
 * app shell (pages export named components, hence the small adapter).
 */
function lazyPage<K extends string>(load: () => Promise<Record<K, ComponentType>>, name: K) {
  return lazy(() => load().then((m) => ({ default: m[name] })));
}

const Inbox = lazyPage(() => import('@/pages/Inbox'), 'Inbox');
const ElementLab = lazyPage(() => import('@/pages/ElementLab'), 'ElementLab');
const Dashboard = lazyPage(() => import('@/pages/Dashboard'), 'Dashboard');
const Tickets = lazyPage(() => import('@/pages/Tickets'), 'Tickets');
const TicketDetail = lazyPage(() => import('@/pages/TicketDetail'), 'TicketDetail');
const NewTicketWizard = lazyPage(() => import('@/pages/NewTicketWizard'), 'NewTicketWizard');
const Customers = lazyPage(() => import('@/pages/Customers'), 'Customers');
const CustomerDetail = lazyPage(() => import('@/pages/CustomerDetail'), 'CustomerDetail');
const Inventory = lazyPage(() => import('@/pages/Inventory'), 'Inventory');
const Orders = lazyPage(() => import('@/pages/Orders'), 'Orders');
const NewOrder = lazyPage(() => import('@/pages/NewOrder'), 'NewOrder');
const OrderDetail = lazyPage(() => import('@/pages/OrderDetail'), 'OrderDetail');
const Shipments = lazyPage(() => import('@/pages/Shipments'), 'Shipments');
const Returns = lazyPage(() => import('@/pages/Returns'), 'Returns');
const Reports = lazyPage(() => import('@/pages/Reports'), 'Reports');
const Settings = lazyPage(() => import('@/pages/Settings'), 'Settings');
const Profile = lazyPage(() => import('@/pages/Profile'), 'Profile');
const Capabilities = lazyPage(() => import('@/pages/Capabilities'), 'Capabilities');
const ChallengeHub = lazyPage(() => import('@/pages/ChallengeHub'), 'ChallengeHub');
const ChallengeDetail = lazyPage(() => import('@/pages/ChallengeDetail'), 'ChallengeDetail');
const NotFound = lazyPage(() => import('@/pages/NotFound'), 'NotFound');
const PopoutWidget = lazyPage(() => import('@/pages/PopoutWidget'), 'PopoutWidget');
const EmbeddedAnalytics = lazyPage(() => import('@/pages/EmbeddedAnalytics'), 'EmbeddedAnalytics');


function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  const theme = useUIStore((s) => s.theme);
  const locale = useUIStore((s) => s.locale);

  useEffect(() => {
    applyDocumentChrome(theme, locale);
  }, [theme, locale]);

  return (
    <>
      <ScrollToTop />
      {/* Pages outside the main layout (login, inbox, pop-out, embeds) while their code loads. */}
      <Suspense fallback={<PageSkeleton fullscreen />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Public demo mailbox that receives sign-in one-time codes */}
        <Route path="/inbox" element={<Inbox />} />
        {/* Public practice labs: no sign-in, their own header instead of the app shell */}
        <Route element={<PracticeLayout />}>
          <Route path="/elements" element={<ElementLab />} />
          <Route path="/elements/:slug" element={<ElementLab />} />
          <Route path="/challenges" element={<ChallengeHub />} />
          <Route path="/challenges/:slug" element={<ChallengeDetail />} />
        </Route>
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            {/* "/" is the static landing page (index.html); if the app is ever served there, go to the dashboard. */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/new" element={<NewTicketWizard />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<NewOrder />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/returns" element={<Returns />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/capabilities" element={<Capabilities />} />
            <Route path="/404" element={<NotFound />} />
            <Route path="*" element={<Navigate to="/404" replace />} />
          </Route>
          {/* Routes rendered outside the main chrome (opened in new window/tab) */}
          <Route path="/popout/widget" element={<PopoutWidget />} />
          {/* Loaded inside the Dashboard's "Embedded analytics" iframe */}
          <Route path="/embed/analytics" element={<EmbeddedAnalytics />} />
        </Route>
      </Routes>
      </Suspense>
    </>
  );
}
