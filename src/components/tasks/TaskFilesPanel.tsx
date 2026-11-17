'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, Paperclip, Trash2, X } from 'lucide-react';
import ProjectConfirmationDialog from '@/components/projects/ProjectConfirmationDialog';
import {
  createProjectFileDownloadUrl,
  createProjectFileUrl,
  deleteTaskFile,
  listTaskFiles,
  MAX_TASK_FILE_SIZE,
  uploadTaskFile,
  type TaskFile,
} from '@/lib/project-files';
import { emitSuccess } from '@/lib/feedback';

type Props = {
  taskId: string;
  projectId: string;
  /** Read-only: hide upload/delete controls, but keep preview and download. */
  disabled?: boolean;
  /**
   * Called synchronously when a file operation starts, and after its result is
   * handled. The parent must block close/backdrop/Escape/edit/task changes while
   * true so an upload error cannot disappear when this panel is unmounted.
   * Operations are not canceled on unmount; cleanup releases the notification.
   */
  onBusyChange?: (busy: boolean) => void;
};

type Scope = { taskId: string; projectId: string };
type Operation = 'upload' | 'preview' | 'download' | 'delete';

function sizeLabel(size: number | null) {
  if (size === null) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function notifySuccess(message: string) {
  // Browser storage restrictions must not turn a confirmed mutation into an
  // apparent upload/delete failure and encourage a duplicate retry.
  try { emitSuccess(message); } catch { /* Feedback is best-effort only. */ }
}

export default function TaskFilesPanel({ taskId, projectId, disabled = false, onBusyChange }: Props) {
  const previewId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(false);
  const scopeRef = useRef<Scope>({ taskId, projectId });
  const busyRef = useRef(false);
  const busyCallbackRef = useRef(onBusyChange);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<Operation | null>(null);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [preview, setPreview] = useState<{ file: TaskFile; url: string } | null>(null);
  const [removing, setRemoving] = useState<TaskFile | null>(null);
  const busy = operation !== null;

  useLayoutEffect(() => {
    busyCallbackRef.current = onBusyChange;
  }, [onBusyChange]);

  useLayoutEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (busyRef.current) busyCallbackRef.current?.(false);
    };
  }, []);

  // A new identity (not just taskId) also protects the A -> B -> A case.
  // Reset before paint so files/errors from the previous task never flash.
  useLayoutEffect(() => {
    scopeRef.current = { taskId, projectId };
    setFiles([]);
    setLoading(true);
    setError('');
    setLoadFailed(false);
    setPreview(null);
    setRemoving(null);
  }, [taskId, projectId]);

  function isCurrent(scope: Scope) {
    return mountedRef.current && scopeRef.current === scope;
  }

  useEffect(() => {
    const scope = scopeRef.current;
    let active = true;
    setLoading(true);
    setLoadFailed(false);
    setError('');
    void listTaskFiles(taskId)
      .then((items) => {
        if (active && mountedRef.current && scopeRef.current === scope) setFiles(items);
      })
      .catch((reason) => {
        if (active && mountedRef.current && scopeRef.current === scope) {
          setLoadFailed(true);
          setError(errorMessage(reason, 'Não foi possível carregar os anexos.'));
        }
      })
      .finally(() => {
        if (active && mountedRef.current && scopeRef.current === scope) setLoading(false);
      });
    return () => { active = false; };
  }, [taskId, projectId, reload]);

  function startOperation(next: Operation): Scope | null {
    if (!mountedRef.current || busyRef.current || loading) return null;
    busyRef.current = true;
    setOperation(next);
    setError('');
    busyCallbackRef.current?.(true);
    return scopeRef.current;
  }

  function finishOperation() {
    busyRef.current = false;
    if (mountedRef.current) {
      setOperation(null);
      busyCallbackRef.current?.(false);
    }
  }

  function refreshFiles() {
    if (busyRef.current) return;
    setLoading(true);
    setReload((value) => value + 1);
  }

  async function openFile(file: TaskFile) {
    if (file.taskId !== taskId) return;
    const scope = startOperation('preview');
    if (!scope) return;
    try {
      const url = await createProjectFileUrl(file.path);
      if (isCurrent(scope)) setPreview({ file, url });
    } catch (reason) {
      if (isCurrent(scope)) setError(errorMessage(reason, 'Não foi possível abrir o arquivo.'));
    } finally {
      finishOperation();
    }
  }

  async function downloadFile(file: TaskFile) {
    if (file.taskId !== taskId) return;
    const scope = startOperation('download');
    if (!scope) return;
    try {
      const url = await createProjectFileDownloadUrl(file.path, file.name);
      if (!isCurrent(scope)) return;
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (reason) {
      if (isCurrent(scope)) setError(errorMessage(reason, 'Não foi possível baixar o arquivo.'));
    } finally {
      finishOperation();
    }
  }

  async function upload(filesToUpload: FileList | null) {
    const file = filesToUpload?.[0];
    // Clear even rejected selections: the same file can be selected to retry.
    if (inputRef.current) inputRef.current.value = '';
    if (!file || disabled || busyRef.current || loading || loadFailed) return;
    if (file.size > MAX_TASK_FILE_SIZE) {
      setError('O arquivo deve ter no máximo 10 MB.');
      return;
    }
    const scope = startOperation('upload');
    if (!scope) return;
    try {
      const added = await uploadTaskFile(scope.projectId, scope.taskId, file);
      if (!isCurrent(scope)) return;
      setFiles((current) => [added, ...current.filter((item) => item.id !== added.id)]);
      notifySuccess('Arquivo anexado à tarefa com sucesso.');
    } catch (reason) {
      if (isCurrent(scope)) setError(errorMessage(reason, 'Não foi possível anexar o arquivo.'));
    } finally {
      finishOperation();
    }
  }

  async function removeFile() {
    const file = removing;
    if (!file || disabled || file.taskId !== taskId) return;
    const scope = startOperation('delete');
    if (!scope) return;
    try {
      await deleteTaskFile(file);
      if (!isCurrent(scope)) return;
      setFiles((current) => current.filter((item) => item.id !== file.id));
      setRemoving(null);
      if (preview?.file.id === file.id) setPreview(null);
      notifySuccess('Anexo excluído com sucesso.');
    } catch (reason) {
      if (isCurrent(scope)) setError(errorMessage(reason, 'Não foi possível excluir o anexo.'));
    } finally {
      finishOperation();
    }
  }

  // A permission/read-only change must also hide an already-open delete dialog.
  useEffect(() => {
    if (disabled && !busy) setRemoving(null);
  }, [disabled, busy]);

  const progressLabel = operation === 'upload'
    ? 'Enviando e registrando anexo... Não feche esta janela.'
    : operation === 'delete'
      ? 'Excluindo anexo...'
      : operation === 'download'
        ? 'Preparando download...'
        : 'Abrindo arquivo...';

  return <>
    <div className="space-y-3 rounded-xl border border-border bg-background p-3" aria-busy={loading || busy}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-foreground">Anexos da tarefa</p>
          <p className="text-xs text-muted-foreground">Imagens, PDFs e documentos até 10 MB.</p>
        </div>
        {!disabled && <>
          <button type="button" disabled={busy || loading || loadFailed} onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {operation === 'upload' ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            {operation === 'upload' ? 'Anexando...' : 'Anexar arquivo'}
          </button>
          <input ref={inputRef} type="file" disabled={busy || loading || loadFailed} className="hidden" aria-label="Selecionar anexo da tarefa" onChange={(event) => void upload(event.target.files)} />
        </>}
      </div>
      {busy && <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />{progressLabel}</p>}
      {error && <div role="alert" className="space-y-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
        <p>{error}</p>
        <button type="button" disabled={busy || loading} onClick={refreshFiles} className="font-semibold underline disabled:opacity-50">Atualizar anexos</button>
      </div>}
      {loading ? <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Carregando anexos...</p>
        : loadFailed ? <p className="text-xs text-muted-foreground">A lista de anexos não pôde ser carregada. Tente atualizar.</p>
          : files.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum anexo nesta tarefa.</p>
            : <div className="space-y-2">{files.map((file) => <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-2.5 py-2">
              <button type="button" disabled={busy} onClick={() => void openFile(file)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-primary disabled:cursor-not-allowed disabled:opacity-50">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span>
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-foreground">{file.name}</span>
                  <span className="block text-[10px] text-muted-foreground">{[file.type || 'Arquivo', sizeLabel(file.size)].filter(Boolean).join(' · ')}</span>
                </span>
              </button>
              <button type="button" title="Baixar arquivo" aria-label={`Baixar ${file.name}`} disabled={busy} onClick={() => void downloadFile(file)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"><Download className="size-4" /></button>
              {!disabled && <button type="button" title="Excluir arquivo" aria-label={`Excluir ${file.name}`} disabled={busy} onClick={() => { setError(''); setRemoving(file); }} className="grid size-9 shrink-0 place-items-center rounded-lg text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50"><Trash2 className="size-4" /></button>}
            </div>)}</div>}
    </div>
    {preview && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3" role="dialog" aria-modal="true" aria-labelledby={previewId} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setPreview(null); }
    }}>
      <div className="flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <p id={previewId} className="min-w-0 truncate text-sm font-medium text-foreground">{preview.file.name}</p>
          <button type="button" autoFocus onClick={() => setPreview(null)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Fechar visualização"><X className="size-5" /></button>
        </div>
        <div className="min-h-0 flex-1 bg-background p-2">
          {preview.file.type?.startsWith('image/') ? <img src={preview.url} alt={preview.file.name} className="mx-auto h-full max-h-full max-w-full object-contain" />
            : preview.file.type === 'application/pdf' ? <iframe title={preview.file.name} src={preview.url} className="h-full w-full rounded-lg" />
              : <div className="grid h-full place-items-center"><a href={preview.url} target="_blank" rel="noreferrer" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Abrir arquivo</a></div>}
        </div>
      </div>
    </div>}
    <ProjectConfirmationDialog open={!disabled && Boolean(removing)} title="Excluir anexo?" description={<>O arquivo <strong className="text-foreground">{removing?.name}</strong> será removido desta tarefa.</>} icon={<Trash2 className="size-5" />} variant="danger" confirmLabel="Excluir" pendingLabel="Excluindo..." pending={busy} error={error} onClose={() => { if (!busyRef.current) { setRemoving(null); setError(''); } }} onConfirm={() => void removeFile()} />
  </>;
}
