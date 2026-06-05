import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project } from '@queuewatch/shared';

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
  projects: Project[];
  projectsLoaded: boolean;
  activeProjectId: string | null;
  activeProject: Project | null;
  setActiveProjectId: (projectId: string | null) => void;
  fetchProjects: () => Promise<Project[]>;
  createProject: (name: string) => Promise<Project>;
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [activeProjectId, setActiveProjectIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  const setActiveProjectId = (id: string | null) => {
    setActiveProjectIdState(id);
    if (id) {
      localStorage.setItem('queuewatch_active_project_id', id);
    } else {
      localStorage.removeItem('queuewatch_active_project_id');
    }
  };

  useEffect(() => {
    try {
      const storedToken = getCookie('queuewatch_token');
      const storedUser = localStorage.getItem('queuewatch_user');
      const storedActiveProjectId = localStorage.getItem('queuewatch_active_project_id');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        if (storedActiveProjectId) {
          setActiveProjectIdState(storedActiveProjectId);
        }
      } else {
        setProjectsLoaded(true); // not logged in, nothing to load
      }
    } catch (e) {
      console.error('Failed to load session from session storage:', e);
      setProjectsLoaded(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProjects = async (): Promise<Project[]> => {
    const activeToken = token || getCookie('queuewatch_token');
    if (!activeToken) {
      setProjectsLoaded(true);
      return [];
    }
    try {
      const res = await fetch(`${API_URL}/api/projects`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data: Project[] = await res.json();
      setProjects(data);

      let currentActiveId = activeProjectId;
      if (!currentActiveId && data.length > 0) {
        // Find if localstorage had one
        const storedActiveProjectId = localStorage.getItem('queuewatch_active_project_id');
        if (storedActiveProjectId && data.some(p => p.id === storedActiveProjectId)) {
          currentActiveId = storedActiveProjectId;
        } else {
          currentActiveId = data[0].id;
        }
      }
      if (currentActiveId && !data.some(p => p.id === currentActiveId)) {
        currentActiveId = data.length > 0 ? data[0].id : null;
      }

      setActiveProjectId(currentActiveId);
      return data;
    } catch (err) {
      console.error('fetchProjects error:', err);
      return [];
    } finally {
      setProjectsLoaded(true);
    }
  };

  useEffect(() => {
    if (token) {
      fetchProjects();
    } else {
      setProjects([]);
      setActiveProjectIdState(null);
      setProjectsLoaded(true); // reset
    }
  }, [token]);

  const createProject = async (name: string): Promise<Project> => {
    const res = await authFetch(`${API_URL}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!res.ok) {
      const errorMsg = await res.text();
      let parsedError = 'Failed to create project.';
      try {
        parsedError = JSON.parse(errorMsg).message || parsedError;
      } catch {}
      throw new Error(parsedError);
    }

    const data: Project = await res.json();
    setProjects(prev => [...prev, data]);
    setActiveProjectId(data.id);
    return data;
  };

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
    setProjects([]);
    setActiveProjectIdState(null);
    setProjectsLoaded(false);
    deleteCookie('queuewatch_token');
    localStorage.removeItem('queuewatch_user');
    localStorage.removeItem('queuewatch_active_project_id');
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
    if (activeProjectId) {
      headers.set('x-project-id', activeProjectId);
    }

    return fetch(input, {
      ...init,
      headers,
    });
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      projects,
      projectsLoaded,
      activeProjectId,
      activeProject,
      setActiveProjectId,
      fetchProjects,
      createProject,
      login,
      register,
      logout,
      isAuthenticated,
      authFetch
    }}>
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
