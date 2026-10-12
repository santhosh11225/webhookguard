import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './context/ToastContext';
import { PublicLayout } from './layouts/PublicLayout';
import { DashboardLayout } from './layouts/DashboardLayout';

import { LandingPage } from './pages/LandingPage';
import { DashboardPage } from './pages/DashboardPage';
import { EndpointsPage } from './pages/EndpointsPage';
import { TestSuitesPage } from './pages/TestSuitesPage';
import { TestRunsPage } from './pages/TestRunsPage';
import { TestRunDetailPage } from './pages/TestRunDetailPage';
import { ReportsPage } from './pages/ReportsPage';
import { CicdGuidePage } from './pages/CicdGuidePage';

export function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Landing Page */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<LandingPage />} />
          </Route>

          {/* Authenticated / Console Dashboard */}
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/endpoints" element={<EndpointsPage />} />
            <Route path="/suites" element={<TestSuitesPage />} />
            <Route path="/runs" element={<TestRunsPage />} />
            <Route path="/runs/:id" element={<TestRunDetailPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/:runId" element={<ReportsPage />} />
            <Route path="/monitoring" element={<Navigate to="/dashboard" replace />} />
            <Route path="/cicd" element={<CicdGuidePage />} />
          </Route>

          {/* Catch-all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
