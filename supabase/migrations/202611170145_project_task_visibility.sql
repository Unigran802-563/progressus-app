-- Ocultação herdada do projeto, sem alterar nenhum registro de tarefa.
-- Uma política RESTRICTIVE combina-se por AND com todas as permissivas antigas.
-- Restaurar/desarquivar o projeto torna as mesmas tarefas novamente visíveis.

create policy progressus_tarefa_active_project_select
on public.tarefa as restrictive for select to public
using (exists (
  select 1 from public.projeto p
  where p.id_projeto = tarefa.id_projeto
    and p.arquivado_em is null and p.excluido_em is null
));

-- Evita expor anexos de tarefas ocultas pela política permissiva de arquivos do projeto.
create policy progressus_arquivo_active_task_select
on public.arquivo as restrictive for select to public
using (id_tarefa is null or exists (
  select 1 from public.tarefa t where t.id_tarefa = arquivo.id_tarefa
));

-- Relatórios existentes não são apagados: somente ficam ocultos com o projeto.
create policy progressus_relatorio_active_project_select
on public.relatorio as restrictive for select to public
using (exists (
  select 1 from public.projeto p
  where p.id_projeto = relatorio.id_projeto
    and p.arquivado_em is null and p.excluido_em is null
));

-- Esta RPC é SECURITY DEFINER e precisa aplicar explicitamente a mesma regra.
create or replace function public.list_project_task_responsibles(p_project_id uuid)
returns table(id_tarefa uuid, responsavel_nome text, responsavel_excluido boolean)
language sql stable security definer set search_path to ''
as $$
  select t.id_tarefa,
    case when t.id_usuario is null then 'Sem responsável'
      when active_member.id_usuario is null then 'Usuário excluído'
      else coalesce(nullif(trim(u.nome), ''), 'Usuário') end,
    (t.id_usuario is not null and active_member.id_usuario is null)
  from public.tarefa t
  join public.projeto p on p.id_projeto = t.id_projeto
  left join public.usuario_projeto active_member
    on active_member.id_projeto = t.id_projeto and active_member.id_usuario = t.id_usuario
  left join public.usuario u on u.id_usuario = active_member.id_usuario
  where t.id_projeto = p_project_id
    and p.arquivado_em is null and p.excluido_em is null
    and exists (select 1 from public.usuario_projeto viewer
      where viewer.id_projeto = p_project_id and viewer.id_usuario = auth.uid())
  order by t.id_tarefa;
$$;
revoke all on function public.list_project_task_responsibles(uuid) from public;
grant execute on function public.list_project_task_responsibles(uuid) to authenticated;

-- Restaurar da lixeira significa voltar ao estado ativo, inclusive se o projeto
-- tinha sido arquivado antes de ir à lixeira. As tarefas nunca são atualizadas.
create or replace function public.restore_project_from_trash(p_project_id uuid)
returns public.projeto language plpgsql security invoker set search_path to ''
as $$
declare result public.projeto;
begin
  if auth.uid() is null or not public.is_project_owner(p_project_id) then
    raise exception 'Você não tem permissão para restaurar este projeto.';
  end if;
  update public.projeto set excluido_em = null, arquivado_em = null
  where id_projeto = p_project_id and excluido_em is not null
  returning * into result;
  if result.id_projeto is null then raise exception 'Projeto não encontrado na lixeira.'; end if;
  return result;
end;
$$;
revoke all on function public.restore_project_from_trash(uuid) from public;
grant execute on function public.restore_project_from_trash(uuid) to authenticated;

-- Disponibilizar eventos de estado do projeto para as telas abertas da equipe.
-- O RLS do projeto continua limitando cada evento aos seus participantes.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'projeto') then
    alter publication supabase_realtime add table public.projeto;
  end if;
end;
$$;
