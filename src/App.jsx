import { BrowserRouter, Routes, Route, Navigate, useSearchParams } from 'react-router-dom'
import { isValidNfcTagId } from './lib/nfcTag'
import { NfcPlantRoute, HomeRoute } from './pages/NfcPlantRoute'

function HomeEntry() {
  const [searchParams] = useSearchParams()
  const q = searchParams.get('plant')
  if (q && isValidNfcTagId(q)) {
    return <Navigate to={`/plant/${encodeURIComponent(q.trim())}`} replace />
  }
  return <HomeRoute />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomeEntry />} />
        <Route path="/plant/:tagId" element={<NfcPlantRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
