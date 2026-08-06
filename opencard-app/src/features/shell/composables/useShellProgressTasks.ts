import { computed, reactive } from 'vue'
import type { ShellProgressTask } from '../shell.types'

const taskRegistry = reactive(new Map<string, ShellProgressTask>())
const cancelHandlers = new Map<string, () => void>()

function normalizeTask(task: ShellProgressTask): ShellProgressTask {
  return {
    ...task,
    progress: Math.min(1, Math.max(0, task.progress)),
    weight: Number.isFinite(task.weight) && (task.weight ?? 0) > 0 ? task.weight : 1,
  }
}

export function useShellProgressTasks() {
  const tasks = computed<readonly ShellProgressTask[]>(() => Array.from(taskRegistry.values()))

  function setTask(task: ShellProgressTask, onCancel?: () => void): void {
    taskRegistry.set(task.key, normalizeTask(task))
    if (onCancel) cancelHandlers.set(task.key, onCancel)
    else if (!task.cancellable) cancelHandlers.delete(task.key)
  }

  function removeTask(key: string): void {
    taskRegistry.delete(key)
    cancelHandlers.delete(key)
  }

  function cancelTask(key: string): void {
    cancelHandlers.get(key)?.()
  }

  return {
    tasks,
    setTask,
    removeTask,
    cancelTask,
  }
}
