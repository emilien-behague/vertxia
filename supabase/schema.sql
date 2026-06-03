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
