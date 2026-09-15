/**
 * Whether the user asked the system for reduced motion.
 *
 * The media query API is not available in every environment — jsdom, for one — where motion should
 * simply be treated as allowed rather than throwing from inside a transition hook.
 */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
