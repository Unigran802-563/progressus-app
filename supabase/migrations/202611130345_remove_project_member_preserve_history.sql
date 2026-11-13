-- Progressus: remove project members without deleting historical task/message/file data.
-- This migration intentionally does not alter application code, realtime publication,
-- users, tasks, messages, files, or private-chat memberships.

create or replace function public.remove_project_member(p_project_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target_role text;
begin
  if v_actor is null then
    raise exception 'Usuário não autenticado.' using errcode = '28000';
  end if;
  if p_project_id is null or p_user_id is null then
    raise exception 'Informe o projeto e o participante.' using errcode = '22004';
  end if;
  if v_actor = p_user_id then
    raise exception 'Você não pode remover a si mesmo do projeto.' using errcode = '42501';
  end if;

  -- Serialize all removals and ownership checks for this project.
  perform 1
    from public.projeto
   where id_projeto = p_project_id
   for update;
  if not found then
    raise exception 'Projeto não encontrado.' using errcode = 'P0002';
  end if;

  perform 1
    from public.usuario_projeto as up
   where up.id_projeto = p_project_id
     and up.id_usuario = v_actor
     and up.papel = 'owner'
   for update;
  if not found then
    raise exception 'Somente o proprietário pode remover participantes.' using errcode = '42501';
  end if;

  -- Lock the target membership so a concurrent invite/remove cannot race this decision.
  select up.papel into v_target_role
    from public.usuario_projeto as up
   where up.id_projeto = p_project_id
     and up.id_usuario = p_user_id
   for update;
  if not found then
    raise exception 'Este usuário não participa do projeto.' using errcode = 'P0002';
  end if;
  if v_target_role = 'owner' then
    raise exception 'O proprietário do projeto não pode ser removido.' using errcode = '42501';
  end if;

  -- Only group-chat membership for this project is removed. Private chats remain.
  delete from public.chat_usuario as cu
   using public.chat as c
   where c.id_chat = cu.id_chat
     and c.id_projeto = p_project_id
     and c.tipo = 'grupo'
     and cu.id_usuario = p_user_id;

  delete from public.usuario_projeto
   where id_projeto = p_project_id
     and id_usuario = p_user_id;
end;
$$;

create or replace function public.list_project_task_responsibles(p_project_id uuid)
returns table(
  id_tarefa uuid,
  responsavel_nome text,
  responsavel_excluido boolean
)
language sql
stable
security definer
set search_path to ''
as $$
  select
    t.id_tarefa,
    case
      when t.id_usuario is null then 'Sem responsável'
      when active_member.id_usuario is null then 'Usuário excluído'
      else coalesce(nullif(trim(u.nome), ''), 'Usuário')
    end as responsavel_nome,
    (t.id_usuario is not null and active_member.id_usuario is null) as responsavel_excluido
  from public.tarefa as t
  left join public.usuario_projeto as active_member
    on active_member.id_projeto = t.id_projeto
   and active_member.id_usuario = t.id_usuario
  left join public.usuario as u
    on u.id_usuario = active_member.id_usuario
  where t.id_projeto = p_project_id
    and exists (
      select 1
        from public.usuario_projeto as viewer
       where viewer.id_projeto = p_project_id
         and viewer.id_usuario = auth.uid()
    )
  order by t.id_tarefa;
$$;

-- A trigger validates only a newly assigned responsibility. It deliberately permits
-- an unchanged historical id_usuario after that user has left the project.
create or replace function public.validate_tarefa_responsible_assignment()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.id_usuario is not null
     and (tg_op = 'INSERT'
          or new.id_usuario is distinct from old.id_usuario
          or new.id_projeto is distinct from old.id_projeto)
     and not exists (
       select 1
         from public.usuario_projeto as up
        where up.id_projeto = new.id_projeto
          and up.id_usuario = new.id_usuario
     ) then
    raise exception 'O responsável deve ser um participante ativo do projeto.' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists tarefa_validate_responsible_assignment on public.tarefa;
create trigger tarefa_validate_responsible_assignment
before insert or update of id_usuario, id_projeto on public.tarefa
for each row execute function public.validate_tarefa_responsible_assignment();

-- Replace only tarefa UPDATE policies: RLS checks actor access, while the trigger
-- checks a new assignment and leaves unchanged historical responsibility untouched.
drop policy if exists "Owner e membros podem editar tarefas" on public.tarefa;
drop policy if exists progressus_tarefa_update_member on public.tarefa;

create policy progressus_tarefa_update_member
on public.tarefa for update to authenticated
using (
  exists (
    select 1
      from public.usuario_projeto as up
     where up.id_projeto = tarefa.id_projeto
       and up.id_usuario = auth.uid()
       and up.papel in ('owner', 'member')
  )
)
with check (
  exists (
    select 1
      from public.usuario_projeto as up
     where up.id_projeto = tarefa.id_projeto
       and up.id_usuario = auth.uid()
       and up.papel in ('owner', 'member')
  )
);

-- Prevent former members from mutating their own old messages. Keep every
-- existing author policy and add a restrictive chat-access requirement, without
-- changing private-chat semantics.
create policy progressus_mensagem_update_own
on public.mensagem as restrictive for update to authenticated
using (id_usuario = auth.uid() and can_access_chat(id_chat))
with check (id_usuario = auth.uid() and can_access_chat(id_chat));

create policy progressus_mensagem_delete_own
on public.mensagem as restrictive for delete to authenticated
using (id_usuario = auth.uid() and can_access_chat(id_chat));

-- Trigger functions are not user-callable; RPCs are callable only by authenticated users.
revoke all on function public.validate_tarefa_responsible_assignment() from public, anon, authenticated;
revoke all on function public.remove_project_member(uuid, uuid) from public, anon;
revoke all on function public.list_project_task_responsibles(uuid) from public, anon;
grant execute on function public.remove_project_member(uuid, uuid) to authenticated;
grant execute on function public.list_project_task_responsibles(uuid) to authenticated;
