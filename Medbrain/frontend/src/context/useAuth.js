import { useContext } from 'react';
import { AuthContext } from './authStore';

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth AuthProvider ichida ishlatilishi kerak.');
  }

  return context;
}