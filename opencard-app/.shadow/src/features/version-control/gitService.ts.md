# Git 前端边界

- Vue、store 与 composable 不直接调用 `invoke('git_*')`；所有 IPC 形状集中在 `gitService.ts`，避免 Rust DTO 在界面层扩散。
- 服务保留 Rust 的 `GitCommandResult<T>` 信封。认证、冲突、可重试、可继续与可中止状态必须读取结构化字段，禁止解析错误文案。
- Git 只描述磁盘项目。编辑器草稿是否先保存属于上层工作流，不能被服务层悄悄写盘。
- HTTPS Token 只允许作为单次请求参数透传，不记录日志、不进入 store，也不在服务层持久化。
