type ScheduledTask = {
  delay: number
  run: () => Promise<void> | void
  timer: ReturnType<typeof setTimeout>
}

class TaskScheduler {
  private tasks = new Map<string, ScheduledTask>()

  schedule(key: string, delay: number, run: () => Promise<void> | void) {
    this.cancel(key)

    const timer = setTimeout(async () => {
      this.tasks.delete(key)
      await run()
    }, delay)

    this.tasks.set(key, { delay, run, timer })
  }

  cancel(key: string) {
    const task = this.tasks.get(key)
    if (!task) return

    clearTimeout(task.timer)
    this.tasks.delete(key)
  }

  async flush(key: string) {
    const task = this.tasks.get(key)
    if (!task) return

    clearTimeout(task.timer)
    this.tasks.delete(key)
    await task.run()
  }

  cancelAll() {
    for (const task of this.tasks.values()) {
      clearTimeout(task.timer)
    }

    this.tasks.clear()
  }
}

export const taskScheduler = new TaskScheduler()
