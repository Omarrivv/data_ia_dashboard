'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@/types';
import { authApi } from '@/lib/api';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initialize auth state from secure httpOnly cookie session
  useEffect(() => {
    const initAuth = async () => {
      try {
        const response = await authApi.getProfile();
        if (response.data.success && response.data.data) {
          setUser(response.data.data);
        } else {
          clearAuth();
        }
      } catch (error) {
        // Session missing/expired is expected; keep user as unauthenticated.
        clearAuth();
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  const clearAuth = () => {
    setUser(null);
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await authApi.login({ email, password });
      
      if (response.data.success && response.data.data) {
        setUser(response.data.data.user);
        toast.success('¡Bienvenido de vuelta!');
      } else {
        throw new Error(response.data.message || 'Error al iniciar sesión');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Error al iniciar sesión';
      toast.error(message);
      throw error;
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      const response = await authApi.register({ name, email, password });
      
      if (response.data.success && response.data.data) {
        setUser(response.data.data.user);
        toast.success('¡Cuenta creada exitosamente!');
      } else {
        throw new Error(response.data.message || 'Error al registrarse');
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message || 'Error al registrarse';
      toast.error(message);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch (error) {
      // If backend is unavailable, still clear local auth state.
    } finally {
      clearAuth();
      toast.success('Sesión cerrada correctamente');
    }
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
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