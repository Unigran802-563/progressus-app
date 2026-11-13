'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProjectTasksPanel from '@/components/projects/ProjectTasksPanel';
import { useProjectAccessSync } from '@/hooks/useProjectAccessSync';
import { getProject, getProjectMember } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import type { AccessibleProject, Project, ProjectRole } from '@/types';

type TasksPageProps = {
  params: Promise<{ id: string }>;
};

export default function TasksPage({ params }: TasksPageProps) {
  const router = useRouter();
  const [projectId, setProjectId] = useState('');
  const [project, setProject] = useState<Project | null>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // A rota alternativa mantém a mesma sincronização de acesso do AppShell.
  useProjectAccessSync();

  useEffect(() => {
    let active = true;
    let request = 0;
    let userId = '';
    let id = '';

    async function loadProject() {
      if (!userId || !id) return;
      const currentRequest = ++request;
      try {
        const [projectData, memberData] = await Promise.all([
          getProject(id),
          getProjectMember(id, userId),
        ]);
        if (!active || currentRequest !== request) return;
        if (!projectData || !memberData) {
          setProject(null);
          setProjectRole(null);
          setError('Este projeto não existe ou você não tem acesso a ele.');
          return;
        }
        setProject(projectData);
        setProjectRole(memberData.role);
        setError('');
      } catch (err) {
        if (!active || currentRequest !== request) return;
        setProject(null);
        setProjectRole(null);
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o projeto.');
      } finally {
        if (active && currentRequest === request) setLoading(false);
      }
    }

    async function initialize() {
      try {
        const [resolvedParams, { data, error: authError }] = await Promise.all([params, supabase.auth.getUser()]);
        if (!active) return;
        if (authError || !data.user) {
          router.replace('/auth/login');
          return;
        }
        id = resolvedParams.id;
        userId = data.user.id;
        setProjectId(id);
        await loadProject();
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Não foi possível carregar o projeto.');
        setLoading(false);
      }
    }

    function refreshAccess(event: Event) {
      const projects = (event as CustomEvent<{ projects: AccessibleProject[] }>).detail?.projects;
      if (projects && id) {
        const accessibleProject = projects.find((item) => item.id === id);
        setProject(accessibleProject ?? null);
        setProjectRole(accessibleProject?.myRole ?? null);
        if (!accessibleProject) setError('Você não tem mais acesso a este projeto.');
      }
      void loadProject();
    }

    void initialize();
    window.addEventListener('progressus:project-access-checked', refreshAccess);
    return () => {
      active = false;
      window.removeEventListener('progressus:project-access-checked', refreshAccess);
    };
  }, [params, router]);

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
            <Link href={projectId ? `/projects/${projectId}` : '/projects'} className="mb-3 inline-block text-sm text-zinc-400 transition hover:text-white">
              ← Voltar para o projeto
            </Link>
            <h1 className="text-3xl font-semibold tracking-tight">Tarefas do projeto</h1>
            <p className="mt-2 text-sm text-zinc-400">Organize as atividades no quadro Kanban.</p>
          </div>
        </div>

        {error || !project ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">
            {error || 'Projeto indisponível.'}
          </div>
        ) : (
          <>
            {project.archivedAt && <p className="mb-4 text-sm text-zinc-400">Projeto arquivado. As tarefas estão disponíveis somente para leitura.</p>}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
              <ProjectTasksPanel projectId={project.id} disabled={Boolean(project.archivedAt) || projectRole === 'viewer' || !projectRole} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
