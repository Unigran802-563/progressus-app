-- Progressus: campos usados de forma consistente pelo Dashboard,
-- Minhas tarefas e Calendário.
alter table public.tarefa
  add column if not exists id_usuario uuid references public.usuario(id_usuario),
  add column if not exists prazo date;

create index if not exists tarefa_id_usuario_idx
  on public.tarefa (id_usuario);

create index if not exists tarefa_prazo_idx
  on public.tarefa (prazo);

-- As políticas RLS existentes continuam controlando o acesso por projeto.
-- Este índice apenas melhora as consultas por responsável e prazo.
