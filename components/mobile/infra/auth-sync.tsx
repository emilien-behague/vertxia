"use client";

// Synchronise le user_id Supabase courant vers localStorage pour isoler
// les données (équipements, interventions, bouteilles, profil) par compte.
//
// IMPORTANT : on ne fait JAMAIS window.location.reload() ici. Le faisait
// avant créait une boucle infinie sur Safari iOS (sessionStorage purge
// agressif → on détectait un namespace "anon" même après le set, donc on
// reloadait, et au mount suivant, le check était à nouveau différent →
// boucle).
//
// Comportement actuel :
// - Au mount : set le user_id courant dans localStorage (instant)
// - Sur changement de session (signIn / signOut) : update localStorage
// - Les pages /m/* qui lisent listEquipements() etc. récupèrent le bon
//   namespace au prochain mount. Si l'utilisateur ne navigue pas, il peut
//   voir l'ancien parc une fois — il navigue, et c'est cohérent.

import { useEffect } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { setCurrentUserId } from "@/lib/auth/user-scope";

export function AuthSync() {
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setCurrentUserId(null);
      return;
    }

    const supabase = createClient();
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setCurrentUserId(data.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        setCurrentUserId(session?.user?.id ?? null);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
