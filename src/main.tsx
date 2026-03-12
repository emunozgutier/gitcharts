import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log('Main.tsx: Initializing React app...');

console.log('Main.tsx: Rendering App...');

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  console.log('Main.tsx: Render called');
} else {
  console.error('Main.tsx: Root element not found!');
}
