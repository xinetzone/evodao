import { useState, useEffect, useCallback } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface Profile {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
  daily_run_limit: number | null;
  daily_image_limit: number | null;
  monthly_run_limit: number | null;
  daily_token_limit: number | null;
  monthly_token_limit: number | null;
  subscription_plan: "basic" | "pro" | null;
  subscription_status: "active" | "cancelled" | null;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("id, email, is_admin, created_at, daily_run_limit, daily_image_limit, monthly_run_limit, daily_token_limit, monthly_token_limit, subscription_plan, subscription_status")
      .eq("id", uid)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    // Set up auth state listener BEFORE checking existing session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          setTimeout(() => fetchProfile(newSession.user.id), 0);
        } else {
          setProfile(null);
        }
        setIsLoading(false);
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session: existing } }) => {
      setSession(existing);
      setUser(existing?.user ?? null);
      if (existing?.user) {
        fetchProfile(existing.user.id);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return {
    user,
    session,
    profile,
    isAdmin: profile?.is_admin === true,
    isLoading,
    signIn,
    signUp,
    signOut,
  };
}
