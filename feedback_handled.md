1. 项目资源注册表统一使用 `.opencard/fonts/fonts.json`、`.opencard/icons/icons.json`、`.opencard/blocks/blocks.json` 和 `.opencard/packages/packages.json`；资源环境按项目与已安装包分离。
2. 自定义块实例字段已统一为 `customBlockKey`，render-ready 模型、parser、展开器、富文本代理和核心测试不再使用 `packageId` 作为卡牌实例字段。
3. `.ocblock` 继续只保存结构定义、公开字段和声明式资源依赖；`.ocpack` 承担资源、包版本、依赖和运输内容。
4. 自定义块发现已改为注册表驱动：只有 `blocks.json` 登记且源文件存在的 `.ocblock` 才进入定义 catalog；未登记文件不会进入运行时。
5. 设计文档已补充 CardDocument 中自定义块实例与 `CardDocument.instances[]` 数据表实例的边界，并统一项目与包内 registry 目录示例。
6. 已验证 `vue-tsc` 通过；自定义块展开、render pipeline 和实例创建定向测试通过。Vitest 在并行启动多个 forks 时仍存在 worker timeout，单文件测试需顺序执行。
