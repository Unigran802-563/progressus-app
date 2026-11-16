'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, Paperclip, Trash2, X } from 'lucide-react';
import ProjectConfirmationDialog from '@/components/projects/ProjectConfirmationDialog';
import { createProjectFileUrl, deleteTaskFile, listTaskFiles, uploadTaskFile, type TaskFile } from '@/lib/project-files';
import { emitSuccess } from '@/lib/feedback';

type Props = { taskId: string; projectId: string; disabled?: boolean };

function sizeLabel(size: number | null) {
  if (!size) return '';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TaskFilesPanel({ taskId, projectId, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<{ file: TaskFile; url: string } | null>(null);
  const [removing, setRemoving] = useState<TaskFile | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listTaskFiles(taskId).then((items) => { if (active) setFiles(items); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os anexos.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [taskId]);

  async function openFile(file: TaskFile) {
    try { setBusy(true); setError(''); setPreview({ file, url: await createProjectFileUrl(file.path) }); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo.'); }
    finally { setBusy(false); }
  }

  async function upload(filesToUpload: FileList | null) {
    const file = filesToUpload?.[0];
    if (!file || disabled) return;
    if (file.size > 10 * 1024 * 1024) { setError('O arquivo deve ter no máximo 10 MB.'); return; }
    try { setBusy(true); setError(''); const added = await uploadTaskFile(projectId, taskId, file); setFiles((current) => [added, ...current]); emitSuccess('Arquivo anexado à tarefa com sucesso.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível anexar o arquivo.'); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  }

  async function removeFile() {
    if (!removing) return;
    try { setBusy(true); await deleteTaskFile(removing); setFiles((current) => current.filter((item) => item.id !== removing.id)); setRemoving(null); emitSuccess('Anexo excluído com sucesso.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o anexo.'); }
    finally { setBusy(false); }
  }

  return <>
    <div className="space-y-3 rounded-xl border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-medium text-foreground">Anexos da tarefa</p><p className="text-xs text-muted-foreground">Imagens, PDFs e documentos até 10 MB.</p></div><button type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Paperclip className="size-4" />Anexar arquivo</button><input ref={inputRef} type="file" className="hidden" onChange={(event) => void upload(event.target.files)} /></div>
      {error && <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">{error}</p>}
      {loading ? <p className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" />Carregando anexos...</p> : files.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum anexo nesta tarefa.</p> : <div className="space-y-2">{files.map((file) => <div key={file.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-border px-2.5 py-2"><button type="button" onClick={() => void openFile(file)} className="flex min-w-0 flex-1 items-center gap-2 text-left hover:text-primary"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><FileText className="size-4" /></span><span className="min-w-0"><span className="block truncate text-xs font-medium text-foreground">{file.name}</span><span className="block text-[10px] text-muted-foreground">{file.type || 'Arquivo'} · {sizeLabel(file.size)}</span></span></button><button type="button" title="Baixar arquivo" onClick={() => void openFile(file)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><Download className="size-4" /></button><button type="button" title="Excluir arquivo" disabled={disabled || busy} onClick={() => setRemoving(file)} className="grid size-9 shrink-0 place-items-center rounded-lg text-danger hover:bg-danger/10 disabled:opacity-50"><Trash2 className="size-4" /></button></div>)}</div>}
    </div>
    {preview && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3" role="dialog" aria-modal="true"><div className="flex h-full max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-surface"><div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><p className="min-w-0 truncate text-sm font-medium text-foreground">{preview.file.name}</p><button type="button" onClick={() => setPreview(null)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Fechar visualização"><X className="size-5" /></button></div><div className="min-h-0 flex-1 bg-background p-2">{preview.file.type?.startsWith('image/') ? <img src={preview.url} alt={preview.file.name} className="mx-auto h-full max-h-full max-w-full object-contain" /> : preview.file.type === 'application/pdf' ? <iframe title={preview.file.name} src={preview.url} className="h-full w-full rounded-lg" /> : <div className="grid h-full place-items-center"><a href={preview.url} target="_blank" rel="noreferrer" className="rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground">Abrir arquivo</a></div>}</div></div></div>}
    <ProjectConfirmationDialog open={Boolean(removing)} title="Excluir anexo?" description={<>O arquivo <strong className="text-foreground">{removing?.name}</strong> será removido desta tarefa.</>} icon={<Trash2 className="size-5" />} variant="danger" confirmLabel="Excluir" pendingLabel="Excluindo..." pending={busy} error={error} onClose={() => setRemoving(null)} onConfirm={() => void removeFile()} />
  </>;
}
