const TOOLTIP_SELECTOR = '[data-tooltip]';
const TOOLTIP_LAYER_ID = 'ez-shell-tooltip-layer';
const TOOLTIP_GAP = 10;
const TOOLTIP_EDGE_PADDING = 8;
const TOOLTIP_INIT_FLAG = '__ez_shell_tooltip_initialized__';

function getTooltipTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>(TOOLTIP_SELECTOR);
}

function getTooltipText(target: HTMLElement): string {
  return target.getAttribute('data-tooltip')?.trim() ?? '';
}

export function setupEzGlobalTooltip(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return;
  }

  const globalState = window as unknown as Record<string, unknown>;
  if (globalState[TOOLTIP_INIT_FLAG]) {
    return;
  }
  globalState[TOOLTIP_INIT_FLAG] = true;

  const existingLayer = document.getElementById(TOOLTIP_LAYER_ID);
  const layer =
    existingLayer instanceof HTMLDivElement ? existingLayer : document.createElement('div');
  layer.id = TOOLTIP_LAYER_ID;
  layer.className = 'app-tooltip-layer';
  layer.hidden = true;
  if (!layer.isConnected) {
    document.body.appendChild(layer);
  }

  let activeTarget: HTMLElement | null = null;

  const hideTooltip = (): void => {
    activeTarget = null;
    layer.classList.remove('open');
    layer.hidden = true;
  };

  const placeTooltip = (): void => {
    if (!activeTarget || layer.hidden) {
      return;
    }

    const targetRect = activeTarget.getBoundingClientRect();
    const layerRect = layer.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = targetRect.right + TOOLTIP_GAP;
    if (left + layerRect.width > viewportWidth - TOOLTIP_EDGE_PADDING) {
      left = targetRect.left - TOOLTIP_GAP - layerRect.width;
    }
    left = Math.max(
      TOOLTIP_EDGE_PADDING,
      Math.min(left, viewportWidth - layerRect.width - TOOLTIP_EDGE_PADDING)
    );

    let top = targetRect.top + targetRect.height / 2 - layerRect.height / 2;
    top = Math.max(
      TOOLTIP_EDGE_PADDING,
      Math.min(top, viewportHeight - layerRect.height - TOOLTIP_EDGE_PADDING)
    );

    layer.style.left = `${Math.round(left)}px`;
    layer.style.top = `${Math.round(top)}px`;
  };

  const showTooltip = (target: HTMLElement): void => {
    const text = getTooltipText(target);
    if (!text) {
      hideTooltip();
      return;
    }

    activeTarget = target;
    layer.textContent = text;
    layer.hidden = false;
    layer.classList.add('open');
    placeTooltip();
  };

  document.addEventListener(
    'mouseover',
    (event) => {
      const target = getTooltipTarget(event.target);
      if (target) {
        showTooltip(target);
      }
    },
    true
  );

  document.addEventListener(
    'mouseout',
    (event) => {
      if (!activeTarget) {
        return;
      }

      const from = event.target;
      if (!(from instanceof Node) || !activeTarget.contains(from)) {
        return;
      }

      const related = event.relatedTarget;
      if (related instanceof Node && activeTarget.contains(related)) {
        return;
      }

      hideTooltip();
    },
    true
  );

  document.addEventListener(
    'focusin',
    (event) => {
      const target = getTooltipTarget(event.target);
      if (target) {
        showTooltip(target);
      }
    },
    true
  );

  document.addEventListener(
    'focusout',
    () => {
      queueMicrotask(() => {
        if (!activeTarget) {
          return;
        }

        const focusedElement = document.activeElement;
        if (focusedElement instanceof Node && activeTarget.contains(focusedElement)) {
          return;
        }

        hideTooltip();
      });
    },
    true
  );

  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape') {
        hideTooltip();
      }
    },
    true
  );

  const onViewportChanged = (): void => {
    if (activeTarget && !layer.hidden) {
      placeTooltip();
    }
  };

  window.addEventListener('resize', onViewportChanged);
  window.addEventListener('scroll', onViewportChanged, true);
}
