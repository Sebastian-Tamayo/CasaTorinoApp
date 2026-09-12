import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth'
import { Topbar } from './components/Topbar'
import { StaffPage } from './pages/StaffPage'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Topbar />
        <Routes>
          <Route path="/" element={<StaffPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
