/* Routes of both flavours. The campaign app is served by the Pi, which
   answers every path with the app (browser history); the Quick Build lives
   on GitHub Pages, which cannot, so it keeps the route after a "#". */
import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Route, Routes } from 'react-router';
import { FLAVOUR } from '../flavour.ts';
import { Home } from '../routes/Home.tsx';
import { More } from '../routes/More.tsx';
import { Placeholder } from '../routes/Placeholder.tsx';
import { Warbands } from '../routes/Warbands.tsx';
import { Shell } from './Shell.tsx';

// the roster needs the rules: loaded when first opened
const Roster = lazy(() => import('../routes/Roster.tsx').then((m) => ({ default: m.Roster })));
const NewWarband = lazy(() => import('../routes/NewWarband.tsx').then((m) => ({ default: m.NewWarband })));
const Export = lazy(() => import('../routes/Export.tsx').then((m) => ({ default: m.Export })));
const TradingPost = lazy(() => import('../routes/TradingPost.tsx').then((m) => ({ default: m.TradingPost })));
const Hire = lazy(() => import('../routes/Hire.tsx').then((m) => ({ default: m.Hire })));
const HouseRules = lazy(() => import('../routes/HouseRules.tsx').then((m) => ({ default: m.HouseRules })));

export function AppRoutes() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/warbands" element={<Warbands />} />
          <Route path="/warbands/new" element={<NewWarband />} />
          <Route path="/warbands/:id" element={<Roster />} />
          <Route path="/warbands/:id/export" element={<Export />} />
          <Route path="/warbands/:id/trade" element={<TradingPost />} />
          <Route path="/warbands/:id/hire" element={<Hire />} />
          <Route path="/warbands/:id/house" element={<HouseRules />} />
          {FLAVOUR === 'campaign' && <Route path="/campaign" element={<Placeholder title="Campaign" text="Campaigns, battles and the map arrive with the campaign server." />} />}
          {FLAVOUR === 'campaign' && <Route path="/notes" element={<Placeholder title="Notes" text="Notes, quotes and the timeline arrive with the campaign server." />} />}
          <Route path="/more" element={<More />} />
          <Route path="*" element={<Placeholder title="Not found" text="There is nothing at this address." />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}

export function App() {
  const Router = FLAVOUR === 'quickbuild' ? HashRouter : BrowserRouter;
  return <Router basename={FLAVOUR === 'quickbuild' ? undefined : import.meta.env.BASE_URL}><AppRoutes /></Router>;
}
