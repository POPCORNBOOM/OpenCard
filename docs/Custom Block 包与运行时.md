# Custom Block 包与运行时

本文记录 `.ocblock` schema v1 的实际结构、Custom Block 渲染方式，以及编辑器加载和释放包资源的生命周期。格式真相仍以 `projectCustomBlocks.ts`、`projectCustomBlock.ts` 及其测试为准。

## 与普通 Block 的区别

普通 Block 在卡牌文档中保存完整属性和容器子树，可直接进入实例覆盖、绑定解析、默认值填充、布局和 Vue 渲染。

Custom Block 在卡牌文档中只保存一个引用实例：

```json
{
  "id": "badge-instance",
  "type": "custom-block",
  "source": "block:example-badge",
  "interfaceHash": "91b95f636d4d83ffe95aacddb54a1993ea3300746c9a3891594973cc40663174"
}
```

渲染前，运行时按 `source` 从当前 catalog 找到包，校验 `interfaceHash`，应用公开字段覆盖，给包内 Block ID 和 location ID 加实例命名空间，再展开为普通原生 Block 子树。展开后的文本、Markdown、图片、形状和容器继续使用普通 Block 的渲染管线，不存在第二套内容渲染器。

缺包或接口不匹配时保留宿主实例并显示通用占位；包内绑定或解析错误聚合为宿主级问题，不向界面传递包内 Block ID、字段、引用、路径、source、hash 或原始异常。

## ZIP 目录

`.ocblock` 是 ZIP 文件，允许的条目只有清单及清单索引的资源：

```text
example-badge.ocblock
├── block.json
├── resources/fonts/4f7c9a2b.woff2
├── resources/images/12ab345678ef.png
└── resources/icons/98cd543232aa.png
```

路径使用 `/`，不允许绝对路径、盘符、空路径段、`.` 或 `..`。路径身份大小写不敏感，因此 `A.png` 与 `a.png` 冲突。导出器写盘前会把生成的 ZIP 重新交给正式导入器校验。

## 完整 `block.json` 实例

下面的实例包含 schema v1 的全部顶层字段和三类资源索引。可选的 Block 字段仍由对应原生 Block 类型决定。

```json
{
  "type": "opencard-custom-block",
  "schemaVersion": "1",
  "key": "example-badge",
  "name": "Example Badge",
  "description": "Packaged badge example",
  "interfaceHash": "91b95f636d4d83ffe95aacddb54a1993ea3300746c9a3891594973cc40663174",
  "root": {
    "id": "badge-root",
    "name": "Badge Root",
    "type": "simple-container-block",
    "width": "320px",
    "height": "120px",
    "children": [
      {
        "location": {
          "id": "badge-image-location",
          "type": "simple-container-location",
          "anchor": "lt",
          "x": "16px",
          "y": "16px"
        },
        "block": {
          "id": "badge-image",
          "name": "Badge Image",
          "type": "image-block",
          "image": "ocblock:example-badge/resources/images/12ab345678ef.png",
          "fit": "contain"
        }
      },
      {
        "location": {
          "id": "badge-text-location",
          "type": "simple-container-location",
          "anchor": "lt",
          "x": "104px",
          "y": "16px"
        },
        "block": {
          "id": "badge-text",
          "name": "Badge Text",
          "type": "text-block",
          "content": "<p>Badge <span data-oc-icon-path=\"ocblock-example-badge/star\"></span></p>",
          "fontFamily": "OpenCardCustomBlock-example-badge-heading",
          "fontSize": "24px"
        }
      }
    ]
  },
  "publicFields": [],
  "resize": {
    "widthLocked": false,
    "heightLocked": false
  },
  "resources": {
    "fonts": [
      {
        "key": "heading",
        "name": "Example Heading",
        "source": "resources/fonts/4f7c9a2b.woff2"
      }
    ],
    "images": [
      {
        "key": "12ab345678ef",
        "source": "resources/images/12ab345678ef.png"
      }
    ],
    "iconSeries": [
      {
        "name": "example-badge",
        "key": "ocblock-example-badge",
        "source": "resources/icons/98cd543232aa.png",
        "icons": [
          {
            "iconKey": "star",
            "name": "Star",
            "x": 0,
            "y": 0,
            "width": 32,
            "height": 32,
            "pixelated": false,
            "rotation": 0,
            "atlasRotation": 0
          }
        ]
      }
    ]
  }
}
```

