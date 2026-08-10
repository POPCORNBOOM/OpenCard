import { resolveIcon, type IconToken } from '../icon/iconRegistry';

const TOOLTIP_SELECTOR = '[data-tooltip]';
const TOOLTIP_LAYER_ID = 'oc-tooltip-layer';
const TOOLTIP_GAP = 10;
const TOOLTIP_EDGE_PADDING = 8;
const TOOLTIP_POINTER_DELAY_MS = 350;
const TOOLTIP_INIT_FLAG = '__oc_tooltip_initialized__';
const TOOLTIP_INLINE_PATTERN = /\[\[(icon|chip):([^\]\r\n]+)\]\]|\[(b|i|key)\]([^\[\]\r\n]+)\[\/\3\]|\[br\]/gi;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

function getTooltipTarget(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest<HTMLElement>(TOOLTIP_SELECTOR);
}

function getTooltipText(target: HTMLElement): string {
  return target.getAttribute('data-tooltip')?.trim() ?? '';
}

function createTooltipIcon(token: string): SVGSVGElement {
  const glyph = resolveIcon(token as IconToken, 'globalTooltip.inline');
  const icon = document.createElementNS(SVG_NAMESPACE, 'svg');
  icon.setAttribute('class', 'oc-inline-icon');
  icon.setAttribute('viewBox', glyph.viewBox ?? '0 0 24 24');
  icon.setAttribute('fill', 'currentColor');
  icon.setAttribute('aria-hidden', 'true');

  const path = document.createElementNS(SVG_NAMESPACE, 'path');
  path.setAttribute('d', glyph.path);
  icon.appendChild(path);
  return icon;
}

function createTooltipChip(text: string): HTMLSpanElement {
  const chip = document.createElement('span');
  chip.className = 'oc-chip';
  chip.textContent = text;
  return chip;
}

function createTooltipKey(text: string): HTMLSpanElement {
  const key = document.createElement('span');
  key.className = 'oc-key';
  key.textContent = text;
  return key;
}

function renderTooltipContent(layer: HTMLDivElement, text: string): void {
  const fragment = document.createDocumentFragment();
  let cursor = 0;

  for (const match of text.matchAll(TOOLTIP_INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      fragment.append(document.createTextNode(text.slice(cursor, index)));
    }

    const kind = match[1];
    const value = match[2]?.trim() ?? '';
    const bbcodeTag = match[3]?.toLocaleLowerCase();
    const bbcodeText = match[4]?.trim() ?? '';
    if (match[0].toLocaleLowerCase() === '[br]') {
      fragment.append(document.createElement('br'));
    } else if (bbcodeTag === 'key') {
      fragment.append(createTooltipKey(bbcodeText));
    } else if (bbcodeTag === 'b' || bbcodeTag === 'i') {
      const emphasis = document.createElement(bbcodeTag === 'b' ? 'strong' : 'em');
      emphasis.textContent = bbcodeText;
      fragment.append(emphasis);
    } else if (!value) {
      fragment.append(document.createTextNode(match[0]));
    } else if (kind === 'icon') {
      fragment.append(createTooltipIcon(value));
    } else {
      fragment.append(createTooltipChip(value));
    }
    cursor = index + match[0].length;
  }

  if (cursor < text.length) {
    fragment.append(document.createTextNode(text.slice(cursor)));
  }
  layer.replaceChildren(fragment);
}

export function setupGlobalTooltip(): void {
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
  layer.setAttribute('role', 'tooltip');
  layer.hidden = true;
  if (!layer.isConnected) {
    document.body.appendChild(layer);
  }

  let activeTarget: HTMLElement | null = null;
  let pendingTarget: HTMLElement | null = null;
  let showTimer: number | null = null;

  const cancelPendingTooltip = (): void => {
    pendingTarget = null;
    if (showTimer === null) return;
    window.clearTimeout(showTimer);
    showTimer = null;
  };

  const hideTooltip = (): void => {
    cancelPendingTooltip();
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
    cancelPendingTooltip();
    const text = getTooltipText(target);
    if (!text || !target.isConnected) {
      hideTooltip();
      return;
    }

    activeTarget = target;
    renderTooltipContent(layer, text);
    layer.hidden = false;
    layer.classList.add('open');
    placeTooltip();
  };

  const scheduleTooltip = (target: HTMLElement): void => {
    if (target === activeTarget || target === pendingTarget) return;
    hideTooltip();
    pendingTarget = target;
    showTimer = window.setTimeout(() => {
      showTimer = null;
      pendingTarget = null;
      showTooltip(target);
    }, TOOLTIP_POINTER_DELAY_MS);
  };

  document.addEventListener(
    'mouseover',
    (event) => {
      const target = getTooltipTarget(event.target);
      if (target) {
        scheduleTooltip(target);
      }
    },
    true
  );

  document.addEventListener(
    'mouseout',
    (event) => {
      const trackedTarget = activeTarget ?? pendingTarget;
      if (!trackedTarget) {
        return;
      }

      const from = event.target;
      if (!(from instanceof Node) || !trackedTarget.contains(from)) {
        return;
      }

      const related = event.relatedTarget;
      if (related instanceof Node && trackedTarget.contains(related)) {
        return;
      }

      hideTooltip();
    },
    true
  );

  document.addEventListener('pointerdown', hideTooltip, true);

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
        const trackedTarget = activeTarget ?? pendingTarget;
        if (!trackedTarget) {
          return;
        }

        const focusedElement = document.activeElement;
        if (focusedElement instanceof Node && trackedTarget.contains(focusedElement)) {
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
      if (!activeTarget.isConnected) {
        hideTooltip();
        return;
      }
      placeTooltip();
    }
  };

  window.addEventListener('resize', onViewportChanged);
  window.addEventListener('scroll', onViewportChanged, true);
}
