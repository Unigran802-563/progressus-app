'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, Paperclip, Plus, Upload } from 'lucide-react';

import { createProjectFileUrl, listProjectFiles, uploadProjectFile, type ProjectFile } from '@/lib/project-files';
import { EmptyState } from '@/components/ui/progressus-ui';

type Props = { projectId: string; disabled?: boolean };

function formatSize(size: number | null) {
  if (!size) return 'Tamanho indisponível';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ProjectFilesPanel({ projectId, disabled = false }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  async function loadFiles() {
    try {
      setLoading(true);
      setError('');
      setFiles(await listProjectFiles(projectId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os arquivos.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadFiles();
  }, [projectId]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      setError('O arquivo ultrapassa o limite de 50 MB.');
      return;
    }
    try {
      setUploading(true);
      setError('');
      const created = await uploadProjectFile(projectId, file);
      setFiles((current) => [created, ...current]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível enviar o arquivo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDownload(file: ProjectFile) {
    try {
      const url = await createProjectFileUrl(file.path);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível abrir o arquivo.');
    }
  }

  return (
    <div className="p-5">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">Arquivos do projeto</h3>
          <p className="mt-1 text-sm text-muted-foreground">Arquivos enviados aqui e anexados às mensagens do Chat.</p>
        </div>
        <>
          <input ref={inputRef} type="file" className="hidden" onChange={handleUpload} disabled={disabled || uploading} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || uploading} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {uploading ? 'Enviando...' : 'Enviar arquivo'}
          </button>
        </>
      </div>

      {error && <div className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">{error}</div>}
      {loading ? <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />Carregando arquivos...</div> : files.length === 0 ? <EmptyState icon={<FileText className="size-5" />} title="Nenhum arquivo enviado" description="Envie um arquivo aqui ou anexe documentos no Chat do projeto." /> : <div className="grid gap-3 md:grid-cols-2">{files.map((file) => <article key={file.id} className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">{file.source === 'chat' ? <Paperclip className="size-5" /> : <FileText className="size-5" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-foreground">{file.name}</p><p className="mt-1 text-xs text-muted-foreground">{file.source === 'chat' ? 'Anexo do Chat' : 'Arquivo do projeto'} · {formatSize(file.size)}</p></div><button type="button" onClick={() => void handleDownload(file)} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary" title="Baixar arquivo"><Download className="size-4" /></button></article>)}</div>}
    </div>
  );
}
