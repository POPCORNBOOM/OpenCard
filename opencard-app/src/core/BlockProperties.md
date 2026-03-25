# Block 属性参考

## 通用属性（所有 Block 都有）

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `id` | `string` | ✅ | 唯一标识符 |
| `anchor` | `AnchorPosition` | ✅ | 定位锚点，见下方说明 |
| `x` | `CSSValue` | — | 水平偏移，相对于锚点 |
| `y` | `CSSValue` | — | 垂直偏移，相对于锚点 |
| `width` | `CSSValue` | — | 宽度，如 `100`、`"50%"` |
| `height` | `CSSValue` | — | 高度 |
| `translateX` | `CSSValue` | — | X 轴平移（transform） |
| `translateY` | `CSSValue` | — | Y 轴平移（transform） |
| `scaleX` | `number` | — | X 轴缩放，默认 1 |
| `scaleY` | `number` | — | Y 轴缩放，默认 1 |
| `transformAnchor` | `AnchorPosition` | — | transform 原点，对应 CSS `transform-origin` |
| `rotation` | `number` | — | 旋转角度（度），顺时针为正 |
| `zIndex` | `number` | — | 层叠顺序 |
| `opacity` | `number` | — | 透明度，0–1 |
| `customCss` | `string` | — | 自定义 CSS 字符串，会覆盖以上布局属性 |
| `metadata` | `Record<string, unknown>` | — | 任意扩展数据，不影响渲染 |

### AnchorPosition 锚点

9 宫格定位，字母含义：l=left, c=center, r=right, t=top, b=bottom

```
lt  ct  rt
lc  cc  rc
lb  cb  rb
```

### CSSValue 类型

`number | string`，number 默认单位为 px，string 可以是任意 CSS 值如 `"50%"`、`"2em"`、`"calc(100% - 20px)"`

---

## TextBlock

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `"text"` | ✅ | 固定值 |
| `content` | `string` | ✅ | 文本内容 |
| `mode` | `'plain' \| 'markdown' \| 'richtext'` | ✅ | 渲染模式 |
| `fontSize` | `CSSValue` | — | 字体大小，如 `14`、`"1.2em"` |
| `fontFamily` | `string` | — | 字体，如 `"serif"`、`"Noto Sans SC"` |
| `fontWeight` | `'normal' \| 'bold' \| number` | — | 字重，如 `400`、`700`、`'bold'` |
| `color` | `string` | — | 文字颜色，CSS 颜色值 |
| `backgroundColor` | `string` | — | 背景色 |
| `textAlign` | `'left' \| 'center' \| 'right' \| 'justify'` | — | 文本对齐 |
| `lineHeight` | `CSSValue` | — | 行高，如 `1.5`、`"24px"` |

**待扩展候选：**
- `letterSpacing` — 字间距
- `textDecoration` — 下划线 / 删除线
- `textShadow` — 文字阴影
- `padding` — 内边距
- `borderRadius` — 圆角
- `border` — 边框
- `overflow` — 文本溢出处理（clip / ellipsis）
- `maxLines` — 最大行数（配合 overflow: ellipsis）
- `whiteSpace` — 空白处理（nowrap / pre-wrap）
- `writingMode` — 横排 / 竖排（`horizontal-tb` / `vertical-rl`）

---

## ImageBlock

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `"image"` | ✅ | 固定值 |
| `assetId` | `string` | ✅ | 图片资源 ID 或路径 |
| `fit` | `'cover' \| 'contain' \| 'fill'` | ✅ | 对应 CSS `object-fit` |

**待扩展候选：**
- `position` — 对应 CSS `object-position`，控制图片焦点，如 `"center top"`
- `borderRadius` — 圆角，可做圆形头像
- `border` — 边框
- `opacity` — 已在 BaseBlock 有，图片也适用
- `grayscale` — 灰度滤镜（0–1）
- `brightness` — 亮度（CSS filter）
- `contrast` — 对比度
- `clip` — 裁剪区域（left/top/right/bottom，相对于图片）
- `fallbackAssetId` — 图片加载失败时的备用资源

---

## SimpleContainerBlock

自由定位容器，子 Block 用绝对坐标放置，行为类似卡牌根画布。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `"simple-container"` | ✅ | 固定值 |
| `blocks` | `CardBlock[]` | ✅ | 子 Block 列表 |

**待扩展候选：**
- `backgroundColor` — 容器背景色
- `backgroundImage` — 背景图
- `border` — 边框
- `borderRadius` — 圆角
- `padding` — 内边距（影响子 Block 的坐标原点）
- `overflow` — 超出裁剪（hidden / visible）
- `shadow` — 盒阴影

---

## FlowContainerBlock

流式布局容器，子 Block 按方向依次排列，类似 Flexbox。

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `type` | `"flow-container"` | ✅ | 固定值 |
| `direction` | `'lr' \| 'rl' \| 'tb' \| 'bt'` | ✅ | 排列方向：左→右 / 右→左 / 上→下 / 下→上 |
| `gap` | `CSSValue` | ✅ | 子 Block 间距 |
| `blocks` | `CardBlock[]` | ✅ | 子 Block 列表 |

**待扩展候选：**
- `align` — 交叉轴对齐，对应 `align-items`：`'start' \| 'center' \| 'end' \| 'stretch'`
- `justify` — 主轴对齐，对应 `justify-content`：`'start' \| 'center' \| 'end' \| 'space-between' \| 'space-around'`
- `wrap` — 是否换行（`boolean`），对应 `flex-wrap`
- `rowGap` / `columnGap` — 分别控制行列间距（wrap 时有用）
- `backgroundColor` — 背景色
- `border` — 边框
- `borderRadius` — 圆角
- `padding` — 内边距
- `overflow` — 超出裁剪
