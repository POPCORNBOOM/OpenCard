import { defineComponent, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import OcTab from './OcTab.vue'
import OcTabBar from './OcTabBar.vue'

function mountTabHarness() {
  const selectSpy = vi.fn()

  const Harness = defineComponent({
    components: {
      OcTab,
      OcTabBar,
    },
    setup() {
      const activeId = ref('uno')

      function handleSelect(id: string) {
        activeId.value = id
        selectSpy(id)
      }

      return {
        activeId,
        handleSelect,
      }
    },
    template: `
      <div>
        <OcTabBar aria-label="Open editors">
          <OcTab
            label="Uno.opencard"
            :active="activeId === 'uno'"
            closable
            @select="handleSelect('uno')"
          />
          <OcTab
            label="Blue.opencard"
            :active="activeId === 'blue'"
            :disabled="true"
            closable
            @select="handleSelect('blue')"
          />
          <OcTab
            label="WildDraw4.opencard"
            :active="activeId === 'wild'"
            dirty
            closable
            @select="handleSelect('wild')"
          />
        </OcTabBar>
        <output data-selected>{{ activeId }}</output>
      </div>
    `,
  })

  const wrapper = mount(Harness)
  return {
    wrapper,
    selectSpy,
  }
}

describe('OcTabBar', () => {
  it('renders tablist semantics', () => {
    const wrapper = mount(OcTabBar, {
      slots: {
        default: '<div role="tab" data-oc-tab>Tab</div>',
      },
    })

    expect(wrapper.attributes('role')).toBe('tablist')
  })

  it('moves selection with ArrowRight and skips disabled tabs', async () => {
    const { wrapper, selectSpy } = mountTabHarness()

    await wrapper.get('.oc-tab[aria-selected="true"]').trigger('keydown', { key: 'ArrowRight' })
    await nextTick()

    expect(selectSpy).toHaveBeenLastCalledWith('wild')
    expect(wrapper.get('[data-selected]').text()).toBe('wild')
  })

  it('jumps to the first and last enabled tabs with Home and End', async () => {
    const { wrapper, selectSpy } = mountTabHarness()

    await wrapper.get('.oc-tab[aria-selected="true"]').trigger('keydown', { key: 'End' })
    await nextTick()
    expect(selectSpy).toHaveBeenLastCalledWith('wild')

    await wrapper.get('.oc-tab[aria-selected="true"]').trigger('keydown', { key: 'Home' })
    await nextTick()
    expect(selectSpy).toHaveBeenLastCalledWith('uno')
    expect(wrapper.get('[data-selected]').text()).toBe('uno')
  })

  it('does not switch the parent tab when key events come from the close button', async () => {
    const { wrapper, selectSpy } = mountTabHarness()

    await wrapper.get('.oc-tab[aria-selected="true"] .oc-tab__close').trigger('keydown', { key: 'Enter' })
    await nextTick()

    expect(selectSpy).not.toHaveBeenCalled()
    expect(wrapper.get('[data-selected]').text()).toBe('uno')
  })
})
