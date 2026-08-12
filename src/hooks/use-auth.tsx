import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  displayName: string;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function ensureProfile(user: User): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();
  if (data) return data as Profile;

  const fallbackName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split("@")[0] ??
    null;

  const { data: created } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      display_name: fallbackName,
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
    })
    .select("id, display_name, avatar_url, created_at")
    .maybeSingle();
  return (created as Profile) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      if (!active) return;
      setSession(s);
      if (!s) setProfile(null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const userId = session?.user?.id;
  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    ensureProfile(session.user).then((p) => {
      if (active) setProfile(p);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    return {
      session,
      user,
      profile,
      loading,
      displayName:
        profile?.display_name ??
        (user?.user_metadata?.full_name as string | undefined) ??
        user?.email?.split("@")[0] ??
        "there",
      refreshProfile: async () => {
        if (!user) return;
        const p = await ensureProfile(user);
        setProfile(p);
      },
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
    };
  }, [session, profile, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
