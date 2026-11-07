-- Historias del menú desde el móvil (web/historias.html). No usa Vercel ni el TPV.
-- El PIN y el token de GitHub viven en private.menu_story_secrets (no los lee el móvil).
-- Ejecutar una vez en Supabase → SQL Editor. El PIN debe ser el del personal.

create schema if not exists private;

create table if not exists private.menu_story_secrets (
  name text primary key,
  value text not null
);

revoke all on schema private from public, anon, authenticated;
revoke all on table private.menu_story_secrets from public, anon, authenticated;

create extension if not exists pg_net;

create table if not exists public.menu_story_jobs (
  id uuid primary key default gen_random_uuid(),
  primero text not null,
  segundo text not null,
  extra text,
  precio text,
  direccion text,
  status text not null default 'queued',
  image_url text,
  error text,
  created_at timestamptz not null default now()
);

alter table public.menu_story_jobs enable row level security;

drop policy if exists menu_story_jobs_select on public.menu_story_jobs;
create policy menu_story_jobs_select on public.menu_story_jobs
  for select to anon, authenticated
  using (true);

grant select on public.menu_story_jobs to anon, authenticated;

create or replace function public.request_menu_story(
  p_pin text,
  p_primero text,
  p_segundo text,
  p_extra text,
  p_precio text
) returns uuid
language plpgsql
security definer
set search_path = public, private
as $$
declare
  expected text;
  token text;
  job_id uuid;
  primero text;
  segundo text;
  extra text;
  precio text;
begin
  select value into expected from private.menu_story_secrets where name = 'pin';
  if expected is null or coalesce(p_pin, '') <> expected then
    raise exception 'PIN incorrecto';
  end if;

  primero := left(btrim(coalesce(p_primero, '')), 120);
  segundo := left(btrim(coalesce(p_segundo, '')), 160);
  extra := left(btrim(coalesce(p_extra, 'Postre y bebida a elegir')), 80);
  precio := left(btrim(coalesce(p_precio, '')), 12);
  if primero = '' or segundo = '' then
    raise exception 'Faltan platos';
  end if;

  insert into public.menu_story_jobs (primero, segundo, extra, precio, direccion, status)
  values (primero, segundo, extra, precio, 'Ctra. Ceares 67', 'queued')
  returning id into job_id;

  select value into token from private.menu_story_secrets where name = 'github_dispatch_token';
  if token is null or token = '' then
    update public.menu_story_jobs
      set status = 'error', error = 'Falta el token de GitHub en Supabase'
      where id = job_id;
    return job_id;
  end if;

  perform net.http_post(
    url := 'https://api.github.com/repos/Sebastian-Tamayo/CasaTorinoApp/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || token,
      'Accept', 'application/vnd.github+json',
      'Content-Type', 'application/json',
      'User-Agent', 'casa-torino-stories',
      'X-GitHub-Api-Version', '2022-11-28'
    ),
    body := jsonb_build_object(
      'event_type', 'menu-story',
      'client_payload', jsonb_build_object(
        'job_id', job_id,
        'primero', primero,
        'segundo', segundo,
        'extra', extra,
        'precio', precio,
        'direccion', 'Ctra. Ceares 67'
      )
    )
  );

  return job_id;
end;
$$;

revoke all on function public.request_menu_story(text, text, text, text, text) from public;
grant execute on function public.request_menu_story(text, text, text, text, text) to anon, authenticated;
