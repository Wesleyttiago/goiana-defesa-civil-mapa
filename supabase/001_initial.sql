begin;

create table public.agentes (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 2 and 120),
  papel text not null default 'agente' check (papel in ('agente', 'gestor')),
  ativo boolean not null default false
);

-- Nenhuma conta ganha acesso aos dados somente por se autenticar.
-- A gestão deve criar o usuário no Auth e habilitá-lo nesta tabela.
create or replace function public.papel_do_agente()
returns text language sql stable security definer set search_path = ''
as $$ select papel from public.agentes where id = (select auth.uid()) and ativo = true $$;
revoke all on function public.papel_do_agente() from public, anon;
grant execute on function public.papel_do_agente() to authenticated;

create table public.familias (
  id uuid primary key default gen_random_uuid(),
  responsavel text not null check (char_length(btrim(responsavel)) between 3 and 120),
  telefone text not null default '' check (telefone = '' or telefone ~ '^\+?[0-9 ()-]{10,22}$'),
  pessoas integer not null check (pessoas between 1 and 50),
  bairro text not null check (char_length(btrim(bairro)) between 2 and 100),
  endereco text not null check (char_length(btrim(endereco)) between 5 and 240),
  referencia text not null default '' check (char_length(referencia) <= 240),
  latitude double precision not null check (latitude between -7.85 and -7.45),
  longitude double precision not null check (longitude between -35.2 and -34.75),
  tipo_risco text not null check (tipo_risco in ('inundacao', 'deslizamento', 'ambos')),
  nivel_risco text not null check (nivel_risco in ('baixo', 'medio', 'alto')),
  situacao text not null default 'pendente' check (situacao in ('pendente', 'acompanhamento', 'encaminhada')),
  observacoes text not null default '' check (char_length(observacoes) <= 2000),
  criado_por uuid not null default auth.uid() references auth.users(id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao integer not null default 1 check (versao > 0)
);

comment on column public.familias.latitude is 'WGS84. A restrição usa uma área de navegação aproximada, não o limite municipal oficial.';
comment on column public.familias.nivel_risco is 'Avaliação registrada pela equipe; não calculada pelo mapa.';
create index familias_bairro_idx on public.familias(bairro);
create index familias_risco_idx on public.familias(nivel_risco);
create index familias_autor_idx on public.familias(criado_por);

create function public.preparar_familia()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'INSERT' then
    new.criado_em := now();
    new.versao := 1;
  else
    if new.id <> old.id or new.criado_por <> old.criado_por or new.criado_em <> old.criado_em then
      raise exception 'Identidade e autoria do cadastro não podem ser alteradas.';
    end if;
    new.versao := old.versao + 1;
  end if;
  new.atualizado_em := now();
  return new;
end $$;
create trigger preparar_familia before insert or update on public.familias for each row execute function public.preparar_familia();

create table public.auditoria (
  id uuid primary key default gen_random_uuid(),
  familia_id uuid not null references public.familias(id),
  acao text not null check (acao in ('INSERT', 'UPDATE')),
  agente_id uuid references auth.users(id),
  instante timestamptz not null default now()
);

create function public.auditar_familia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.auditoria(familia_id, acao, agente_id) values (new.id, TG_OP, auth.uid());
  return new;
end $$;
revoke all on function public.auditar_familia() from public, anon, authenticated;
revoke all on function public.preparar_familia() from public, anon, authenticated;
create trigger auditar_familia after insert or update on public.familias for each row execute function public.auditar_familia();

alter table public.agentes enable row level security;
alter table public.familias enable row level security;
alter table public.auditoria enable row level security;

revoke all on public.agentes, public.familias, public.auditoria from public, anon, authenticated;
grant select on public.agentes to authenticated;
grant select, insert, update on public.familias to authenticated;
grant select on public.auditoria to authenticated;

create policy agentes_ler_proprio on public.agentes for select to authenticated using (id = (select auth.uid()));
create policy agentes_ler_gestao on public.agentes for select to authenticated using ((select public.papel_do_agente()) = 'gestor');

create policy familias_ler on public.familias for select to authenticated
  using ((select public.papel_do_agente()) in ('agente', 'gestor'));
create policy familias_cadastrar on public.familias for insert to authenticated
  with check ((select public.papel_do_agente()) in ('agente', 'gestor') and criado_por = (select auth.uid()));
create policy familias_editar on public.familias for update to authenticated
  using ((select public.papel_do_agente()) = 'gestor' or ((select public.papel_do_agente()) = 'agente' and criado_por = (select auth.uid())))
  with check ((select public.papel_do_agente()) = 'gestor' or ((select public.papel_do_agente()) = 'agente' and criado_por = (select auth.uid())));
create policy auditoria_gestao on public.auditoria for select to authenticated using ((select public.papel_do_agente()) = 'gestor');

commit;
