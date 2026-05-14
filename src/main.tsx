import { createRoot } from 'react-dom/client';
import { bootstrapEnterAnalytics } from '@enter-pro/analytics-sdk';
import App from './App.tsx';
import './index.css';

bootstrapEnterAnalytics();

createRoot(document.getElementById('root')!).render(<App />);
