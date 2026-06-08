// =====================================================
// App.tsx — корневой компонент, маршрутизация между страницами
// =====================================================

import { useEffect, useState } from 'react';
import { AppProvider, useApp } from './lib/store';
import { Layout, type PageId } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { SchedulePage } from './pages/SchedulePage';
import { LibraryPage } from './pages/LibraryPage';
import { RecorderPage } from './pages/RecorderPage';
import { BroadcastPage } from './pages/BroadcastPage';
import { LogsPage } from './pages/LogsPage';
import { SettingsPage } from './pages/SettingsPage';
import { scheduler } from './lib/scheduler';

function Shell() {
  const [page, setPage] = useState<PageId>('dashboard');
  const { state } = useApp();

  // Держим планировщик в синхронизации с актуальным состоянием
  useEffect(() => {
    scheduler.setState(state);
    scheduler.rebuild();
  }, [state]);

  // Периодически перепланируем (на случай долгого простоя)
  useEffect(() => {
    const id = setInterval(() => {
      if (state.settings.serviceEnabled) {
        scheduler.setState(state);
        scheduler.rebuild();
      }
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, [state.settings.serviceEnabled]);

  return (
    <Layout current={page} onNavigate={setPage}>
      {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
      {page === 'schedule' && <SchedulePage />}
      {page === 'library' && <LibraryPage />}
      {page === 'recorder' && <RecorderPage />}
      {page === 'broadcast' && <BroadcastPage />}
      {page === 'logs' && <LogsPage />}
      {page === 'settings' && <SettingsPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
