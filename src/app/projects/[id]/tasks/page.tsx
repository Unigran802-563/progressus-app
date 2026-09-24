'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  alterarStatusTarefa,
  criarTarefa,
  listarStatus,
  listarTarefas,
} from '@/lib/tasks';
import {
  Tarefa,
  TarefaPrioridade,
  TarefaStatus,
} from '@/types';

type TasksPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default function TasksPage({ params }: TasksPageProps) {
  const [projectId, setProjectId] = useState('');
  const [tarefas, setTarefas] = useState<Tarefa[]>([]);
  const [status, setStatus] = useState<TarefaStatus[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [modalAberto, setModalAberto] = useState(false);

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [prioridade, setPrioridade] =
    useState<TarefaPrioridade>('Media');
  const [statusInicial, setStatusInicial] = useState('');

  useEffect(() => {
    async function carregarDados() {
      try {
        const { id } = await params;

        setProjectId(id);

        const [statusData, tarefasData] = await Promise.all([
          listarStatus(id),
          listarTarefas(id),
        ]);

        setStatus(statusData);
        setTarefas(tarefasData);

        if (statusData.length > 0) {
          setStatusInicial(statusData[0].id_status);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Não foi possível carregar as tarefas.'
        );
      } finally {
        setLoading(false);
      }
    }

    carregarDados();
  }, [params]);

  const tarefasPorStatus = useMemo(() => {
    return status.map((coluna) => ({
      ...coluna,
      tarefas: tarefas.filter(
        (tarefa) => tarefa.id_status === coluna.id_status
      ),
    }));
  }, [status, tarefas]);

  function limparFormulario() {
    setNome('');
    setDescricao('');
    setPrioridade('Media');

    if (status.length > 0) {
      setStatusInicial(status[0].id_status);
    }
  }

  function fecharModal() {
    if (saving) return;

    limparFormulario();
    setModalAberto(false);
    setError('');
  }

  function handleAlterarPrioridade(valor: string) {
    if (
      valor === 'Baixa' ||
      valor === 'Media' ||
      valor === 'Alta'
    ) {
      setPrioridade(valor);
    }
  }

  async function handleCriarTarefa(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!nome.trim() || !statusInicial) {
      setError('Informe o nome da tarefa e o status inicial.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const novaTarefa = await criarTarefa({
        id_projeto: projectId,
        id_status: statusInicial,
        nome,
        descricao,
        prioridade,
      });

      setTarefas((tarefasAtuais) => [
        novaTarefa,
        ...tarefasAtuais,
      ]);

      limparFormulario();
      setModalAberto(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível criar a tarefa.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleAlterarStatus(
    idTarefa: string,
    novoStatus: string
  ) {
    try {
      setError('');

      const tarefaAtualizada = await alterarStatusTarefa(
        idTarefa,
        novoStatus
      );

      setTarefas((tarefasAtuais) =>
        tarefasAtuais.map((tarefa) =>
          tarefa.id_tarefa === tarefaAtualizada.id_tarefa
            ? tarefaAtualizada
            : tarefa
        )
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Não foi possível alterar o status.'
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#0b0d12] px-6 py-10 text-white">
        <p className="text-zinc-400">Carregando tarefas...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b0d12] px-4 py-8 text-white sm:px-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href={`/projects/${projectId}`}
              className="mb-3 inline-block text-sm text-zinc-400 transition hover:text-white"
            >
              ← Voltar para o projeto
            </Link>

            <h1 className="text-3xl font-semibold tracking-tight">
              Tarefas do projeto
            </h1>

            <p className="mt-2 text-sm text-zinc-400">
              Organize as atividades no quadro Kanban.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              setError('');
              setModalAberto(true);
            }}
            disabled={status.length === 0}
            className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Nova tarefa
          </button>
        </div>

        {error && !modalAberto && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {status.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-zinc-400">
            Nenhum status foi encontrado para este projeto.
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {tarefasPorStatus.map((coluna) => (
              <section
                key={coluna.id_status}
                className="min-h-[320px] rounded-2xl border border-white/10 bg-white/[0.03] p-4"
              >
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-medium">{coluna.nome}</h2>

                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-zinc-300">
                    {coluna.tarefas.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {coluna.tarefas.map((tarefa) => (
                    <article
                      key={tarefa.id_tarefa}
                      className="rounded-xl border border-white/10 bg-[#151821] p-4"
                    >
                      <h3 className="font-medium">{tarefa.nome}</h3>

                      {tarefa.descricao && (
                        <p className="mt-2 text-sm text-zinc-400">
                          {tarefa.descricao}
                        </p>
                      )}

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-zinc-500">
                          Prioridade:{' '}
                          {tarefa.prioridade || 'Media'}
                        </span>

                        <select
                          value={tarefa.id_status ?? ''}
                          onChange={(event) =>
                            handleAlterarStatus(
                              tarefa.id_tarefa,
                              event.target.value
                            )
                          }
                          className="max-w-[130px] rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-zinc-300 outline-none"
                        >
                          {status.map((opcao) => (
                            <option
                              key={opcao.id_status}
                              value={opcao.id_status}
                            >
                              {opcao.nome}
                            </option>
                          ))}
                        </select>
                      </div>
                    </article>
                  ))}

                  {coluna.tarefas.length === 0 && (
                    <p className="py-10 text-center text-sm text-zinc-600">
                      Nenhuma tarefa nesta coluna.
                    </p>
                  )}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {modalAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              fecharModal();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="nova-tarefa-titulo"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#151821] p-6 shadow-2xl shadow-black/40"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2
                  id="nova-tarefa-titulo"
                  className="text-xl font-semibold"
                >
                  Nova tarefa
                </h2>

                <p className="mt-1 text-sm text-zinc-400">
                  Cadastre uma atividade para este projeto.
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                disabled={saving}
                aria-label="Fechar modal"
                className="rounded-lg px-2 py-1 text-2xl leading-none text-zinc-400 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                ×
              </button>
            </div>

            {error && (
              <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form
              onSubmit={handleCriarTarefa}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="nome-tarefa"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Nome da tarefa
                </label>

                <input
                  id="nome-tarefa"
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  placeholder="Ex.: Finalizar introdução"
                  autoFocus
                  required
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-violet-400"
                />
              </div>

              <div>
                <label
                  htmlFor="descricao-tarefa"
                  className="mb-2 block text-sm font-medium text-zinc-200"
                >
                  Descrição
                </label>

                <textarea
                  id="descricao-tarefa"
                  value={descricao}
                  onChange={(event) =>
                    setDescricao(event.target.value)
                  }
                  placeholder="Descreva a atividade, se necessário"
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-zinc-500 focus:border-violet-400"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="prioridade-tarefa"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Prioridade
                  </label>

                  <select
                    id="prioridade-tarefa"
                    value={prioridade}
                    onChange={(event) =>
                      handleAlterarPrioridade(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#101218] px-4 py-3 text-sm outline-none focus:border-violet-400"
                  >
                    <option value="Baixa">
                      Baixa prioridade
                    </option>
                    <option value="Media">
                      Média prioridade
                    </option>
                    <option value="Alta">
                      Alta prioridade
                    </option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="status-tarefa"
                    className="mb-2 block text-sm font-medium text-zinc-200"
                  >
                    Status inicial
                  </label>

                  <select
                    id="status-tarefa"
                    value={statusInicial}
                    onChange={(event) =>
                      setStatusInicial(event.target.value)
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#101218] px-4 py-3 text-sm outline-none focus:border-violet-400"
                  >
                    {status.map((coluna) => (
                      <option
                        key={coluna.id_status}
                        value={coluna.id_status}
                      >
                        {coluna.nome}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3 border-t border-white/10 pt-5">
                <button
                  type="button"
                  onClick={fecharModal}
                  disabled={saving}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm text-zinc-300 transition hover:bg-white/10 disabled:opacity-50"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={saving || !statusInicial}
                  className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Criando...' : 'Criar tarefa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}
