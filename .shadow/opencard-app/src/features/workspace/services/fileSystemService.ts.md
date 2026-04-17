`features/workspace/services/fileSystemService.ts` 是工作区文件 IO 适配层：
- 封装 Tauri 文件 API 与目录监听命令。
- 暴露稳定文件服务接口给 workspace store，不承载业务规则。

约束：
- 路径合法性、冲突处理、重命名策略属于 store/domain 层，不在本层做策略判断。
- 本层可替换实现（例如未来 mock/remote），所以调用方应依赖接口语义而非具体 API 细节。
