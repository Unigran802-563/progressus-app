alter table public.projeto
  add column if not exists excluido_em timestamp with time zone;

create index if not exists projeto_excluido_em_idx
  on public.projeto(excluido_em);

create or replace function public.list_accessible_projects(p_incluir_arquivados boolean default false)
returns table(
  id_projeto uuid,
  nome text,
  descricao text,
  created_at timestamp with time zone,
  arquivado_em timestamp with time zone,
  meu_papel text,
  id_proprietario uuid,
  nome_proprietario text
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    p.id_projeto,
    p.nome,
    p.descricao,
    p.created_at,
    p.arquivado_em,
    meu_vinculo.papel as meu_papel,
    owner.id_usuario as id_proprietario,
    owner.nome as nome_proprietario
  from public.usuario_projeto as meu_vinculo
  join public.projeto as p
    on p.id_projeto = meu_vinculo.id_projeto
  join public.usuario_projeto as owner_vinculo
    on owner_vinculo.id_projeto = p.id_projeto
   and owner_vinculo.papel = 'owner'
  join public.usuario as owner
    on owner.id_usuario = owner_vinculo.id_usuario
  where meu_vinculo.id_usuario = auth.uid()
    and p.excluido_em is null
    and (p_incluir_arquivados or p.arquivado_em is null)
  order by p.created_at desc;
$$;

create or replace function public.list_trash_projects()
returns table(
  id_projeto uuid,
  nome text,
  descricao text,
  created_at timestamp with time zone,
  arquivado_em timestamp with time zone,
  meu_papel text,
  id_proprietario uuid,
  nome_proprietario text
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    p.id_projeto,
    p.nome,
    p.descricao,
    p.created_at,
    p.arquivado_em,
    owner_vinculo.papel as meu_papel,
    owner.id_usuario as id_proprietario,
    owner.nome as nome_proprietario
  from public.projeto as p
  join public.usuario_projeto as owner_vinculo
    on owner_vinculo.id_projeto = p.id_projeto
   and owner_vinculo.papel = 'owner'
  join public.usuario as owner
    on owner.id_usuario = owner_vinculo.id_usuario
  where owner_vinculo.id_usuario = auth.uid()
    and p.excluido_em is not null
  order by p.excluido_em desc;
$$;

create or replace function public.move_project_to_trash(p_project_id uuid)
returns public.projeto
language plpgsql
security invoker
set search_path to 'public'
as $$
declare result public.projeto;
begin
  if not public.is_project_owner(p_project_id) then
    raise exception 'Você não tem permissão para excluir este projeto.';
  end if;

  update public.projeto
     set excluido_em = now()
   where id_projeto = p_project_id
     and excluido_em is null
   returning * into result;

  if result.id_projeto is null then
    raise exception 'Projeto não encontrado.';
  end if;
  return result;
end;
$$;

create or replace function public.restore_project_from_trash(p_project_id uuid)
returns public.projeto
language plpgsql
security invoker
set search_path to 'public'
as $$
declare result public.projeto;
begin
  if not public.is_project_owner(p_project_id) then
    raise exception 'Você não tem permissão para restaurar este projeto.';
  end if;

  update public.projeto
     set excluido_em = null
   where id_projeto = p_project_id
     and excluido_em is not null
   returning * into result;

  if result.id_projeto is null then
    raise exception 'Projeto não encontrado na lixeira.';
  end if;
  return result;
end;
$$;

create or replace function public.restore_archived_project(p_project_id uuid)
returns public.projeto
language plpgsql
security invoker
set search_path to 'public'
as $$
declare result public.projeto;
begin
  if not public.is_project_owner(p_project_id) then
    raise exception 'Você não tem permissão para restaurar este projeto.';
  end if;

  update public.projeto
     set arquivado_em = null
   where id_projeto = p_project_id
     and arquivado_em is not null
     and excluido_em is null
   returning * into result;

  if result.id_projeto is null then
    raise exception 'Projeto não encontrado nos arquivados.';
  end if;
  return result;
end;
$$;

revoke all on function public.list_trash_projects() from public;
grant execute on function public.list_trash_projects() to authenticated;
revoke all on function public.move_project_to_trash(uuid) from public;
grant execute on function public.move_project_to_trash(uuid) to authenticated;
revoke all on function public.restore_project_from_trash(uuid) from public;
grant execute on function public.restore_project_from_trash(uuid) to authenticated;
grant execute on function public.restore_archived_project(uuid) to authenticated;
