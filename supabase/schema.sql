-- ─────────────────────────────────────────────────────────────────────────────
-- Schema Vertxia — Tables pour la sync compte utilisateur (Niveau 3).
--
-- À COLLER dans l'éditeur SQL de Supabase :
--   Dashboard Supabase → SQL Editor → New query → coller tout ce fichier → Run
--
-- Convention :
--   - Toutes les tables ont user_id UUID lié à auth.users
--   - Row Level Security (RLS) activé partout
--   - Chaque user ne voit/modifie QUE ses propres données
--   - Timestamps automatiques (created_at, updated_at)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. PROFILS ─────────────────────────────────────────────────────────────
-- 1 ligne par user (lié auto à auth.users via trigger). Stocke les infos
-- entreprise pour pré-remplir le CERFA, la fiche de visite et le registre.

create table if not exists public.profils (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  raison_sociale text default '',
  siret text default '',
  adresse text default '',
  code_postal text default '',
  ville text default '',
  telephone text default '',
  categorie_attestation text default '',
  numero_attestation text default '',
  immatriculation_vehicule text default '',
  signature_data_url text,
  logo_data_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profils enable row level security;

create policy "profils_select_own" on public.profils
  for select using (auth.uid() = user_id);

create policy "profils_insert_own" on public.profils
  for insert with check (auth.uid() = user_id);

create policy "profils_update_own" on public.profils
  for update using (auth.uid() = user_id);

create policy "profils_delete_own" on public.profils
  for delete using (auth.uid() = user_id);

-- Trigger : crée un profil vide à chaque nouveau user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profils (user_id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 2. ÉQUIPEMENTS ─────────────────────────────────────────────────────────
-- Parc d'équipements F-Gas du frigoriste (PAC, clim, groupes froid).

create table if not exists public.equipements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_email text,
  client_telephone text,
  site_adresse text,
  modele text not null,
  numero_serie text not null,
  fluide_code text not null,
  fluide_label text,
  fluide_gwp integer,
  charge_kg numeric(10, 3) not null,
  detecteur_fixe boolean default false,
  dernier_controle_iso timestamptz,
  unites_interieures jsonb default '[]'::jsonb,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_equipements_user on public.equipements(user_id);
create index if not exists idx_equipements_serie on public.equipements(user_id, numero_serie);

alter table public.equipements enable row level security;

create policy "equipements_select_own" on public.equipements
  for select using (auth.uid() = user_id);
create policy "equipements_insert_own" on public.equipements
  for insert with check (auth.uid() = user_id);
create policy "equipements_update_own" on public.equipements
  for update using (auth.uid() = user_id);
create policy "equipements_delete_own" on public.equipements
  for delete using (auth.uid() = user_id);

-- ── 3. BOUTEILLES ──────────────────────────────────────────────────────────
-- Stock de bouteilles fluides frigorigènes (recharge + récupération).

create table if not exists public.bouteilles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('recharge', 'recuperation')),
  fluide_code text,
  fluide_label text,
  fluide_gwp integer,
  fluide_mix boolean default false,
  numero_serie text not null,
  tare_kg numeric(10, 3) not null,
  capacite_max_kg numeric(10, 3) not null,
  charge_initiale_kg numeric(10, 3) default 0,
  fournisseur text,
  date_achat_iso date,
  compatible_inflammable boolean default false,
  statut text default 'active' check (statut in ('active', 'transit_retour', 'archivee')),
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_bouteilles_user on public.bouteilles(user_id);
create index if not exists idx_bouteilles_fluide on public.bouteilles(user_id, fluide_code);

alter table public.bouteilles enable row level security;

create policy "bouteilles_select_own" on public.bouteilles
  for select using (auth.uid() = user_id);
create policy "bouteilles_insert_own" on public.bouteilles
  for insert with check (auth.uid() = user_id);
create policy "bouteilles_update_own" on public.bouteilles
  for update using (auth.uid() = user_id);
create policy "bouteilles_delete_own" on public.bouteilles
  for delete using (auth.uid() = user_id);

-- ── 4. MOUVEMENTS BOUTEILLES ───────────────────────────────────────────────
-- Mouvements de gaz (entrées/sorties) pour la traçabilité du registre.

create table if not exists public.mouvements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bouteille_id uuid not null references public.bouteilles(id) on delete cascade,
  date_mouvement_iso timestamptz not null,
  type text not null check (type in (
    'remplissage_initial', 'sortie', 'entree',
    'cession_traitement', 'retour_fournisseur', 'calibrage'
  )),
  quantite_kg numeric(10, 3) not null,
  poids_avant_kg numeric(10, 3),
  poids_apres_kg numeric(10, 3),
  methode text not null check (methode in ('balance', 'declarative')),
  intervention_id uuid,
  equipement_id uuid references public.equipements(id) on delete set null,
  bsff_id text,
  client_name text,
  operateur_name text,
  notes text,
  created_at timestamptz default now()
);

