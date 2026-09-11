"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { AuthUser, SignUpDto, SignInDto } from "@/backend/src/modules/auth/auth.types";
import { authClient, AuthClientError } from "@/lib/api/auth-client";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  signIn: (dto: SignInDto) => Promise<{ success: boolean; error?: AuthClientError }>;
  signUp: (dto: SignUpDto) => Promise<{ success: boolean; error?: AuthClientError }>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    setIsLoading(true);
    const { data } = await authClient.getMe();
    setUser(data || null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    authClient.getMe().then(({ data }) => {
      if (isMounted) {
        setUser(data || null);
        setIsLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSignIn = async (dto: SignInDto) => {
    setIsLoading(true);
    const { data, error } = await authClient.signIn(dto);
    if (data?.user) {
      setUser(data.user);
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, error: error || undefined };
  };

  const handleSignUp = async (dto: SignUpDto) => {
    setIsLoading(true);
    const { data, error } = await authClient.signUp(dto);
    if (data?.user) {
      setUser(data.user);
      setIsLoading(false);
      return { success: true };
    }
    setIsLoading(false);
    return { success: false, error: error || undefined };
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    await authClient.signOut();
    setUser(null);
    setIsLoading(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn: handleSignIn,
        signUp: handleSignUp,
        signOut: handleSignOut,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
