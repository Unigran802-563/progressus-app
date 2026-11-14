-- A primeira conversão preservou a data antiga em UTC. Este ajuste mantém o mesmo dia
-- no horário local do Brasil para as tarefas que já existiam antes da mudança.
UPDATE public.tarefa
SET prazo = prazo + interval '3 hours'
WHERE prazo IS NOT NULL;
