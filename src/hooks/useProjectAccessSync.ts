'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { listAccessibleProjects } from '@/lib/projects';
import { supabase } from '@/lib/supabase';

// RLS protege as próximas consultas. Estes eventos também retiram dados já
// carregados da interface; o intervalo existente é fallback para falhas Realtime.
export function useProjectAccessSync() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let refreshing = false;
    let pendingRefresh = false;
    let signature = '';

    async function refreshAccess() {
      if (!active || document.visibilityState === 'hidden') return;
      if (refreshing) { pendingRefresh = true; return; }
      refreshing = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!active || !data.session) return;
        const projects = await listAccessibleProjects({ includeArchived: true });
        if (!active) return;
        const accessibleIds = new Set(projects.map((project) => project.id));
        const activeProjects = projects.filter((project) => !project.archivedAt && !project.deletedAt);
        const nextSignature = JSON.stringify(projects.map((p) => [p.id, p.archivedAt, p.deletedAt, p.myRole]).sort());
        const changed = signature !== nextSignature;
        signature = nextSignature;
        try {
          const key = `progressus:chat-notifications:${data.session.user.id}`;
          const saved = window.localStorage.getItem(key);
          if (saved) {
            const items = JSON.parse(saved) as Array<{ id: string; href: string }>;
            const readIds = JSON.parse(window.localStorage.getItem(`progressus:read-notifications:${data.session.user.id}`) || '[]') as string[];
            const removedUnread: string[] = [];
            const visible = items.filter((item) => {
              const url = new URL(item.href, window.location.origin);
              const projectId = url.searchParams.get('projectId') || url.pathname.match(/^\/chat\/([^/]+)/)?.[1];
              if (!projectId || accessibleIds.has(projectId)) return true;
              if (!readIds.includes(item.id)) removedUnread.push(item.id);
              return false;
            });
            if (visible.length !== items.length) {
              window.localStorage.setItem(key, JSON.stringify(visible));
              const unread = Number(window.localStorage.getItem('progressus:unread-notifications') || 0);
              window.localStorage.setItem('progressus:unread-notifications', String(Math.max(0, unread - removedUnread.length)));
              window.dispatchEvent(new Event('progressus:notifications-changed'));
            }
          }
        } catch { /* Cache inválido não impede a verificação de acesso. */ }
        const projectRoute = pathname.match(/^\/projects\/([^/]+)/)?.[1];
        const projectChatRoute = pathname.match(/^\/chat\/([^/]+)/)?.[1];
        const queryProjectId = pathname === '/chat' ? new URLSearchParams(window.location.search).get('projectId') : null;
        const selectedProject = projectRoute || projectChatRoute || queryProjectId;

        window.dispatchEvent(new CustomEvent('progressus:project-access-checked', { detail: { projects, activeProjects } }));
        if (changed) window.dispatchEvent(new Event('progressus:tasks-changed'));
        // Preservar a confirmação visual após a exclusão feita nesta mesma tela.
        if (selectedProject && !accessibleIds.has(selectedProject) && !document.getElementById('project-success-title')) {
          router.replace(pathname.startsWith('/chat') ? '/chat' : '/projects');
        }
      } catch {
        // Falha transitória não deve ser interpretada como perda de acesso.
      } finally {
        refreshing = false;
        if (pendingRefresh && active) { pendingRefresh = false; void refreshAccess(); }
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshAccess();
    }
    const refresh = () => { void refreshAccess(); };
    const channel = supabase.channel(`progressus-project-lifecycle-${pathname}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'projeto' }, refresh)
      .subscribe();
    const timer = window.setInterval(refresh, 20000);
    void refreshAccess();
    window.addEventListener('focus', refresh);
    window.addEventListener('progressus:project-members-changed', refresh);
    window.addEventListener('progressus:projects-changed', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      void supabase.removeChannel(channel);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('progressus:project-members-changed', refresh);
      window.removeEventListener('progressus:projects-changed', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pathname, router]);
}