`interfaceHash` 只包含按 Key 排序的公开字段 `{ key, fieldType }` 和 `resize`。`name`、`description`、字段标题、默认值、内部树和资源变化不会改变该接口哈希。

## 导出资源

- 图片：项目相对图片、允许的远程图片、Data URL 及嵌套包图片都读取为字节，以内容哈希命名并去重。
- 字体：每个 `font:<key>` 对应一个项目字体文件；嵌套包字体从原包字节重新打包。
- 图标：富文本图标节点和 `[[icon:series/icon]]` 使用同一解析器。只收集实际引用的裁切图标，合成为包内 PNG 图集，再改写为包级 series/icon Key。
- 远程图片：必须符合项目远程资源策略，响应 MIME 必须是图片，单文件最多 32 MiB，下载 15 秒后取消。

图集 Canvas 不直接接触 `asset://`、`file://` 或远程 URL。调用方先提供源图片字节，合成器为字节创建临时 Blob URL；成功、解码失败或 `toBlob` 失败都会在 `finally` 中释放 URL。

## 编辑器生命周期

1. 项目根目录 `.ocblocks` 提供项目相对 `.ocblock` 路径。
2. 编辑器读取 ZIP，执行压缩大小、解压大小、条目数和路径预检。
3. 导入器解析 `block.json`，校验原生 Block 树、唯一 ID、公开字段、资源索引、包内引用和接口哈希。
4. 当前 reload generation 为每个包内图片和图集创建受控 Blob URL，并构建图标 catalog。
5. 同一 generation 从包内字体字节创建 Blob URL 和 FontFace。单个字体失败只记录资源错误，不阻止其他资源。
6. 图片、图标和字体都准备完成且 generation 仍为最新时，store 原子提交新 catalog 和两个资源 session。
7. 提交后才释放上一 generation 的 Blob URL 和 FontFace。陈旧异步任务只能释放自己创建的 session，不能清理当前 session。
8. 卡牌渲染时，Custom Block 实例展开为命名空间化原生子树；`ocblock:` 图片引用从当前 session 解析为 Blob URL。
9. 注册表重载重复上述流程。新 generation 失败时保留当前可用 catalog，并记录加载错误。
10. 项目切换、项目关闭或成功接管新 generation 时调用 session 的幂等 `release()`。

## 资源所有权

| 对象 | 所有者 | 释放时机 |
| --- | --- | --- |
| ZIP 文件 Map | 当前 Custom Block catalog | catalog 被替换或项目关闭 |
| 图片与图集 Blob URL | asset session | session 被替换、陈旧或项目关闭 |
| 字体 Blob URL 与 FontFace | font session | session 被替换、陈旧或项目关闭 |
| 图集合成临时 Blob URL | 单次导出任务 | 每次合成成功或失败的 `finally` |
| 展开的原生 Block 子树 | 单次渲染派生结果 | 渲染计算失效或组件卸载 |

## 富文本图标渲染

项目图标的 token 解析、富文本节点读取和引用重写由共享模块统一提供。目录输出两种样式：Vue style 对象使用 camelCase，写 DOM/Markdown style 时使用标准 kebab-case。

所有图标消费者加入 `.oc-project-icon` 视觉契约；该共享 class 负责精灵图背景、裁切坐标、像素化和旋转。富文本编辑器、最近使用列表、图标菜单、自动完成、属性预览、主卡牌画布、迷你预览和 Markdown 不再分别维护裁切 CSS。
