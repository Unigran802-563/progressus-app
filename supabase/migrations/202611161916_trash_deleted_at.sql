-- Retorna a data de exclusão para que a interface calcule os dias restantes.
drop function if exists public.list_trash_projects();

create or replace function public.list_trash_projects()
returns table(
  id_projeto uuid,
  nome text,
  descricao text,
  created_at timestamptz,
  arquivado_em timestamptz,
  excluido_em timestamptz,
  meu_papel text,
  id_proprietario uuid,
  nome_proprietario text
)
language sql stable security definer set search_path = ''
as $$
  select p.id_projeto, p.nome, p.descricao, p.created_at, p.arquivado_em, p.excluido_em,
         owner_vinculo.papel, owner.id_usuario, owner.nome
  from public.projeto p
  join public.usuario_projeto owner_vinculo on owner_vinculo.id_projeto = p.id_projeto and owner_vinculo.papel = 'owner'
  join public.usuario owner on owner.id_usuario = owner_vinculo.id_usuario
  where owner_vinculo.id_usuario = auth.uid() and p.excluido_em is not null
  order by p.excluido_em desc;
$$;
