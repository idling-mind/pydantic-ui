
import { ThemeProvider } from '@/context/ThemeContext';
import { DataProvider } from '@/context/DataContext';
import { Layout } from '@/components/Layout';

interface AppProps {
  apiBase?: string;
}

export function App({ apiBase = '/api' }: AppProps) {
  return (
    <ThemeProvider>
      <DataProvider apiBase={apiBase}>
        <Layout />
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
