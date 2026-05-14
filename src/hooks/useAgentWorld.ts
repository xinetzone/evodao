import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/config";
import { Profile } from "./useAuth";

export type RegistrationStep =
  | "idle"
  | "registering"
  | "solving"
  | "verifying"
  | "saving"
  | "done"
  | "error";

interface AgentWorldProfile {
  username: string;
  apiKey: string;
  avatarUrl: string | null;
  nickname?: string;
  bio?: string;
}

interface UseAgentWorldOptions {
  profile: Profile | null;
  userId: string | undefined;
  onProfileUpdate: () => void;
}

export function useAgentWorld({ profile, userId, onProfileUpdate }: UseAgentWorldOptions) {
  const [step, setStep] = useState<RegistrationStep>("idle");
  const [error, setError] = useState<string | null>(null);
  // Stores data immediately after successful registration (before profile refresh)
  const [justRegistered, setJustRegistered] = useState<AgentWorldProfile | null>(null);
  const [worldProfile, setWorldProfile] = useState<{
    nickname?: string;
    bio?: string;
    avatarUrl?: string;
  } | null>(null);

  const isRegistered = Boolean(profile?.agent_world_username) || Boolean(justRegistered);
  const agentProfile: AgentWorldProfile | null =
    justRegistered ??
    (profile?.agent_world_username
      ? {
          username: profile.agent_world_username,
          apiKey: profile.agent_world_api_key ?? "",
          avatarUrl: profile.agent_world_avatar_url ?? null,
        }
      : null);

  const register = useCallback(
    async (username: string, nickname: string, bio: string) => {
      if (!userId) return;
      setError(null);
      setJustRegistered(null);
      setStep("registering");

      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-world`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ mode: "register", userId, username, nickname, bio }),
        });

        const data = await res.json();

        if (!data.success) {
          setError(data.error || "Registration failed");
          setStep("error");
          return;
        }

        // Store the result immediately so UI can show it before profile refresh
        setJustRegistered({
          username: data.username,
          apiKey: data.api_key,
          avatarUrl: null,
        });
        setStep("done");

        // Try to fetch avatar from Agent World
        try {
          const profileRes = await fetch(`${SUPABASE_URL}/functions/v1/agent-world`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ mode: "profile", username }),
          });
          const profileData = await profileRes.json();
          if (profileData?.success && profileData.data) {
            const aw = profileData.data;
            if (aw.avatar_url) {
              setJustRegistered((prev) => prev ? { ...prev, avatarUrl: aw.avatar_url } : prev);
              await supabase
                .from("profiles")
                .update({ agent_world_avatar_url: aw.avatar_url })
                .eq("id", userId);
            }
            setWorldProfile({ nickname: aw.nickname, bio: aw.bio, avatarUrl: aw.avatar_url });
          }
        } catch {
          // Avatar fetch is best-effort
        }

        onProfileUpdate();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
        setStep("error");
      }
    },
    [userId, onProfileUpdate]
  );

  const fetchWorldProfile = useCallback(async () => {
    const username = agentProfile?.username;
    if (!username) return;
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-world`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ mode: "profile", username }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setWorldProfile({
          nickname: data.data.nickname,
          bio: data.data.bio,
          avatarUrl: data.data.avatar_url,
        });
      }
    } catch {
      // silently fail
    }
  }, [agentProfile?.username]);

  const resetError = () => {
    setError(null);
    setStep("idle");
  };

  return {
    isRegistered,
    agentProfile,
    worldProfile,
    step,
    error,
    register,
    fetchWorldProfile,
    resetError,
  };
}
