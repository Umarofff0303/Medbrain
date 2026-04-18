import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import 'antd/dist/reset.css';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#3b82f6',
          colorBgBase: '#0b1120',
          colorBgContainer: '#131c31',
          colorBgElevated: '#1e293b',
          borderRadius: 16,
          fontFamily: "'Outfit', 'Inter', sans-serif",
          colorTextBase: '#f8fafc'
        }
      }}
    >
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  </StrictMode>
);
