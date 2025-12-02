
import { ThemeProvider } from '@/context/ThemeContext';
import { DataProvider } from '@/context/DataContext';
import { Layout } from '@/components/Layout';

interface AppProps {
  apiBase?: string;
  title?: string;
}

export function App({ apiBase = '/api', title = 'Pydantic UI' }: AppProps) {
  return (
    <ThemeProvider>
      <DataProvider apiBase={apiBase}>
        <Layout title={title} />
      </DataProvider>
    </ThemeProvider>
  );
}

export default App;
