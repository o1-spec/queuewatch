import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const setCookie = (name: string, value: string, days = 7) => {
  if (typeof window === 'undefined') return;
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax; Secure`;
};

const getCookie = (name: string): string | null => {
  if (typeof window === 'undefined') return null;
  return document.cookie.split('; ').reduce((r, v) => {
    const parts = v.split('=');
    return parts[0] === name ? decodeURIComponent(parts[1] || '') : r;
  }, null as string | null);
};

const deleteCookie = (name: string) => {
  if (typeof window === 'undefined') return;
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax; Secure`;
};

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

interface AuthContextType {
  user: UserProfile | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<UserProfile>;
  register: (name: string, email: string, password: string) => Promise<UserProfile>;
  logout: () => void;
  isAuthenticated: () => boolean;
  authFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const storedToken = getCookie('queuewatch_token');
      const storedUser = localStorage.getItem('queuewatch_user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (e) {
      console.error('Failed to load session from session storage:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string): Promise<UserProfile> => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      let parsedError = 'Invalid credentials.';
      try {
        parsedError = JSON.parse(errorMsg).message || parsedError;
      } catch {}
      throw new Error(parsedError);
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);

    setCookie('queuewatch_token', data.token);
    localStorage.setItem('queuewatch_user', JSON.stringify(data.user));

    return data.user;
  };

  const register = async (name: string, email: string, password: string): Promise<UserProfile> => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      let parsedError = 'Registration failed.';
      try {
        parsedError = JSON.parse(errorMsg).message || parsedError;
      } catch {}
      throw new Error(parsedError);
    }

    const data = await res.json();
    setToken(data.token);
    setUser(data.user);

    setCookie('queuewatch_token', data.token);
    localStorage.setItem('queuewatch_user', JSON.stringify(data.user));

    return data.user;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    deleteCookie('queuewatch_token');
    localStorage.removeItem('queuewatch_user');
  };

  const isAuthenticated = () => {
    return !!token;
  };

  const authFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const activeToken = token || getCookie('queuewatch_token');
    
    const headers = new Headers(init?.headers || {});
    if (activeToken) {
      headers.set('Authorization', `Bearer ${activeToken}`);
    }

    return fetch(input, {
      ...init,
      headers,
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, isAuthenticated, authFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
