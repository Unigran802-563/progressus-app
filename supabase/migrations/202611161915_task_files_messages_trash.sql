-- Anexos de tarefas, exclusão de mensagens por escopo e expiração da lixeira.
-- Esta migration não remove dados existentes ao ser aplicada.

-- 1) Arquivos vinculados a tarefas: o projeto precisa ser informado e deve
-- corresponder ao projeto da tarefa. O bucket continua sendo privado.
drop policy if exists progressus_arquivo_task_select_member on public.arquivo;
create policy progressus_arquivo_task_select_member
on public.arquivo for select to authenticated
using (
  id_tarefa is not null
  and exists (
    select 1
    from public.tarefa t
    where t.id_tarefa = arquivo.id_tarefa
      and t.id_projeto = arquivo.id_projeto
      and public.is_project_member(t.id_projeto)
  )
);

drop policy if exists progressus_arquivo_task_insert_member on public.arquivo;
create policy progressus_arquivo_task_insert_member
on public.arquivo for insert to authenticated
with check (
  id_tarefa is not null
  and id_projeto is not null
  and exists (
    select 1
    from public.tarefa t
    where t.id_tarefa = arquivo.id_tarefa
      and t.id_projeto = arquivo.id_projeto
      and public.is_project_member(t.id_projeto)
  )
);

drop policy if exists progressus_arquivo_task_delete_member on public.arquivo;
create policy progressus_arquivo_task_delete_member
on public.arquivo for delete to authenticated
using (
  id_tarefa is not null
  and exists (
    select 1
    from public.tarefa t
    where t.id_tarefa = arquivo.id_tarefa
      and t.id_projeto = arquivo.id_projeto
      and public.is_project_member(t.id_projeto)
  )
);

-- 2) Exclusão "para mim". A mensagem permanece visível aos demais usuários.
create table if not exists public.mensagem_oculta (
  id_mensagem uuid not null references public.mensagem(id_mensagem) on delete cascade,
  id_usuario uuid not null references public.usuario(id_usuario) on delete cascade,
  ocultada_em timestamptz not null default now(),
  primary key (id_mensagem, id_usuario)
);

alter table public.mensagem_oculta enable row level security;

drop policy if exists progressus_mensagem_oculta_select_own on public.mensagem_oculta;
create policy progressus_mensagem_oculta_select_own
on public.mensagem_oculta for select to authenticated
using (id_usuario = auth.uid());

drop policy if exists progressus_mensagem_oculta_insert_own on public.mensagem_oculta;
create policy progressus_mensagem_oculta_insert_own
on public.mensagem_oculta for insert to authenticated
with check (id_usuario = auth.uid());

drop policy if exists progressus_mensagem_oculta_delete_own on public.mensagem_oculta;
create policy progressus_mensagem_oculta_delete_own
on public.mensagem_oculta for delete to authenticated
using (id_usuario = auth.uid());

create or replace function public.hide_message_for_me(p_message_id uuid)
returns void
language plpgsql
security invoker
set search_path to 'public'
as $$
begin
  if not exists (
    select 1 from public.mensagem m
    join public.chat_usuario cu on cu.id_chat = m.id_chat
    where m.id_mensagem = p_message_id
      and cu.id_usuario = auth.uid()
  ) then
    raise exception 'Mensagem não encontrada ou sem acesso.';
  end if;

  insert into public.mensagem_oculta (id_mensagem, id_usuario)
  values (p_message_id, auth.uid())
  on conflict (id_mensagem, id_usuario) do nothing;
end;
$$;

-- 3) Exclusão "para todos": somente o autor e até uma hora após o envio.
create or replace function public.delete_message_for_all(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare sent_at timestamptz;
begin
  select data_hora into sent_at
  from public.mensagem
  where id_mensagem = p_message_id
    and id_usuario = auth.uid();

  if sent_at is null then
    raise exception 'Mensagem não encontrada ou você não é o autor.';
  end if;

  if now() > sent_at + interval '1 hour' then
    raise exception 'Só é possível excluir para todos até 1 hora após o envio.';
  end if;

  delete from public.arquivo where id_mensagem = p_message_id;
  delete from public.mensagem_mencao where id_mensagem = p_message_id;
  delete from public.mensagem_leitura where id_mensagem = p_message_id;
  delete from public.mensagem_oculta where id_mensagem = p_message_id;
  delete from public.mensagem where id_mensagem = p_message_id;
end;
$$;

revoke all on function public.hide_message_for_me(uuid) from public;
grant execute on function public.hide_message_for_me(uuid) to authenticated;
revoke all on function public.delete_message_for_all(uuid) from public;
grant execute on function public.delete_message_for_all(uuid) to authenticated;

-- 4) Lixeira: exclusão definitiva apenas pelo proprietário e somente para
-- projetos já enviados à lixeira. A rotina de limpeza é chamada pela leitura
-- da lixeira e também pode ser agendada posteriormente sem mudar a regra.
create or replace function public.permanently_delete_project(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_project_owner(p_project_id) then
    raise exception 'Você não tem permissão para excluir definitivamente este projeto.';
  end if;

  if not exists (select 1 from public.projeto where id_projeto = p_project_id and excluido_em is not null) then
    raise exception 'O projeto não está na lixeira.';
  end if;

  delete from public.arquivo where id_projeto = p_project_id;
  delete from public.mensagem_mencao where id_mensagem in (
    select m.id_mensagem from public.mensagem m
    join public.chat c on c.id_chat = m.id_chat
    where c.id_projeto = p_project_id
  );
  delete from public.mensagem_leitura where id_mensagem in (
    select m.id_mensagem from public.mensagem m
    join public.chat c on c.id_chat = m.id_chat
    where c.id_projeto = p_project_id
  );
  delete from public.mensagem where id_chat in (select id_chat from public.chat where id_projeto = p_project_id);
  delete from public.chat_usuario where id_chat in (select id_chat from public.chat where id_projeto = p_project_id);
  delete from public.chat where id_projeto = p_project_id;
  delete from public.tarefa where id_projeto = p_project_id;
  delete from public.status where id_projeto = p_project_id;
  delete from public.convite_projeto where id_projeto = p_project_id;
  delete from public.relatorio where id_projeto = p_project_id;
  delete from public.ia where id_projeto = p_project_id;
  delete from public.usuario_projeto where id_projeto = p_project_id;
  delete from public.projeto where id_projeto = p_project_id;
end;
$$;

create or replace function public.purge_expired_project_trash()
returns integer
language plpgsql
security invoker
set search_path to 'public'
as $$
declare item record;
removed integer := 0;
begin
  for item in
    select p.id_projeto
    from public.projeto p
    join public.usuario_projeto up on up.id_projeto = p.id_projeto and up.papel = 'owner'
    where p.excluido_em is not null
      and p.excluido_em < now() - interval '30 days'
      and up.id_usuario = auth.uid()
  loop
    perform public.permanently_delete_project(item.id_projeto);
    removed := removed + 1;
  end loop;
  return removed;
end;
$$;

revoke all on function public.permanently_delete_project(uuid) from public;
grant execute on function public.permanently_delete_project(uuid) to authenticated;
revoke all on function public.purge_expired_project_trash() from public;
grant execute on function public.purge_expired_project_trash() to authenticated;
