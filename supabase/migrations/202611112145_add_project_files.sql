-- Arquivos enviados diretamente na aba Arquivos do projeto.
-- Os anexos do Chat continuam na mesma tabela e passam a ser listados pelo projeto.
alter table public.arquivo
  add column if not exists id_projeto uuid references public.projeto(id_projeto) on delete cascade;

alter table public.arquivo
  add column if not exists created_at timestamptz not null default now();

alter table public.arquivo
  alter column id_mensagem drop not null;

create index if not exists arquivo_id_projeto_idx on public.arquivo(id_projeto);
create index if not exists arquivo_id_mensagem_idx on public.arquivo(id_mensagem);

alter table public.arquivo enable row level security;

drop policy if exists progressus_arquivo_select_member on public.arquivo;
create policy progressus_arquivo_select_member
on public.arquivo for select to authenticated
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

drop policy if exists progressus_arquivo_insert_member on public.arquivo;
create policy progressus_arquivo_insert_member
on public.arquivo for insert to authenticated
with check (
  id_projeto is not null
  and is_project_member(id_projeto)
);

-- Permite que membros do projeto usem o bucket já utilizado pelos anexos do Chat.
drop policy if exists progressus_project_files_storage_insert on storage.objects;
create policy progressus_project_files_storage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'arquivos'
  and split_part(name, '/', 1) = 'projetos'
  and is_project_member((split_part(name, '/', 2))::uuid)
);

drop policy if exists progressus_project_files_storage_select on storage.objects;
create policy progressus_project_files_storage_select
on storage.objects for select to authenticated
using (
  bucket_id = 'arquivos'
  and split_part(name, '/', 1) = 'projetos'
  and is_project_member((split_part(name, '/', 2))::uuid)
);
