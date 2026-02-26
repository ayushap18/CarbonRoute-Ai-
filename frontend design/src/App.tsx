import React, { useState } from 'react';
import { FleetProvider } from './context/FleetContext';
import Sidebar from './components/Sidebar';
import DashboardPage from './pages/DashboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LedgerPage from './pages/LedgerPage';
import RevenuePage from './pages/RevenuePage';
import ChatPage from './pages/ChatPage';
import AlertsPage from './pages/AlertsPage';
import type { PageId } from './types';

function PageRouter({ page }: { page: PageId }) {
  switch (page) {
    case 'dashboard': return <DashboardPage />;
    case 'analytics': return <AnalyticsPage />;
    case 'ledger': return <LedgerPage />;
    case 'revenue': return <RevenuePage />;
    case 'chat': return <ChatPage />;
    case 'alerts': return <AlertsPage />;
  }
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<PageId>('dashboard');

  return (
    <FleetProvider>
      <div className="flex w-full h-screen overflow-hidden bg-background-dark text-slate-100 font-display">
        <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
        <div className="flex-1 flex flex-col h-screen overflow-hidden" key={currentPage}>
          <PageRouter page={currentPage} />
        </div>
      </div>
    </FleetProvider>
  );
}
