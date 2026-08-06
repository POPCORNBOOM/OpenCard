import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OcActionButton from './OcActionButton.vue'

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  }
}

describe('OcActionButton', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('forwards the declared icon tone to the action icon', () => {
    const wrapper = mount(OcActionButton, {
      props: {
        action: {
          key: 'open',
          icon: 'action.play',
          iconTone: 'success',
          title: 'Open',
        },
      },
    })

    expect(wrapper.find('.oc-button__icon').attributes('style')).toContain('var(--oc-icon-success)')
    expect(wrapper.find('.oc-button__icon').classes()).toContain('oc-icon--action')
    expect(wrapper.get('button').attributes('data-tooltip')).toBe('Open')
    expect(wrapper.get('button').attributes('title')).toBeUndefined()
  })

  it('decouples the action icon size from the button target size', () => {
    const wrapper = mount(OcActionButton, {
      props: {
        action: { key: 'zoom', icon: 'tool.zoom-in', title: 'Zoom in' },
        size: 'md',
        iconSize: 'action',
      },
    })

    expect(wrapper.get('button').classes()).toContain('oc-button--size-md')
    expect(wrapper.get('.oc-button__icon').classes()).toContain('oc-icon--action')
  })

  it('mounts floating behavior and the outside listener only when needed', async () => {
    const addListener = vi.spyOn(document, 'addEventListener')
    const wrapper = mount(OcActionButton, {
      attachTo: document.body,
      props: {
        action: {
          key: 'more',
          title: 'More',
          children: [{ key: 'delete', title: 'Delete' }],
        },
      },
    })

    expect(document.body.querySelector('.oc-floating-layer')).toBeNull()
    expect(addListener.mock.calls.some(([type]) => type === 'pointerdown')).toBe(false)

    await wrapper.trigger('pointerenter')
    await flushPromises()
    expect(document.body.querySelector('.oc-floating-layer')).not.toBeNull()
    expect(addListener.mock.calls.some(([type]) => type === 'pointerdown')).toBe(false)

    await wrapper.get('button').trigger('click')
    expect(addListener.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true)
    wrapper.unmount()
  })

  it('uses the shared floating layer and flips above the anchor', async () => {
    vi.stubGlobal('innerWidth', 300)
    vi.stubGlobal('innerHeight', 200)
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      if (this.classList.contains('oc-action-button')) return rect(0, 170, 30, 24)
      if (this.classList.contains('oc-floating-layer')) return rect(0, 0, 156, 80)
      return rect(0, 0, 0, 0)
    })

    const wrapper = mount(OcActionButton, {
      attachTo: document.body,
      props: {
        action: {
          key: 'add',
          title: 'Add',
          children: [{ key: 'text', title: 'Text' }],
        },
      },
    })

    await wrapper.trigger('pointerenter')
    await flushPromises()

    const layer = document.body.querySelector<HTMLElement>('.oc-action-button__floating')
    const menu = document.body.querySelector<HTMLElement>('.oc-action-menu')
    expect(layer?.style.position).toBe('fixed')
    expect(layer?.style.visibility).toBe('visible')
    expect(layer?.dataset.placement).toMatch(/^top-/)
    expect(menu).not.toBeNull()

    wrapper.unmount()
  })

  it('keeps a hover-opened menu open when the action button is clicked', async () => {
    const wrapper = mount(OcActionButton, {
      attachTo: document.body,
      props: {
        action: {
          key: 'more',
          title: 'More',
          children: [{ key: 'reveal', title: 'Reveal in File Manager' }],
        },
      },
    })

    await wrapper.trigger('pointerenter')
    await flushPromises()
    expect(document.body.querySelector('.oc-action-menu')).not.toBeNull()

    await wrapper.get('button[aria-label="More"]').trigger('click')
    await wrapper.trigger('pointerleave')
    await new Promise((resolve) => window.setTimeout(resolve, 120))
    await flushPromises()
    const revealButton = document.body.querySelector<HTMLButtonElement>(
      '.oc-action-menu__button[data-tooltip="Reveal in File Manager"]',
    )
    expect(revealButton).not.toBeNull()

    revealButton?.click()
    await flushPromises()
    expect(wrapper.emitted('select')).toEqual([[{ key: 'reveal' }]])
    expect(document.body.querySelector('.oc-action-menu')).toBeNull()

    wrapper.unmount()
  })

  it('selects a leaf through four teleported menu levels without dismissing its ancestors', async () => {
    const wrapper = mount(OcActionButton, {
      attachTo: document.body,
      props: {
        action: {
          key: 'more',
          title: 'More',
          children: [{
            key: 'delete',
            title: 'Delete',
            children: [{
              key: 'danger',
              title: 'Danger',
              children: [{
                key: 'really-delete',
                title: 'Really Delete',
                children: [{ key: 'confirm-delete', title: 'Confirm Delete' }],
              }],
            }],
          }],
        },
      },
    })

    await wrapper.trigger('pointerenter')
    await flushPromises()
    await wrapper.get('button[aria-label="More"]').trigger('click')

    for (let depth = 1; depth < 4; depth += 1) {
      const layersBeforeOpen = document.body.querySelectorAll<HTMLElement>('.oc-floating-layer')
      const parentLayer = layersBeforeOpen[layersBeforeOpen.length - 1]
      parentLayer?.querySelector<HTMLElement>('.oc-action-menu__item')
        ?.dispatchEvent(new Event('pointerenter'))
      await flushPromises()

      const layersAfterOpen = document.body.querySelectorAll<HTMLElement>('.oc-floating-layer')
      expect(layersAfterOpen).toHaveLength(depth + 1)
      parentLayer?.dispatchEvent(new Event('pointerleave'))
      layersAfterOpen[layersAfterOpen.length - 1]?.dispatchEvent(new Event('pointerenter'))
    }

    await new Promise((resolve) => window.setTimeout(resolve, 120))
    expect(document.body.querySelectorAll('.oc-floating-layer')).toHaveLength(4)
    expect(document.body.querySelectorAll('.oc-action-menu')).toHaveLength(4)

    const confirmButton = document.body.querySelector<HTMLButtonElement>(
      '.oc-action-menu__button[data-tooltip="Confirm Delete"]',
    )
    expect(confirmButton).not.toBeNull()
    confirmButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true }))
    await flushPromises()
    expect(confirmButton?.isConnected).toBe(true)

    confirmButton?.click()
    await flushPromises()
    expect(wrapper.emitted('select')).toEqual([[{ key: 'confirm-delete' }]])
    expect(document.body.querySelectorAll('.oc-floating-layer')).toHaveLength(0)

    wrapper.unmount()
  })
})
