-- Execute com uma conexão administrativa ao banco. Todo o teste é ROLLBACK.
-- Usa duas contas existentes apenas como identidades, sem alterar suas contas.
-- Cria somente registros TESTE em um projeto temporário, nunca altera projetos reais.
begin;
do $$
declare
  initial_role text := current_user;
  owner_id uuid;
  member_id uuid;
  project_id uuid := gen_random_uuid();
  status_id uuid := gen_random_uuid();
  task_a uuid := gen_random_uuid();
  task_b uuid := gen_random_uuid();
  actor uuid;
  visible_count integer;
  before_hash text;
  after_hash text;
begin
  select id_usuario into owner_id from public.usuario order by id_usuario limit 1;
  select id_usuario into member_id from public.usuario order by id_usuario limit 1 offset 1;
  if owner_id is null or member_id is null then raise exception 'O teste exige duas contas existentes.'; end if;

  insert into public.projeto(id_projeto, nome) values (project_id, 'TESTE - Visibilidade de tarefas (rollback)');
  insert into public.usuario_projeto(id_usuario, id_projeto, papel)
    values (owner_id, project_id, 'owner'), (member_id, project_id, 'member');
  insert into public.status(id_status, id_projeto, nome, ordem) values (status_id, project_id, 'TESTE - A fazer', 0);
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  insert into public.tarefa(id_tarefa, id_projeto, id_status, id_usuario, nome, descricao, prioridade, prazo)
    values (task_a, project_id, status_id, owner_id, 'TESTE - Tarefa proprietário', 'Descrição preservada', 'Alta', now() + interval '5 days'),
           (task_b, project_id, status_id, member_id, 'TESTE - Tarefa participante', 'Descrição preservada', 'Baixa', now() + interval '10 days');
  insert into public.arquivo(nome, tipo, tamanho, caminho, id_tarefa, id_projeto)
    values ('TESTE - anexo.pdf', 'application/pdf', 1, 'TESTE-sem-upload', task_b, project_id);
  select md5(string_agg(t::text, '|' order by id_tarefa)) into before_hash
    from public.tarefa t where id_projeto = project_id limit 1;

  execute 'set local role authenticated';
  foreach actor in array array[owner_id, member_id] loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    select count(*) into visible_count from public.tarefa where id_projeto = project_id limit 1;
    if visible_count <> 2 then raise exception 'Projeto ativo não retornou todas as tarefas.'; end if;
  end loop;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.archive_project(project_id);
  foreach actor in array array[owner_id, member_id] loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    select count(*) into visible_count from public.tarefa where id_projeto = project_id limit 1;
    if visible_count <> 0 then raise exception 'Tarefas arquivadas visíveis.'; end if;
    select count(*) into visible_count from public.list_project_task_responsibles(project_id) limit 1;
    if visible_count <> 0 then raise exception 'RPC expôs tarefas arquivadas.'; end if;
    select count(*) into visible_count from public.arquivo where id_tarefa = task_b limit 1;
    if visible_count <> 0 then raise exception 'Anexo da tarefa arquivada visível.'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.restore_archived_project(project_id);
  foreach actor in array array[owner_id, member_id] loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    select count(*) into visible_count from public.tarefa where id_projeto = project_id limit 1;
    if visible_count <> 2 then raise exception 'Tarefas não reapareceram ao desarquivar.'; end if;
  end loop;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.archive_project(project_id);
  perform public.move_project_to_trash(project_id);
  foreach actor in array array[owner_id, member_id] loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    select count(*) into visible_count from public.tarefa where id_projeto = project_id limit 1;
    if visible_count <> 0 then raise exception 'Tarefas da lixeira visíveis.'; end if;
  end loop;
  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  perform public.restore_project_from_trash(project_id);
  foreach actor in array array[owner_id, member_id] loop
    perform set_config('request.jwt.claim.sub', actor::text, true);
    select count(*) into visible_count from public.tarefa where id_projeto = project_id limit 1;
    if visible_count <> 2 then raise exception 'Tarefas não reapareceram após restaurar a lixeira.'; end if;
    select count(*) into visible_count from public.list_project_task_responsibles(project_id) limit 1;
    if visible_count <> 2 then raise exception 'Responsáveis não reapareceram após restaurar.'; end if;
  end loop;

  execute format('set local role %I', initial_role);
  select md5(string_agg(t::text, '|' order by id_tarefa)) into after_hash
    from public.tarefa t where id_projeto = project_id limit 1;
  if before_hash is distinct from after_hash then
    raise exception 'Nome, descrição, status, responsável ou datas de tarefas foram alterados.';
  end if;
end;
$$;
rollback;
select 'PASS: ativo > arquivado > restaurado > lixeira > restaurado, com duas identidades e dados preservados; TESTE removido por rollback.' as result limit 1;
