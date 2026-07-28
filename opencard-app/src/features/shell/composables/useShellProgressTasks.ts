import { computed, reactive } from 'vue'
import type { ShellProgressTask } from '../shell.types'

const taskRegistry = reactive(new Map<string, ShellProgressTask>())

function normalizeTask(task: ShellProgressTask): ShellProgressTask {
  return {
    ...task,
    progress: Math.min(1, Math.max(0, task.progress)),
    weight: Number.isFinite(task.weight) && (task.weight ?? 0) > 0 ? task.weight : 1,
  }
}

export function useShellProgressTasks() {
  const tasks = computed<readonly ShellProgressTask[]>(() => Array.from(taskRegistry.values()))

  function setTask(task: ShellProgressTask): void {
    taskRegistry.set(task.key, normalizeTask(task))
  }

  function removeTask(key: string): void {
    taskRegistry.delete(key)
  }

  return {
    tasks,
    setTask,
    removeTask,
  }
}
