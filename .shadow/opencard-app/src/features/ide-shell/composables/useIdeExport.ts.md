`useIdeExport.ts` 承担 IDE 导出编排能力：
- 只消费“当前活动 session 的草稿内容”作为导出输入，不回读磁盘。
- 管理隐藏导出渲染器状态（`showExportRenderer/exportCardDoc`）并提供导出动作。

关键约束：
- 实例导出必须复用领域投影 helper（`applyInstance`），不要在这里手搓覆写合并规则。
- 截图前必须等待导出树图片资源 `load/decode`，避免批量导出截到空白或上一帧。
- 文件命名与去重逻辑在此统一，调用方只触发动作。

边界约束：
- 本模块是壳层能力，不写入文件系统真相与会话真相。
- `MainIDE.vue` 只做 UI 绑定，不应重新复制导出流程细节。
