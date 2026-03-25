import { BaseBlock, CSSValue } from '../core/Card'

export function toCSSValue(value: CSSValue | undefined): string {
    if (value === undefined) return '0px'
    return typeof value === 'number' ? `${value}px` : value
}

export function getPositionStyles(comp: BaseBlock): string {
    const styles: string[] = ['position: absolute']

    // 处理尺寸
    if (comp.width) styles.push(`width: ${toCSSValue(comp.width)}`)
    if (comp.height) styles.push(`height: ${toCSSValue(comp.height)}`)
    if (comp.opacity !== undefined) styles.push(`opacity: ${comp.opacity}`)
    if (comp.zIndex !== undefined) styles.push(`z-index: ${comp.zIndex}`)

    // 处理 anchor 定位
    const x = comp.x !== undefined ? toCSSValue(comp.x) : '0px'
    const y = comp.y !== undefined ? toCSSValue(comp.y) : '0px'
    let translateX = '0px', translateY = '0px'

    if (comp.anchor) {
        switch (comp.anchor) {
            case 'lt':
                styles.push(`left: ${x}`, `top: ${y}`)
                break
            case 'ct':
                styles.push(`left: calc(50% + ${x})`, `top: ${y}`)
                translateX = '-50%'
                break
            case 'rt':
                styles.push(`right: ${x}`, `top: ${y}`)
                break
            case 'lc':
                styles.push(`left: ${x}`, `top: calc(50% + ${y})`)
                translateY = '-50%'
                break
            case 'cc':
                styles.push(`left: calc(50% + ${x})`, `top: calc(50% + ${y})`)
                translateX = '-50%'
                translateY = '-50%'
                break
            case 'rc':
                styles.push(`right: ${x}`, `top: calc(50% + ${y})`)
                translateY = '-50%'
                break
            case 'lb':
                styles.push(`left: ${x}`, `bottom: ${y}`)
                break
            case 'cb':
                styles.push(`left: calc(50% + ${x})`, `bottom: ${y}`)
                translateX = '-50%'
                break
            case 'rb':
                styles.push(`right: ${x}`, `bottom: ${y}`)
                break
        }
    }
    // 处理 transform-origin
    if (comp.transformAnchor) {
        const originMap: Record<string, string> = {
            'lt': '0% 0%', 'ct': '50% 0%', 'rt': '100% 0%',
            'lc': '0% 50%', 'cc': '50% 50%', 'rc': '100% 50%',
            'lb': '0% 100%', 'cb': '50% 100%', 'rb': '100% 100%'
        }
        styles.push(`transform-origin: ${originMap[comp.transformAnchor]}`)
    }

    const transforms: string[] = []
    transforms.push(`translate(${translateX}, ${translateY})`)


    if (comp.translateX || comp.translateY) {
        transforms.push(`translate(${toCSSValue(comp.translateX)}, ${toCSSValue(comp.translateY)})`)
    }
    // 处理缩放
    if (comp.scaleX !== undefined || comp.scaleY !== undefined) {
        const scaleX = comp.scaleX !== undefined ? comp.scaleX : 1
        const scaleY = comp.scaleY !== undefined ? comp.scaleY : 1
        transforms.push(`scale(${scaleX}, ${scaleY})`)
    }
    // 处理旋转
    if (comp.rotation) {
        transforms.push(`rotate(${comp.rotation}deg)`)
    }
    // 合并所有 transform
    if (transforms.length > 0) {
        styles.push(`transform: ${transforms.join(' ')}`)
    }

    // customCss 覆盖
    return styles.join('; ') + (comp.customCss ? '; ' + comp.customCss : '')
}