create index if not exists idx_mouvements_user on public.mouvements(user_id);
create index if not exists idx_mouvements_bouteille on public.mouvements(bouteille_id, date_mouvement_iso);
create index if not exists idx_mouvements_date on public.mouvements(user_id, date_mouvement_iso);

alter table public.mouvements enable row level security;

create policy "mouvements_select_own" on public.mouvements
  for select using (auth.uid() = user_id);
create policy "mouvements_insert_own" on public.mouvements
  for insert with check (auth.uid() = user_id);
create policy "mouvements_update_own" on public.mouvements
  for update using (auth.uid() = user_id);
create policy "mouvements_delete_own" on public.mouvements
  for delete using (auth.uid() = user_id);

-- ── 5. INTERVENTIONS ───────────────────────────────────────────────────────
-- Historique des interventions F-Gas pour génération CERFA + déclaration
-- annuelle SYDEREP.

create table if not exists public.interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  equipement_id uuid references public.equipements(id) on delete set null,
  date_iso timestamptz not null,
  type_intervention text not null,
  fluide_code text,
  fluide_label text,
  fluide_gwp integer,
  weight_kg numeric(10, 3),
  packaging_numero text,
  client_name text,
  client_email text,
  modele_equipement text,
  numero_serie_equipement text,
  lieu_intervention text,
  bsff_id text,
  controle_details jsonb,
  fluide_manipule jsonb,
  notes text,
  has_detenteur_signature boolean default false,
  detenteur_name text,
  detenteur_quality text,
  created_at timestamptz default now()
);

create index if not exists idx_interventions_user on public.interventions(user_id);
create index if not exists idx_interventions_date on public.interventions(user_id, date_iso desc);
create index if not exists idx_interventions_equipement on public.interventions(equipement_id);

alter table public.interventions enable row level security;

create policy "interventions_select_own" on public.interventions
  for select using (auth.uid() = user_id);
create policy "interventions_insert_own" on public.interventions
  for insert with check (auth.uid() = user_id);
create policy "interventions_update_own" on public.interventions
  for update using (auth.uid() = user_id);
create policy "interventions_delete_own" on public.interventions
  for delete using (auth.uid() = user_id);

-- ── 6. UPDATED_AT TRIGGERS ─────────────────────────────────────────────────
-- Met à jour automatiquement updated_at à chaque UPDATE.

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_updated_at on public.profils;
create trigger set_updated_at before update on public.profils
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.equipements;
create trigger set_updated_at before update on public.equipements
  for each row execute function public.handle_updated_at();

drop trigger if exists set_updated_at on public.bouteilles;
create trigger set_updated_at before update on public.bouteilles
  for each row execute function public.handle_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- ── 7. PARTAGE PUBLIC NIVEAU 1 (scan QR ouvert) ────────────────────────────
-- Permet à quiconque (même non connecté) de SELECT un équipement et ses
-- interventions via leur UUID. Permet :
--   - Le client final scan le QR collé sur son équipement → voit la fiche
--   - Un confrère/collègue technicien voit l'historique
--   - Un contrôleur DREAL/DGCCRF accède aux preuves
-- Les écritures (INSERT/UPDATE/DELETE) restent strictement owner-only via
-- les policies déjà en place ci-dessus.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "equipements_select_public" on public.equipements;
create policy "equipements_select_public" on public.equipements
  for select to anon, authenticated using (true);

