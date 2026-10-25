/* Routes of both flavours. The campaign app is served by the Pi, which
   answers every path with the app (browser history); the Quick Build lives
   on GitHub Pages, which cannot, so it keeps the route after a "#". */
import { lazy, Suspense } from 'react';
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router';
import { FLAVOUR } from '../flavour.ts';
import { ACCOUNT, HOME, MY_REPORTS } from './paths.ts';
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
const Districts = lazy(() => import('../routes/Districts.tsx').then((m) => ({ default: m.Districts })));
const Story = lazy(() => import('../story/Story.tsx').then((m) => ({ default: m.Story })));
// accounts: only the campaign app has a server (phase 3g)
const SignIn = lazy(() => import('../account/SignIn.tsx').then((m) => ({ default: m.SignIn })));
const LinkAccept = lazy(() => import('../account/LinkAccept.tsx').then((m) => ({ default: m.LinkAccept })));
const Admin = lazy(() => import('../account/Admin.tsx').then((m) => ({ default: m.Admin })));
const Library = lazy(() => import('../library/Library.tsx').then((m) => ({ default: m.Library })));
const MyReports = lazy(() => import('../bugs/MyReports.tsx').then((m) => ({ default: m.MyReports })));
// warbands on the server (phase 3h)
const Versions = lazy(() => import('../routes/Versions.tsx').then((m) => ({ default: m.Versions })));
const ImportLink = lazy(() => import('../routes/ImportLink.tsx').then((m) => ({ default: m.ImportLink })));
// campaigns (phase 4a)
const Campaigns = lazy(() => import('../campaign/Campaigns.tsx').then((m) => ({ default: m.Campaigns })));
const Campaign = lazy(() => import('../campaign/Campaign.tsx').then((m) => ({ default: m.Campaign })));
const CampaignWarband = lazy(() => import('../campaign/CampaignWarband.tsx').then((m) => ({ default: m.CampaignWarband })));
const Battle = lazy(() => import('../battle/Battle.tsx').then((m) => ({ default: m.Battle })));
const Aftermath = lazy(() => import('../aftermath/Aftermath.tsx').then((m) => ({ default: m.Aftermath })));
const CampaignRules = lazy(() => import('../campaign/CampaignRules.tsx').then((m) => ({ default: m.CampaignRules })));

export function AppRoutes() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Navigate to={HOME} replace />} />
          <Route path={HOME} element={<Home />} />
          <Route path="/warbands" element={<Warbands />} />
          <Route path="/warbands/new" element={<NewWarband />} />
          <Route path="/warbands/:id" element={<Roster />} />
          <Route path="/warbands/:id/export" element={<Export />} />
          <Route path="/warbands/:id/trade" element={<TradingPost />} />
          <Route path="/warbands/:id/hire" element={<Hire />} />
          <Route path="/warbands/:id/house" element={<HouseRules />} />
          <Route path="/warbands/:id/districts" element={<Districts />} />
          <Route path="/warbands/:id/story" element={<Story />} />
          {FLAVOUR === 'campaign' && <Route path="/campaign" element={<Campaigns />} />}
          {FLAVOUR === 'campaign' && <Route path="/campaign/:id" element={<Campaign />} />}
          {FLAVOUR === 'campaign' && <Route path="/campaign/:id/warbands/:wid" element={<CampaignWarband />} />}
          {FLAVOUR === 'campaign' && <Route path="/campaign/:id/battles/:bid" element={<Battle />} />}
          {FLAVOUR === 'campaign' && <Route path="/campaign/:id/house-rules" element={<CampaignRules />} />}
          {FLAVOUR === 'campaign' && <Route path="/campaign/:id/:tab" element={<Campaign />} />}
          {/* the old address of the Notes tab: notes are a section of each campaign */}
          {FLAVOUR === 'campaign' && <Route path="/notes" element={<Navigate to="/campaign" replace />} />}
          {FLAVOUR === 'campaign' && <Route path="/sign-in" element={<SignIn />} />}
          {FLAVOUR === 'campaign' && <Route path="/invite" element={<LinkAccept />} />}
          {FLAVOUR === 'campaign' && <Route path="/reset" element={<LinkAccept />} />}
          {FLAVOUR === 'campaign' && <Route path="/admin" element={<Admin />} />}
          {FLAVOUR === 'campaign' && <Route path="/admin/:tab" element={<Admin />} />}
          {FLAVOUR === 'campaign' && <Route path="/warbands/:id/versions" element={<Versions />} />}
          {FLAVOUR === 'campaign' && <Route path="/warbands/:id/aftermath/:bid" element={<Aftermath />} />}
          {FLAVOUR === 'campaign' && <Route path="/import" element={<ImportLink />} />}
          <Route path={ACCOUNT} element={<More />} />
          <Route path="/more" element={<Navigate to={ACCOUNT} replace />} />
          {FLAVOUR === 'campaign' && <Route path="/library" element={<Navigate to="/library/ideas" replace />} />}
          {FLAVOUR === 'campaign' && <Route path="/library/:tab" element={<Library />} />}
          {FLAVOUR === 'campaign' && <Route path={MY_REPORTS} element={<MyReports />} />}
          {FLAVOUR === 'campaign' && <Route path="/more/reports" element={<Navigate to={MY_REPORTS} replace />} />}
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
