-- =====================================================================
-- Clément Design Logistics — préparation de Supabase
-- À exécuter UNE FOIS : Supabase > SQL Editor > New query > coller > Run.
-- Le script peut être relancé sans danger (il ne supprime aucune donnée).
-- =====================================================================

-- ---------- 1. Tables ----------
create table if not exists public.labels (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  article text, type_vetement text, couleur text, taille text, manche text,
  ean text, of_num text, filename text
);

create table if not exists public.receptions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  of_num text, carton text,
  quantite_scannee integer not null default 0,
  anomalies integer not null default 0,
  statut text not null default 'ferme',
  lignes jsonb,
  closed_at timestamptz
);

create table if not exists public.fabrications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reference text, of_num text, article text, couleur text, taille text,
  quantite integer, faconnier text, commentaire text
);

create table if not exists public.colisages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  reference text, of_num text,
  total integer not null default 0,
  anomalies integer not null default 0,
  lignes jsonb
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  action text, ean text, module text, details jsonb
);

-- ---------- 2. Si receptions / activity_logs existaient déjà : ajout des colonnes manquantes ----------
alter table public.receptions add column if not exists created_at timestamptz not null default now();
alter table public.receptions add column if not exists of_num text;
alter table public.receptions add column if not exists carton text;
alter table public.receptions add column if not exists quantite_scannee integer not null default 0;
alter table public.receptions add column if not exists anomalies integer not null default 0;
alter table public.receptions add column if not exists statut text default 'ferme';
alter table public.receptions add column if not exists lignes jsonb;
alter table public.receptions add column if not exists closed_at timestamptz;

alter table public.activity_logs add column if not exists created_at timestamptz not null default now();
alter table public.activity_logs add column if not exists action text;
alter table public.activity_logs add column if not exists ean text;
alter table public.activity_logs add column if not exists module text;
alter table public.activity_logs add column if not exists details jsonb;

create index if not exists idx_activity_logs_created on public.activity_logs (created_at desc);
create index if not exists idx_activity_logs_action on public.activity_logs (action);
create index if not exists idx_fabrications_reference on public.fabrications (reference);

-- ---------- 3. Droits d'accès (RLS) ----------
-- Le site utilise la clé publique « anon ». Il peut LIRE et AJOUTER des lignes,
-- mais jamais modifier ni supprimer.
grant usage on schema public to anon, authenticated;

do $$
declare t text;
begin
  foreach t in array array['labels','receptions','fabrications','colisages','activity_logs'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists cd_select on public.%I', t);
    execute format('drop policy if exists cd_insert on public.%I', t);
    execute format('create policy cd_select on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy cd_insert on public.%I for insert to anon, authenticated with check (true)', t);
    execute format('grant select, insert on public.%I to anon, authenticated', t);
  end loop;
end $$;

-- Demande à l'API de recharger son cache de structure
notify pgrst, 'reload schema';

-- ATTENTION : ces règles laissent toute personne qui connaît l'adresse du site lire
-- et ajouter des données. Pour un usage interne c'est pratique ; pour restreindre
-- l'accès, il faudra ajouter une connexion (Supabase Auth) et remplacer « anon »
-- par « authenticated » dans les règles ci-dessus.
