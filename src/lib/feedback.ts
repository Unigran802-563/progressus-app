export function emitSuccess(message: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem('progressus:pending-success', message);
  window.dispatchEvent(new CustomEvent('progressus:success', { detail: { message } }));
}
