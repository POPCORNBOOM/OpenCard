import { mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { useFeedbackDiagnostics } from './useFeedbackDiagnostics'

function mountCapture() {
  return mount(defineComponent({
    setup() {
      const capture = useFeedbackDiagnostics()
      return capture
    },
    template: '<div />',
  }))
}

describe('useFeedbackDiagnostics', () => {
  it('keeps the latest uncaught error in memory after immediate redaction', async () => {
    const wrapper = mountCapture()
    const error = new Error('Failed to read C:\\Users\\Alice\\secret.opencard')
    window.dispatchEvent(new ErrorEvent('error', { error, message: error.message }))
    await nextTick()

    expect(wrapper.vm.latestDiagnostics).toBeDefined()
    expect(wrapper.vm.latestDiagnostics!.errorMessage).toContain('<local-path>')
    expect(wrapper.vm.latestDiagnostics!.errorMessage).not.toContain('Alice')
    wrapper.unmount()
  })

  it('removes global listeners when its owner unmounts', async () => {
    const wrapper = mountCapture()
    window.dispatchEvent(new ErrorEvent('error', { message: 'first' }))
    await nextTick()
    expect(wrapper.vm.latestDiagnostics).toBeDefined()
    expect(wrapper.vm.latestDiagnostics!.errorMessage).toBe('first')

    wrapper.unmount()
    window.dispatchEvent(new ErrorEvent('error', { message: 'second' }))
    expect(wrapper.vm.latestDiagnostics!.errorMessage).toBe('first')
  })
})
