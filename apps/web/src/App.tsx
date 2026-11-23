import { Route, Routes } from 'react-router-dom';
import { AppShell, RequireAuth, ScrollToTop } from './components/Layout';
import Welcome from './screens/Welcome';
import Auth from './screens/Auth';
import Setup from './screens/Setup';
import Goals from './screens/Goals';
import Home from './screens/Home';
import Paths from './screens/Paths';
import PathScreen from './screens/PathScreen';
import Lesson from './screens/Lesson';
import SandboxScreen from './screens/SandboxScreen';
import Voice from './screens/Voice';
import Scam from './screens/Scam';
import Progress from './screens/Progress';
import Certificate from './screens/Certificate';
import Me from './screens/Me';
import Family from './screens/Family';
import Facilitator from './screens/Facilitator';
import Admin from './screens/Admin';
import Privacy from './screens/Privacy';
import Help from './screens/Help';
import Offline from './screens/Offline';
import DevTypography from './screens/DevTypography';
import NotFound from './screens/NotFound';

export function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Welcome />} />
          <Route path="auth" element={<Auth />} />
          <Route path="setup" element={<Setup />} />

          <Route element={<RequireAuth />}>
            <Route path="goals" element={<Goals />} />
            <Route path="home" element={<Home />} />
            <Route path="paths" element={<Paths />} />
            <Route path="paths/:slug" element={<PathScreen />} />
            <Route path="lessons/:slug" element={<Lesson />} />
            <Route path="sandbox" element={<SandboxScreen />} />
            <Route path="voice" element={<Voice />} />
            <Route path="scam" element={<Scam />} />
            <Route path="progress" element={<Progress />} />
            <Route path="certificate/:pathSlug" element={<Certificate />} />
            <Route path="me" element={<Me />} />
            <Route path="family" element={<Family />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="help" element={<Help />} />
            <Route path="offline" element={<Offline />} />
            <Route path="dev/typography" element={<DevTypography />} />
          </Route>

          <Route element={<RequireAuth roles={['ADMIN', 'FACILITATOR']} />}>
            <Route path="facilitator" element={<Facilitator />} />
          </Route>

          <Route element={<RequireAuth roles={['ADMIN']} />}>
            <Route path="admin" element={<Admin />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </>
  );
}

export default App;
