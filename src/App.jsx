import { HashRouter, Route, Routes } from 'react-router-dom'
import { GroupRoutingBootstrap } from './context/GroupRoutingBootstrap'
import { DevGroupShortcuts } from './components/DevGroupShortcuts'
import { RootBootstrap } from './pages/RootBootstrap'
import { GroupDashboardPage } from './pages/GroupDashboardPage'
import { GroupPlantPage } from './pages/GroupPlantPage'
import { GroupSetupPage } from './pages/GroupSetupPage'
import { LegacyPlantToGroupRedirect } from './pages/LegacyPlantToGroupRedirect'

export default function App() {
  return (
    <HashRouter>
      <GroupRoutingBootstrap>
        <Routes>
          <Route path="/" element={<RootBootstrap />} />
          <Route
            path="/plant/:legacyId"
            element={<LegacyPlantToGroupRedirect />}
          />
          <Route path="/group/:groupId" element={<GroupDashboardPage />} />
          <Route path="/group/:groupId/setup" element={<GroupSetupPage />} />
          <Route
            path="/group/:groupId/plant/:plantId"
            element={<GroupPlantPage />}
          />
        </Routes>
        <DevGroupShortcuts />
      </GroupRoutingBootstrap>
    </HashRouter>
  )
}
