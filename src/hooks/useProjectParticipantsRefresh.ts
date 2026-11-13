'use client';

import { useEffect, useRef } from 'react';
import { listProjectParticipants } from '@/lib/projects';
import type { AccessibleProject, ProjectParticipant } from '@/types';

export function useProjectParticipantsRefresh(
  projectId: string,
  enabled: boolean,
  onRefresh: (participants: ProjectParticipant[]) => void,
  onAccessRevoked: () => void,
) {
  const callbacks = useRef({ onRefresh, onAccessRevoked });
  callbacks.current = { onRefresh, onAccessRevoked };

  useEffect(() => {
    if (!enabled || !projectId) return;
    let active = true;
    let request = 0;
    function refresh(event: Event) {
      const projects = (event as CustomEvent<{ projects: AccessibleProject[] }>).detail?.projects;
      if (!projects) return;
      const currentRequest = ++request;
      if (!projects.some((project) => project.id === projectId && project.myRole !== 'viewer' && !project.archivedAt)) {
        callbacks.current.onAccessRevoked();
        return;
      }
      void listProjectParticipants(projectId).then((participants) => {
        if (active && request === currentRequest) callbacks.current.onRefresh(participants.filter((participant) => participant.role !== 'viewer'));
      }).catch(() => { /* Uma falha de rede não deve apagar uma seleção válida. */ });
    }
    window.addEventListener('progressus:project-access-checked', refresh);
    return () => {
      active = false;
      window.removeEventListener('progressus:project-access-checked', refresh);
    };
  }, [projectId, enabled]);
}
