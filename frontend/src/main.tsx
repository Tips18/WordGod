import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * `bootstrapFrontend` 将 React 应用挂载到浏览器页面。
 */
function bootstrapFrontend() {
  const container = document.getElementById('root');

  if (!container) {
    throw new Error('Root container not found');
  }

  createRoot(container).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

bootstrapFrontend();

