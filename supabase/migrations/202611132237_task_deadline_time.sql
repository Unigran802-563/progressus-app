-- Permite registrar prazo com data e horário, preservando prazos antigos à meia-noite UTC.
ALTER TABLE public.tarefa
  ALTER COLUMN prazo TYPE timestamptz
  USING (prazo::timestamp without time zone AT TIME ZONE 'UTC');
