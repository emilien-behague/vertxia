"use client";

// Hook React qui expose l'utilisateur Supabase connecté côté client.
// Réagit en temps réel aux changements de session (login, logout, refresh).
//
// Usage :
//   const { user, loading, signOut } = useUser();
//   if (loading) return <Spinner />;
//   if (!user) return <Link href="/m/login">Se connecter</Link>;
//   return <div>Bonjour {user.email}</div>;

import { useEffect, useState, useCallback, useMemo } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient, isSupabaseConfigured } from "./client";

export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Si Supabase n'est pas configuré (env vars absentes), on dégrade gracefully :
  // le hook retourne user=null, loading=false, et signOut no-op.
  const configured = isSupabaseConfigured();
  const supabase = useMemo(() => (configured ? createClient() : null), [configured]);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user ?? null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) setUser(session?.user ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, [supabase]);

  return { user, loading, signOut, configured };
}
