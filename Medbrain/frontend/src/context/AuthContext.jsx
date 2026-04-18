import { useEffect, useMemo, useState } from 'react';
import { authApi } from '../lib/api';
import { AuthContext } from './authStore';

const STORAGE_KEY = 'medbrain_auth';

function readStoredAuth() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { token: '', user: null };
    const parsed = JSON.parse(raw);
    return { token: parsed.token || '', user: parsed.user || null };
  } catch {
    return { token: '', user: null };
  }
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(readStoredAuth);
  const [isLoading, setIsLoading] = useState(Boolean(auth.token && !auth.user));

  useEffect(() => {
    if (!auth.token || auth.user) return;

    let cancelled = false;

    authApi
      .me(auth.token)
      .then((response) => {
        if (cancelled) return;
        const user = response.user
          ? {
              id: response.user.id,
              role: response.user.role,
              username: response.user.username,
              fullName: response.user.fullName,
              subjectName: response.user.subjectName || null,
              facultyId: response.user.facultyId || null,
              directionId: response.user.directionId || null
            }
          : null;

        setAuth({ token: auth.token, user });
      })
      .catch(() => {
        if (cancelled) return;
        setAuth({ token: '', user: null });
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auth.token, auth.user]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
  }, [auth]);

  async function login({ username, password, role }) {
    const response = await authApi.login({ username, password, role });
    setAuth({ token: response.token, user: response.user });
    return response.user;
  }

  async function register({ username, password, fullName }) {
    const response = await authApi.register({ username, password, fullName });
    setAuth({ token: response.token, user: response.user });
    return response.user;
  }

  function updateUser(nextUser) {
    setAuth((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...nextUser } : prev.user
    }));
  }

  function logout() {
    setAuth({ token: '', user: null });
  }

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      role: auth.user?.role || null,
      isAuthenticated: Boolean(auth.token && auth.user),
      isLoading,
      login,
      register,
      updateUser,
      logout
    }),
    [auth.token, auth.user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
