-- Preserve legacy tasks: creator stays NULL when it was never recorded.
alter table public.tarefa add column if not exists id_criador uuid references public.usuario(id_usuario) on delete set null;
alter table public.tarefa alter column id_criador set default auth.uid();

create or replace function public.validate_tarefa_edit_identity()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if v_actor is not null then
      if new.id_criador is not null and new.id_criador <> v_actor then
        raise exception 'O criador da tarefa deve ser o usuário autenticado.' using errcode = '42501';
      end if;
      new.id_criador := v_actor;
    end if;
  elsif v_actor is not null then
    if new.id_criador is distinct from old.id_criador
       or new.id_projeto is distinct from old.id_projeto
       or new.id_tarefa is distinct from old.id_tarefa
       or new.created_at is distinct from old.created_at then
      raise exception 'A autoria, o projeto e a identificação da tarefa não podem ser alterados.' using errcode = '42501';
    end if;
  end if;

  if tg_op = 'INSERT' or new.nome is distinct from old.nome then
    if nullif(trim(new.nome), '') is null then
      raise exception 'Informe o nome da tarefa.' using errcode = '23514';
    end if;
    new.nome := trim(new.nome);
  end if;

  if new.id_status is not null
     and (tg_op = 'INSERT' or new.id_status is distinct from old.id_status)
     and not exists (
       select 1 from public.status s
       where s.id_status = new.id_status and s.id_projeto = new.id_projeto
     ) then
    raise exception 'O status selecionado não pertence ao projeto.' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' and new.prioridade is distinct from old.prioridade
     and new.prioridade is not null and new.prioridade not in ('Baixa', 'Media', 'Alta') then
    raise exception 'Selecione uma prioridade válida.' using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.validate_tarefa_edit_identity() from public, anon, authenticated;
drop trigger if exists tarefa_validate_edit_identity on public.tarefa;
create trigger tarefa_validate_edit_identity
before insert or update on public.tarefa
for each row execute function public.validate_tarefa_edit_identity();

-- USING evaluates the existing task. WITH CHECK verifies the project membership,
-- allowing a responsible member to reassign a task without forging its creator.
-- Other members can still read the task, but can no longer change its data.
drop policy if exists progressus_tarefa_update_member on public.tarefa;
create policy progressus_tarefa_update_creator_or_responsible
on public.tarefa for update to authenticated
using (
  exists (
    select 1
    from public.usuario_projeto up
    join public.projeto p on p.id_projeto = up.id_projeto
    where up.id_projeto = tarefa.id_projeto
      and up.id_usuario = auth.uid()
      and up.papel in ('owner', 'member')
      and p.arquivado_em is null and p.excluido_em is null
      and (up.papel = 'owner' or tarefa.id_criador = auth.uid() or tarefa.id_usuario = auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.usuario_projeto up
    join public.projeto p on p.id_projeto = up.id_projeto
    where up.id_projeto = tarefa.id_projeto
      and up.id_usuario = auth.uid()
      and up.papel in ('owner', 'member')
      and p.arquivado_em is null and p.excluido_em is null
  )
);
