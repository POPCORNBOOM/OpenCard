`useCdeDocumentState.ts` 是卡牌编辑器的“文档状态真相层”，负责对象态文档、文本同步、脏状态与撤销历史：
- 文档真相：`cardDoc`（对象）。
- 文本输出：`rawContent`（JSON 字符串）。
- 结构索引：`parentLookup`（由文档重建）。

撤销/重做约束（最简版）：
- 使用 `useManualRefHistory(cardDoc)` 维护历史。
- 只暴露 `undo/redo/canUndo/canRedo`，不在此层引入操作帧。
- `loadRawDoc` 成功后重置历史并建立基线快照。

变更入口约束：
- 唯一写回入口：`markDocumentChanged(mode)`。
- `mode='typing'`：300ms 防抖提交（合并连续输入）。
- `mode='action'`：先 flush typing，再立即提交。
- 不允许调用方绕过该入口自行管理历史节流。

同步与保存约束：
- `save/undo/redo` 前必须 `flushPendingChanges()`。
- 文本同步只走 `syncDocumentContent`，避免双轨字符串来源。
- `isModified` 由“当前文本 vs savedContent”计算，不由调用方手工写入。

生命周期约束：
- composable 卸载前需要 `dispose()` 清理 typing 定时器。
- 失败解析时清空文档与索引，并重置历史深度。
