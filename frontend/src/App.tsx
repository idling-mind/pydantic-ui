
import { ThemeProvider } from '@/context/ThemeContext';
import { DataProvider, useData } from '@/context/DataContext';
import { ClipboardProvider } from '@/context/ClipboardContext';
import { EventProvider } from '@/context/EventContext';
import { Layout } from '@/components/Layout';
import { ToastContainer } from '@/components/ToastContainer';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';
import { useEffect } from 'react';

interface AppProps {
  apiBase?: string;
}

// Inner component that has access to DataContext
function AppContent() {
  const { 
    setExternalErrors, 
    clearErrors, 
    setExternalData, 
    refresh,
    apiBase,
    config,
  } = useData();

  // Set document title based on config
  useEffect(() => {
    if (config?.title) {
      document.title = config.title;
    }
  }, [config?.title]);

  return (
    <EventProvider
      apiBase={apiBase}
      onValidationErrors={setExternalErrors}
      onClearErrors={clearErrors}
      onDataPush={setExternalData}
      onRefresh={refresh}
    >
      <ClipboardProvider>
        <Layout />
        <ToastContainer />
        <ConfirmationDialog />
      </ClipboardProvider>
    </EventProvider>
  );
}

export function App({ apiBase = '/api' }: AppProps) {
  return (
    <ThemeProvider>
      <DataProvider apiBase={apiBase}>
        <AppContent />
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
