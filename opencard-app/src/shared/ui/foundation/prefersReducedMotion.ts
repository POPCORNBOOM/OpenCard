/**
 * The reduced-motion media query, or `null` in an environment without the media query API.
 *
 * jsdom ships no `window.matchMedia`, and an unguarded read throws from inside a mount or a
 * transition hook — which silently aborts the surrounding lifecycle work. Callers that only need
 * the current answer should use `prefersReducedMotion`; callers that keep the query to observe
 * later changes should handle `null` and skip the listener.
 */
export function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null
  return window.matchMedia('(prefers-reduced-motion: reduce)')
}

/** Whether the user asked the system for reduced motion; motion is allowed where the API is absent. */
export function prefersReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false
}
