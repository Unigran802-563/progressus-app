-- A exclusão segue exatamente a regra de edição:
-- proprietário do projeto, criador da tarefa ou responsável, sempre como
-- participante ativo e somente em projeto ativo.

drop policy if exists "Participantes podem excluir tarefas" on public.tarefa;
drop policy if exists progressus_tarefa_delete_member on public.tarefa;
drop policy if exists progressus_tarefa_delete_creator_or_responsible on public.tarefa;

create policy progressus_tarefa_delete_creator_or_responsible
on public.tarefa for delete to authenticated
using (
  exists (
    select 1
    from public.usuario_projeto up
    join public.projeto p on p.id_projeto = up.id_projeto
    where up.id_projeto = tarefa.id_projeto
      and up.id_usuario = auth.uid()
      and up.papel in ('owner', 'member')
      and p.arquivado_em is null
      and p.excluido_em is null
      and (
        up.papel = 'owner'
        or tarefa.id_criador = auth.uid()
        or tarefa.id_usuario = auth.uid()
      )
  )
);
