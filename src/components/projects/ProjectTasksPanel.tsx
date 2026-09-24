"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  ClipboardList,
  KanbanSquare,
  List,
  Loader2,
  Plus,
  X,
} from "lucide-react";

import {
  alterarStatusTarefa,
  criarTarefa,
  listarStatus,
  listarTarefas,
} from "@/lib/tasks";
import type { Tarefa, TarefaPrioridade, TarefaStatus } from "@/types";

type ProjectTasksPanelProps = {
  projectId: string;
  disabled?: boolean;
};

type TasksView = "kanban" | "list";

export default function ProjectTasksPanel({
  projectId,
  disabled = false,
}: ProjectTasksPanelProps) {
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [status, setStatus] = useState<TarefaStatus[]>([]);
  const [view, setView] = useState<TasksView>("kanban");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>("Media");
  const [statusInicial, setStatusInicial] = useState("");

  useEffect(() => {
    let active = true;

    async function loadTasks() {
      try {
        setLoading(true);
        setError("");

        const [statusData, tarefasData] = await Promise.all([
          listarStatus(projectId),
          listarTarefas(projectId),
        ]);

        if (!active) return;

        setStatus(statusData);
        setTarefas(tarefasData);

        if (statusData.length > 0) {
          setStatusInicial(statusData[0].id_status);
        }
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar as tarefas.",
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadTasks();

    return () => {
      active = false;
    };
  }, [projectId]);

  const tarefasPorStatus = useMemo(() => {
    return status.map((coluna) => ({
      ...coluna,
      tarefas: tarefas.filter(
        (tarefa) => tarefa.id_status === coluna.id_status,
      ),
    }));
  }, [status, tarefas]);

  function resetForm() {
    setNome("");
    setDescricao("");
    setPrioridade("Media");
    setError("");

    if (status.length > 0) {
      setStatusInicial(status[0].id_status);
    }
  }

  function openModal() {
    setError("");

    if (!statusInicial && status.length > 0) {
      setStatusInicial(status[0].id_status);
    }

    setIsModalOpen(true);
  }

  function closeModal() {
    if (saving) return;

    resetForm();
    setIsModalOpen(false);
  }

  function handlePriorityChange(value: string) {
    if (value === "Baixa" || value === "Media" || value === "Alta") {
      setPrioridade(value);
    }
  }

  async function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!nome.trim()) {
      setError("Informe o nome da tarefa.");
      return;
    }

    if (!statusInicial) {
      setError("Selecione o status inicial da tarefa.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const novaTarefa = await criarTarefa({
        id_projeto: projectId,
        id_status: statusInicial,
        nome,
        descricao,
        prioridade,
      });

      setTarefas((currentTasks) => [novaTarefa, ...currentTasks]);

      resetForm();
      setIsModalOpen(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível criar a tarefa.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(idTarefa: string, novoStatus: string) {
    try {
      setUpdatingTaskId(idTarefa);
      setError("");

      const tarefaAtualizada = await alterarStatusTarefa(idTarefa, novoStatus);

      setTarefas((currentTasks) =>
        currentTasks.map((tarefa) =>
          tarefa.id_tarefa === tarefaAtualizada.id_tarefa
            ? tarefaAtualizada
            : tarefa,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar o status da tarefa.",
      );
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function getStatusName(idStatus: string | null) {
    return (
      status.find((item) => item.id_status === idStatus)?.nome || "Sem status"
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2
          className="size-4 animate-spin text-primary"
          aria-hidden="true"
        />
        Carregando tarefas...
      </div>
    );
  }

  if (status.length === 0) {
    return (
      <div className="p-5">
        <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
          <ClipboardList
            className="mx-auto size-7 text-muted-foreground"
            aria-hidden="true"
          />

          <p className="mt-3 text-sm font-medium text-foreground">
            Nenhum status encontrado
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            Este projeto ainda não possui colunas de tarefas.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-5">
      {error && !isModalOpen && (
        <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="mb-5 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Organização das tarefas
          </h3>

          <p className="mt-1 text-sm text-muted-foreground">
            {tarefas.length}{" "}
            {tarefas.length === 1 ? "tarefa cadastrada" : "tarefas cadastradas"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setView("kanban")}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                view === "kanban"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <KanbanSquare className="size-4" aria-hidden="true" />
              Kanban
            </button>

            <button
              type="button"
              onClick={() => setView("list")}
              className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                view === "list"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <List className="size-4" aria-hidden="true" />
              Lista
            </button>
          </div>

          <button
            type="button"
            onClick={openModal}
            disabled={disabled}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nova tarefa
          </button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {tarefasPorStatus.map((coluna) => (
            <section
              key={coluna.id_status}
              className="flex min-h-[360px] w-[300px] min-w-[300px] flex-none flex-col rounded-2xl border border-border bg-muted/20 p-3"
            >
              <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3">
                <div className="flex items-center gap-2">
                  <span className="size-2 rounded-full bg-primary" />

                  <h3 className="text-sm font-semibold text-foreground">
                    {coluna.nome}
                  </h3>
                </div>

                <span className="grid min-w-7 place-items-center rounded-full bg-background px-2 py-1 text-xs font-medium text-muted-foreground">
                  {coluna.tarefas.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-3">
                {coluna.tarefas.map((tarefa) => (
                  <article
                    key={tarefa.id_tarefa}
                    className="rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-lg"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="text-sm font-semibold leading-5 text-foreground">
                        {tarefa.nome}
                      </h4>

                      <span className="shrink-0 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                        {tarefa.prioridade || "Media"}
                      </span>
                    </div>

                    {tarefa.descricao && (
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {tarefa.descricao}
                      </p>
                    )}

                    <div className="mt-4 border-t border-border pt-3">
                      <label
                        htmlFor={`status-kanban-${tarefa.id_tarefa}`}
                        className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                      >
                        Status
                      </label>

                      <select
                        id={`status-kanban-${tarefa.id_tarefa}`}
                        value={tarefa.id_status ?? ""}
                        disabled={updatingTaskId === tarefa.id_tarefa}
                        onChange={(event) =>
                          void handleStatusChange(
                            tarefa.id_tarefa,
                            event.target.value,
                          )
                        }
                        className="w-full rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
                        aria-label={`Alterar status de ${tarefa.nome}`}
                      >
                        {status.map((option) => (
                          <option
                            key={option.id_status}
                            value={option.id_status}
                          >
                            {option.nome}
                          </option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}

                {coluna.tarefas.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-border/70 px-3 py-10">
                    <p className="text-center text-xs text-muted-foreground">
                      Arraste ou adicione tarefas aqui
                    </p>
                  </div>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          {tarefas.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma tarefa cadastrada.
            </div>
          ) : (
            <table className="w-full min-w-[680px] text-left">
              <thead className="border-b border-border bg-muted/30">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Tarefa
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Status
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Prioridade
                  </th>

                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Ação
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {tarefas.map((tarefa) => (
                  <tr
                    key={tarefa.id_tarefa}
                    className="transition-colors hover:bg-muted/20"
                  >
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-foreground">
                        {tarefa.nome}
                      </p>

                      {tarefa.descricao && (
                        <p className="mt-1 max-w-md truncate text-xs text-muted-foreground">
                          {tarefa.descricao}
                        </p>
                      )}
                    </td>

                    <td className="px-4 py-4 text-sm text-muted-foreground">
                      {getStatusName(tarefa.id_status)}
                    </td>

                    <td className="px-4 py-4">
                      <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                        {tarefa.prioridade || "Media"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      <select
                        value={tarefa.id_status ?? ""}
                        disabled={updatingTaskId === tarefa.id_tarefa}
                        onChange={(event) =>
                          void handleStatusChange(
                            tarefa.id_tarefa,
                            event.target.value,
                          )
                        }
                        className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary disabled:opacity-50"
                        aria-label={`Alterar status de ${tarefa.nome}`}
                      >
                        {status.map((option) => (
                          <option
                            key={option.id_status}
                            value={option.id_status}
                          >
                            {option.nome}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {isModalOpen && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeModal();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-task-title"
            className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-2xl shadow-black/50 sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2
                  id="new-task-title"
                  className="text-lg font-semibold text-foreground"
                >
                  Nova tarefa
                </h2>

                <p className="mt-1 text-sm text-muted-foreground">
                  Adicione uma atividade ao projeto.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            {error && (
              <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="project-task-name"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Nome da tarefa
                </label>

                <input
                  id="project-task-name"
                  value={nome}
                  onChange={(event) => setNome(event.target.value)}
                  placeholder="Ex.: Finalizar introdução"
                  autoFocus
                  required
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <div>
                <label
                  htmlFor="project-task-description"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Descrição
                </label>

                <textarea
                  id="project-task-description"
                  value={descricao}
                  onChange={(event) => setDescricao(event.target.value)}
                  placeholder="Descreva a atividade, se necessário"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="project-task-priority"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Prioridade
                  </label>

                  <select
                    id="project-task-priority"
                    value={prioridade}
                    onChange={(event) =>
                      handlePriorityChange(event.target.value)
                    }
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Media">Média</option>
                    <option value="Alta">Alta</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="project-task-status"
                    className="mb-2 block text-sm font-medium text-foreground"
                  >
                    Status inicial
                  </label>

                  <select
                    id="project-task-status"
                    value={statusInicial}
                    onChange={(event) => setStatusInicial(event.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary"
                  >
                    {status.map((column) => (
                      <option key={column.id_status} value={column.id_status}>
                        {column.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving || !statusInicial}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving && (
                    <Loader2
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                  )}

                  {saving ? "Criando..." : "Criar tarefa"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
