import { CardDocument, Component } from '../core/cardDocument'

export function cardToHtml(doc: CardDocument): string {
    const componentsHTML = doc.components.map(comp => componentToHTML(comp)).join('')
    return `<div style="width: ${doc.canvas.width}px; height: ${doc.canvas.height}px;">${componentsHTML}</div>`
}

export function componentToHTML(comp: Component): string {
    switch (comp.type) {
        case 'text':
            return `<div>${comp.content}</div>`
        case 'image':
            return `<img src="${comp.assetId}" />`
        default:
            return ''
    }
}