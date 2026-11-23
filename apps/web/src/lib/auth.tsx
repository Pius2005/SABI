import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthTokens, Lang, PublicUser } from '@sabi/shared';
import {
  apiFetch,
  clearAuth,
  currentSession,
  setSessionFromTokens,
  subscribeSession,
  updateSessionUser,
} from './api';
import { hydrateProgress } from './offline';
import { useSettings } from './settings';

interface OtpRequestResult {
  resendIn: number;
  devCode?: string;
}

interface OtpVerifyInput {
  phone: string;
  code: string;
  displayName?: string;
  lang?: Lang;
  goalPathSlug?: string;
  agree?: boolean;
  helper?: boolean;
}

interface VerifyResult {
  isNew: boolean;
  user: PublicUser;
}

interface AuthValue {
  user: PublicUser | null;
  loading: boolean;
  requestOtp: (phone: string, displayName?: string, lang?: Lang) => Promise<OtpRequestResult>;
  verifyOtp: (input: OtpVerifyInput) => Promise<VerifyResult>;
  staffLogin: (email: string, password: string) => Promise<PublicUser>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<PublicUser | null>;
  setUser: (user: PublicUser) => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { updateSettings } = useSettings();
  const [user, setUserState] = useState<PublicUser | null>(() => currentSession()?.user ?? null);
  const [loading, setLoading] = useState(() => Boolean(currentSession()));

  useEffect(() => {
    return subscribeSession((session) => {
      setUserState(session?.user ?? null);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!currentSession()) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    apiFetch<{ user: PublicUser }>('/me')
      .then((response) => {
        if (cancelled) return;
        setUserState(response.user);
        updateSessionUser(response.user);
        void hydrateProgress(response.user.id).catch(() => undefined);
      })
      .catch(() => {
        if (!cancelled) setUserState(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    updateSettings(
      {
        preferredLang: user.preferredLang,
        textSize: user.textSize,
        theme: user.theme,
        reduceMotion: user.reduceMotion,
      },
      { remote: false },
    );
    // Only apply the server profile when the signed-in account changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const requestOtp = useCallback(async (phone: string, displayName?: string, lang?: Lang) => {
    return apiFetch<OtpRequestResult>('/auth/otp/request', {
      method: 'POST',
      auth: false,
      body: { phone, displayName, lang },
    });
  }, []);

  const verifyOtp = useCallback(async (input: OtpVerifyInput): Promise<VerifyResult> => {
    const tokens = await apiFetch<AuthTokens & { isNew: boolean }>('/auth/otp/verify', {
      method: 'POST',
      auth: false,
      body: input,
    });
    setSessionFromTokens(tokens);
    setUserState(tokens.user);
    void hydrateProgress(tokens.user.id).catch(() => undefined);
    return { isNew: tokens.isNew, user: tokens.user };
  }, []);

  const staffLogin = useCallback(async (email: string, password: string) => {
    const tokens = await apiFetch<AuthTokens>('/auth/login', {
      method: 'POST',
      auth: false,
      body: { email, password },
    });
    setSessionFromTokens(tokens);
    setUserState(tokens.user);
    void hydrateProgress(tokens.user.id).catch(() => undefined);
    return tokens.user;
  }, []);

  const logout = useCallback(async () => {
    const session = currentSession();
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
        auth: false,
        body: { refreshToken: session?.refreshToken },
      });
    } catch {
      /* logging out locally still matters */
    }
    clearAuth();
    setUserState(null);
  }, []);

  const refreshMe = useCallback(async () => {
    try {
      const response = await apiFetch<{ user: PublicUser }>('/me');
      setUserState(response.user);
      updateSessionUser(response.user);
      return response.user;
    } catch {
      return null;
    }
  }, []);

  const setUser = useCallback((next: PublicUser) => {
    setUserState(next);
    updateSessionUser(next);
  }, []);

  const value = useMemo(
    () => ({ user, loading, requestOtp, verifyOtp, staffLogin, logout, refreshMe, setUser }),
    [user, loading, requestOtp, verifyOtp, staffLogin, logout, refreshMe, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
