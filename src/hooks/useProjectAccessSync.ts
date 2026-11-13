'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { listAccessibleProjects } from '@/lib/projects';
import { supabase } from '@/lib/supabase';

// As permissões são revogadas imediatamente pelo banco. Esta sincronização
// também remove os dados já carregados na interface, sem exigir F5.
export function useProjectAccessSync() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let refreshing = false;

    async function refreshAccess() {
      if (refreshing || document.visibilityState === 'hidden') return;
      refreshing = true;
      try {
        const { data } = await supabase.auth.getSession();
        if (!active || !data.session) return;
        const projects = await listAccessibleProjects({ includeArchived: true });
        if (!active) return;
        const accessibleIds = new Set(projects.map((project) => project.id));
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
        } catch { /* Cache inválido não pode impedir a verificação de acesso. */ }
        const projectRoute = pathname.match(/^\/projects\/([^/]+)/)?.[1];
        const projectChatRoute = pathname.match(/^\/chat\/([^/]+)/)?.[1];
        const queryProjectId = pathname === '/chat' ? new URLSearchParams(window.location.search).get('projectId') : null;
        const selectedProject = projectRoute || projectChatRoute || queryProjectId;

        window.dispatchEvent(new CustomEvent('progressus:project-access-checked', { detail: { projects } }));
        if (selectedProject && !accessibleIds.has(selectedProject)) {
          router.replace(pathname.startsWith('/chat') ? '/chat' : '/projects');
        }
      } catch {
        // Falha transitória de rede não deve ser interpretada como perda de acesso.
      } finally {
        refreshing = false;
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void refreshAccess();
    }
    const refresh = () => { void refreshAccess(); };
    const timer = window.setInterval(refresh, 20000);
    window.addEventListener('focus', refresh);
    window.addEventListener('progressus:project-members-changed', refresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('progressus:project-members-changed', refresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [pathname, router]);
}
