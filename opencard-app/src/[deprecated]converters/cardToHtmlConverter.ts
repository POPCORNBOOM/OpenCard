import { CardDocument, CardBlock, TextBlock, ImageBlock, SimpleContainerBlock, FlowContainerBlock } from '../core/Card'
import { getAbsolutePositionStyles, getPositionStyles, toCSSValue } from '../utils/blockStyle'

export function cardToHtml(doc: CardDocument): string {
    const blocksHTML = doc.children
        .map(child => `<div style="position: absolute; ${getAbsolutePositionStyles(child.location)}">${blockToHtml(child.block, true)}</div>`)
        .join('')
    return `<div style="position: relative; width: ${doc.width}px; height: ${doc.height
        } px; background: #fff; color: #000; ">${blocksHTML}</div>`
}

export function blockToHtml(block: CardBlock, skipPosition = false): string {
    switch (block.type) {
        case 'text-block': return textBlockToHtml(block, skipPosition)
        case 'image-block': return imageBlockToHtml(block, skipPosition)
        case 'simple-container-block': return simpleContainerToHtml(block, skipPosition)
        case 'flow-container-block': return flowContainerToHtml(block, skipPosition)
    }
}

function textBlockToHtml(block: TextBlock, skipPosition: boolean): string {
    const styles: string[] = []
    if (!skipPosition) styles.push(getPositionStyles(block))
    if (block.fontSize) styles.push(`font-size: ${toCSSValue(block.fontSize)}`)
    if (block.fontFamily) styles.push(`font-family: ${block.fontFamily}`)
    if (block.fontWeight !== undefined) styles.push(`font-weight: ${block.fontWeight}`)
    if (block.color) styles.push(`color: ${block.color}`)
    if (block.backgroundColor) styles.push(`background-color: ${block.backgroundColor}`)
    if (block.textAlign) styles.push(`text-align: ${block.textAlign}`)
    if (block.lineHeight !== undefined) styles.push(`line-height: ${toCSSValue(block.lineHeight)}`)

    const style = styles.join('; ')
    const content = block.mode === 'richtext'
        ? block.content
        : escapeHtml(block.content)

    return `<div style="${style}">${content}</div>`
}

function imageBlockToHtml(block: ImageBlock, skipPosition: boolean): string {
    const styles: string[] = [`object-fit: ${block.fit}`]
    if (!skipPosition) styles.push(getPositionStyles(block))
    return `<img style="${styles.join('; ')}" src="${escapeAttr(block.assetId)}" />`
}

function simpleContainerToHtml(block: SimpleContainerBlock, skipPosition: boolean): string {
    const posStyle = skipPosition ? '' : getPositionStyles(block)
    const style = `${posStyle}; position: relative; overflow: hidden`
    const children = block.children.map(child =>
        `<div style="position: absolute; ${getAbsolutePositionStyles(child.location)}">${blockToHtml(child.block, true)}</div>`
    ).join('')
    return `<div style="${style}">${children}</div>`
}

function flowContainerToHtml(block: FlowContainerBlock, skipPosition: boolean): string {
    const directionMap: Record<string, string> = {
        lr: 'row',
        rl: 'row-reverse',
        tb: 'column',
        bt: 'column-reverse',
    }
    const posStyle = skipPosition ? '' : getPositionStyles(block)
    const style = `${posStyle}; display: flex; flex-direction: ${directionMap[block.direction]}; gap: ${toCSSValue(block.gap)}`
    const children = [...block.children]
        .sort((a, b) => a.location.index - b.location.index)
        .map(child => blockToHtml(child.block, true))
        .join('')
    return `<div style="${style}">${children}</div>`
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
}

function escapeAttr(str: string): string {
    return str.replace(/"/g, '&quot;')
}
