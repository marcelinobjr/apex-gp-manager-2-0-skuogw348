import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import ProtectedRoute from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import Index from '@/pages/Index'
import NotFound from '@/pages/NotFound'
import { AuthPage, TokenPage } from '@/pages/AuthPages'
import {
  CircuitsPage,
  Dashboard,
  DriversPage,
  EnginesPage,
  StructuresPage,
  TeamsPage,
} from '@/pages/GamePages'
import CreateCareerWizard from '@/pages/CreateCareerPage'

const Protected = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>{children}</ProtectedRoute>
)
export default function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner richColors />
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/signup" element={<AuthPage mode="signup" />} />
              <Route path="/verify-email" element={<TokenPage type="verify" />} />
              <Route path="/forgot-password" element={<AuthPage mode="forgot" />} />
              <Route path="/reset-password" element={<AuthPage mode="reset" />} />
              <Route path="/confirm-email-change" element={<TokenPage type="email" />} />
              <Route
                path="/painel"
                element={
                  <Protected>
                    <Dashboard />
                  </Protected>
                }
              />
              <Route
                path="/carreira/nova"
                element={
                  <Protected>
                    <CreateCareerWizard />
                  </Protected>
                }
              />
              <Route
                path="/circuitos"
                element={
                  <Protected>
                    <CircuitsPage />
                  </Protected>
                }
              />
              <Route
                path="/equipes"
                element={
                  <Protected>
                    <TeamsPage />
                  </Protected>
                }
              />
              <Route
                path="/pilotos"
                element={
                  <Protected>
                    <DriversPage />
                  </Protected>
                }
              />
              <Route
                path="/motores"
                element={
                  <Protected>
                    <EnginesPage />
                  </Protected>
                }
              />
              <Route
                path="/estruturas"
                element={
                  <Protected>
                    <StructuresPage />
                  </Protected>
                }
              />
            </Route>
            <Route path="/inicio" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  )
}
