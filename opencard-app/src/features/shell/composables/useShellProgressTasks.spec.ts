import { afterEach, describe, expect, it, vi } from 'vitest'
import { useShellProgressTasks } from './useShellProgressTasks'

const TEST_TASK_KEY = 'test-shell-progress-task'

describe('useShellProgressTasks', () => {
  const registry = useShellProgressTasks()

  afterEach(() => {
    registry.removeTask(TEST_TASK_KEY)
  })

  it('registers, normalizes, updates, and removes progress tasks', () => {
    registry.setTask({
      key: TEST_TASK_KEY,
      title: 'Exporting cards',
      progress: 1.5,
      weight: 0,
      active: false,
    })

    expect(registry.tasks.value.find((task) => task.key === TEST_TASK_KEY)).toEqual({
      key: TEST_TASK_KEY,
      title: 'Exporting cards',
      progress: 1,
      weight: 1,
      active: false,
    })

    registry.setTask({
      key: TEST_TASK_KEY,
      title: 'Exporting cards',
      progress: 0.4,
      weight: 3,
    })
    expect(registry.tasks.value.find((task) => task.key === TEST_TASK_KEY)?.progress).toBe(0.4)

    registry.removeTask(TEST_TASK_KEY)
    expect(registry.tasks.value.some((task) => task.key === TEST_TASK_KEY)).toBe(false)
  })

  it('routes cancellation through the registered task handler', () => {
    const cancel = vi.fn()
    registry.setTask({
      key: TEST_TASK_KEY,
      title: 'Exporting cards',
      progress: 0.2,
      cancellable: true,
      detail: 'Rendering cards/main.ocdocument',
    }, cancel)
    registry.cancelTask(TEST_TASK_KEY)
    expect(cancel).toHaveBeenCalledOnce()
  })
})
