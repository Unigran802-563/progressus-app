-- Permite que membros ativos excluam arquivos vinculados a projetos acessíveis.
-- Não altera nem remove dados existentes ao aplicar a migration.

 drop policy if exists progressus_arquivo_delete_member on public.arquivo;
create policy progressus_arquivo_delete_member
on public.arquivo for delete to authenticated
using (
  (id_projeto is not null and is_project_member(id_projeto))
  or exists (
    select 1
    from public.mensagem m
    join public.chat c on c.id_chat = m.id_chat
    where m.id_mensagem = arquivo.id_mensagem
      and c.id_projeto is not null
      and is_project_member(c.id_projeto)
  )
);

drop policy if exists progressus_project_files_storage_delete on storage.objects;
create policy progressus_project_files_storage_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'arquivos'
  and split_part(name, '/', 1) = 'projetos'
  and is_project_member((split_part(name, '/', 2))::uuid)
);
