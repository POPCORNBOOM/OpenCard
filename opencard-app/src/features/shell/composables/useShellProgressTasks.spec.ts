import { afterEach, describe, expect, it } from 'vitest'
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
    })

    expect(registry.tasks.value.find((task) => task.key === TEST_TASK_KEY)).toEqual({
      key: TEST_TASK_KEY,
      title: 'Exporting cards',
      progress: 1,
      weight: 1,
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
})