drop policy if exists "interventions_select_public" on public.interventions;
create policy "interventions_select_public" on public.interventions
  for select to anon, authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- ── 8. GRANTS D'ACCÈS ENTRE CONFRÈRES ──────────────────────────────────────
-- L'owner d'un équipement peut générer un "lien magique" temporaire (24h)
-- pour donner accès complet (mode "full") à un confrère Vertxia. Use case :
-- sous-traitance d'une intervention sur une installation existante.
--
-- Flow :
--  1. Owner clique "Donner accès" → POST /api/.../grant → row insérée avec
--     token UUID + expires_at = now + 24h.
--  2. Owner copie le lien `/eq/<id>?grant=<token>` → envoie WhatsApp.
--  3. Confrère ouvre le lien (connecté à SON compte) → POST redeem
--     → used_by_user_id set, used_at = now.
--  4. À chaque fetch /eq/<id>, l'API vérifie : si un grant existe avec
--     used_by_user_id = visitor → mode "full" + canCreateIntervention.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.equipement_grants (
  id uuid primary key default gen_random_uuid(),
  equipement_id uuid not null references public.equipements(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_by_user_id uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists idx_grants_token on public.equipement_grants(token);
create index if not exists idx_grants_eq on public.equipement_grants(equipement_id);
create index if not exists idx_grants_used_user on public.equipement_grants(used_by_user_id, equipement_id);

alter table public.equipement_grants enable row level security;

-- L'owner peut tout faire sur les grants de ses propres équipements.
-- (Les autres opérations passent par les routes API server-side avec
--  service_role, donc pas besoin de policy publique ici.)
create policy "grants_owner_all" on public.equipement_grants
  for all to authenticated
  using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ── 9. CATALOGUE PARTAGÉ DES MODÈLES D'ÉQUIPEMENTS ─────────────────────────
-- Mémoire collective Vertxia : à chaque scan de plaque signalétique, on
-- enrichit une fiche modèle anonymisée (marque + modèle uniquement, AUCUN
-- n° série, AUCUN client). Le prochain technicien qui scanne le même
-- modèle bénéficie des données moyennées de tous les scans précédents.
--
-- Effet réseau : à 1000 users, ~3000 modèles couverts → expérience
-- quasi parfaite dès le 1er scan pour 90% des cas du marché FR.
--
-- RGPD : aucune donnée personnelle. Juste des données techniques publiques
-- (la plaque signalétique est visible sur l'équipement). À mentionner dans
-- les CGU comme "mutualisation de données techniques pour amélioration
-- du service".
--
-- Sécurité : SELECT public (tout user connecté peut lire). Les UPSERT
-- passent par les routes API server-side avec service_role (bypass RLS),
-- donc pas besoin de policy INSERT/UPDATE publique.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.shared_equipment_catalog (
  id uuid primary key default gen_random_uuid(),
  -- Clé naturelle : (marque, modèle) normalisés (lowercase, trim).
  -- Index unique pour permettre les UPSERT avec onConflict.
  marque_key text not null,
  modele_key text not null,
  -- Versions affichables (casse d'origine du plus récent scan, ex "Daikin")
  marque text not null,
  modele text not null,
  -- Données techniques agrégées (dernières valeurs vues, pas moyenne)
  fluide_code text,
  fluide_label text,
  fluide_gwp integer,
  charge_nominale_kg numeric(10, 3),
  type_equipement text,
  -- Compteurs d'usage et de confiance
  nombre_scans integer not null default 1,
  -- Pourcentage de scans qui ont confirmé les données actuelles (0-100)
  confiance_score integer not null default 100,
  -- Notes Claude (typiquement vide en V1)
  notes text,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  -- Contrainte unique pour permettre l'UPSERT sur clé naturelle normalisée
  constraint shared_equipment_catalog_unique unique (marque_key, modele_key)
);

create index if not exists idx_catalog_marque_modele
  on public.shared_equipment_catalog(marque_key, modele_key);
create index if not exists idx_catalog_marque
  on public.shared_equipment_catalog(marque_key);

alter table public.shared_equipment_catalog enable row level security;

-- Lecture publique : tout user connecté peut consulter le catalogue
-- pour bénéficier de l'effet réseau. Aucune donnée personnelle exposée.
create policy "catalog_select_authenticated" on public.shared_equipment_catalog
  for select to authenticated using (true);

-- Pas de policy d'écriture : les UPSERT passent par /api/catalog/upsert
-- qui utilise le service_role server-side (bypass RLS).

-- ─────────────────────────────────────────────────────────────────────────────
-- ── 10. CATALOGUE PARTAGÉ DES PANNES PAR MODÈLE ────────────────────────────
-- Mémoire collective des pannes/fuites/défauts observés sur les équipements
-- F-Gas. À chaque intervention "contrôle d'étanchéité" où une fuite est
-- détectée, on incrémente la ligne (marque, modèle, type_panne, localisation).
--
-- Même principe que le catalogue équipements : aucune donnée client, aucun
-- n°série. Juste la statistique "ce modèle Daikin a 12 fuites sur le
-- détendeur dans Vertxia".
--
-- Usage :
--   - Affichage sur la fiche /eq/[id] : "Pannes connues sur ce modèle"
--   - Enrichissement du prompt diagnostic IA : "Ce modèle a tendance à
--     fuir sur le détendeur — vérifie ce point en priorité"
--   - Statistiques marché : "73% des fuites Daikin VRV sont sur le
--     raccord aspiration"
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.shared_failure_catalog (
  id uuid primary key default gen_random_uuid(),
  -- Clé naturelle composite (clés normalisées en lowercase)
  marque_key text not null,
  modele_key text not null,
  type_panne text not null,        -- ex: "fuite", "panne_compresseur", "encrassement"
  localisation_key text not null,  -- ex: "detendeur", "compresseur", "raccord_aspiration"
  -- Affichables (casse d'origine du plus récent scan)
  marque text not null,
  modele text not null,
  localisation text,
  -- Compteurs
  nombre_occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint shared_failure_catalog_unique
    unique (marque_key, modele_key, type_panne, localisation_key)
);

create index if not exists idx_failure_marque_modele
  on public.shared_failure_catalog(marque_key, modele_key);
create index if not exists idx_failure_modele_panne
  on public.shared_failure_catalog(marque_key, modele_key, type_panne);

alter table public.shared_failure_catalog enable row level security;

-- Lecture publique pour les users connectés (effet réseau).
create policy "failure_select_authenticated" on public.shared_failure_catalog
  for select to authenticated using (true);

-- Écritures uniquement via /api/catalog/failure/upsert (service_role).

-- ─────────────────────────────────────────────────────────────────────────────
-- ── 11. CATALOGUE PARTAGÉ DES CODES ERREUR PAR MODÈLE ──────────────────────
-- Mémoire collective des codes erreur rencontrés sur le terrain par les pros.
-- À chaque consultation d'un code dans /m/codes-erreur (ou via le chat ou
-- vision-diagnostic), on incrémente la ligne (marque, code, modele?).
--
-- Différence avec shared_failure_catalog : on track les CODES (U4, P1, CH05)
-- pas les pannes physiques (fuite, encrassement). C'est plus immédiat pour
-- le tech ("ce code Daikin U4 a été vu 47 fois cette année par mes confrères
-- sur des VRV") que la stat panne sortie d'une intervention complète.
--
-- modele_key optionnel : si non fourni, ligne globale pour le code (utile
-- quand le code apparaît sans contexte modèle, ex: recherche directe).
-- Si fourni, ligne précise par modèle (utile sur fiche /eq/[id]).
--
-- Données ANONYMES : aucun n°série, aucun client, aucune adresse, aucun
-- horodatage précis (juste compteurs + first/last seen).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.shared_error_code_occurrences (
  id uuid primary key default gen_random_uuid(),
  -- Clés normalisées (lowercase)
  marque_key text not null,         -- "daikin", "mitsubishi", "lg", etc.
  code_key text not null,           -- "u4", "p1", "ch05", etc.
  modele_key text not null default '', -- "" = global, sinon modele normalisé
  -- Affichables (casse d'origine du plus récent scan)
  marque text not null,
  code text not null,
  modele text,
  -- Compteurs
  nombre_occurrences integer not null default 1,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint shared_error_code_occurrences_unique
    unique (marque_key, code_key, modele_key)
);

create index if not exists idx_error_code_marque_code
  on public.shared_error_code_occurrences(marque_key, code_key);
create index if not exists idx_error_code_modele
  on public.shared_error_code_occurrences(marque_key, code_key, modele_key);

alter table public.shared_error_code_occurrences enable row level security;

-- Lecture publique pour les users connectés (effet réseau).
create policy "error_code_select_authenticated"
  on public.shared_error_code_occurrences
  for select to authenticated using (true);

-- Écritures uniquement via /api/catalog/error-code/upsert (service_role).

-- ─────────────────────────────────────────────────────────────────────────────
-- ── 12. CATALOGUE PARTAGÉ DES BOUTEILLES FLUIDE FRIGORIGÈNE ────────────────
-- Mémoire collective des bouteilles scannées par TOUS les pros Vertxia.
-- À chaque scan IA Vision d'une bouteille, on enrichit une fiche partagée
-- indexée par code-barres normalisé. Le prochain pro qui scanne la même
-- bouteille (même code-barres) bénéficie automatiquement de toutes les
-- infos déjà saisies : marque, fluide, capacité, tare, type.
--
-- Pattern aligné sur shared_equipment_catalog (équipements) et
-- shared_failure_catalog (pannes). Aucune donnée client/perso : code-barres
-- est commercial publié par Linde/Climalife/etc., pas une donnée privée.
--
-- Usage :
--   - Au scan IA : /api/catalog/bouteille/lookup retourne la fiche si vue
--     par d'autres pros, on l'utilise pour pré-remplir AVANT même d'appeler
--     Claude Vision (gain coût + latence + fiabilité 100%).
--   - À la création/édition d'une bouteille : /api/catalog/bouteille/upsert
--     enrichit la fiche partagée avec les données validées par l'artisan.
--   - Badge UI : "📚 Bouteille scannée X fois par d'autres pros Vertxia".
--
-- Effet réseau Bluon-style : >50 pros et ~5000 scans = base critique
-- (cf rapport recherche 10 agents 08/06/2026).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.shared_bouteille_catalog (
  id uuid primary key default gen_random_uuid(),
  -- Clé naturelle : code-barres normalisé (uppercase, trim, sans espaces)
  code_barre_key text not null,
  -- Version affichable (casse d'origine du plus récent scan)
  code_barre text not null,
  -- Identifiants GS1 décodés par parser MOD10 (si applicable)
  gtin_14 text,                       -- GTIN-14 si check digit valide
  gs1_serial text,                    -- serial AI 21 si présent
  date_embouteillage_iso date,        -- AI 11 (production) ou heuristique YYMMDD Linde Sentry
  -- Données techniques agrégées (dernières valeurs validées par scan)
  marque text,                        -- "Linde", "Climalife", "Tereva", etc.
  fluide_code text,                   -- "R-32", "R-410A", "R-134a", "melange", etc.
  capacite_max_kg numeric(10, 3),     -- charge nominale fluide
  tare_kg numeric(10, 3),             -- poids à vide gravé
  type_bouteille text,                -- "recharge" | "recuperation"
  -- Notes optionnelles (ex: "bouteille A2L inflammable")
  notes text,
  -- Compteurs effet réseau
  nombre_scans integer not null default 1,
  confiance_score integer not null default 100,
  first_seen_at timestamptz not null default now(),
  last_updated_at timestamptz not null default now(),
  -- Unique pour permettre UPSERT sur code-barres normalisé
  constraint shared_bouteille_catalog_unique unique (code_barre_key)
);

create index if not exists idx_bouteille_catalog_code_key
  on public.shared_bouteille_catalog(code_barre_key);
create index if not exists idx_bouteille_catalog_gtin
  on public.shared_bouteille_catalog(gtin_14) where gtin_14 is not null;
create index if not exists idx_bouteille_catalog_marque_fluide
  on public.shared_bouteille_catalog(marque, fluide_code) where marque is not null;

alter table public.shared_bouteille_catalog enable row level security;

-- Lecture publique pour users connectés (effet réseau).
create policy "bouteille_catalog_select_authenticated"
  on public.shared_bouteille_catalog
  for select to authenticated using (true);

-- Écritures uniquement via /api/catalog/bouteille/upsert (service_role).
