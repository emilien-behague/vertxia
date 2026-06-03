"use client";

// Synchronise le user_id Supabase courant vers sessionStorage pour que
// les helpers de storage (lib/equipement, intervention, bouteille, profil)
// utilisent la BONNE namespace localStorage selon le compte connecté.
//
// Sans ce composant, tous les comptes connectés sur le même device
// partagent les MÊMES données localStorage (bug critique de cohabitation).
//
// Monté dans /m/layout.tsx pour s'appliquer à toute l'app mobile.

import { useEffect } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { setCurrentUserId, getCurrentUserId } from "@/lib/user-scope";

export function AuthSync() {
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      // Pas de Supabase → namespace anon par défaut
      setCurrentUserId(null);
      return;
    }

    const supabase = createClient();
    let mounted = true;

    // 1. Sync immédiat au mount (cas où user déjà connecté au reload)
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      const newUserId = data.user?.id ?? null;
      const currentNamespace = getCurrentUserId();
      const expectedNamespace = newUserId ?? "anon";
      // Si le namespace a changé (login d'un autre compte, ou logout),
      // on reload la page pour que les hooks/state se ré-initialisent
      // avec les bonnes données du nouveau user.
      if (currentNamespace !== expectedNamespace) {
        setCurrentUserId(newUserId);
        // Reload pour rafraîchir tous les listEquipements / listInterventions
        // qui ont été appelés avec l'ancien namespace.
        window.location.reload();
      } else {
        setCurrentUserId(newUserId);
      }
    });

    // 2. Subscribe aux changements de session (signIn / signOut / refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        const newUserId = session?.user?.id ?? null;
        const currentNamespace = getCurrentUserId();
        const expectedNamespace = newUserId ?? "anon";
        setCurrentUserId(newUserId);
        // Sur SIGNED_IN ou SIGNED_OUT avec changement de namespace,
        // reload pour repartir propre.
        if (
          (event === "SIGNED_IN" || event === "SIGNED_OUT") &&
          currentNamespace !== expectedNamespace
        ) {
          window.location.reload();
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return null;
}
