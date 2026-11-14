export function emitSuccess(message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('progressus:success', { detail: { message } }));
}
