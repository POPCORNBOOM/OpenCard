import { AnchorPosition, BaseBlock, CSSValue } from '../core/Card'

type BlockStyleOptions = {
    disableTransform?: boolean
}

export function toCSSValue(value: CSSValue | undefined): string {
    if (value === undefined) return '0px'
    if (typeof value === 'number') {
        return `${value}px`
    }

    const trimmed = value.trim()
    if (trimmed === '') {
        return trimmed
    }

    if (/^calc\(.+\)$/i.test(trimmed)) {
        return trimmed
    }

    // Allow users to input expressions like "100% - 16px" directly.
    if (/\S\s+[+\-*/]\s+\S/.test(trimmed)) {
        return `calc(${trimmed})`
    }

    return trimmed
}

type AbsolutePosition = {
    anchor?: AnchorPosition
    x?: CSSValue
    y?: CSSValue
}

function resolvePositionValue(value: CSSValue | undefined): string {
    if (value === undefined || value === null) {
        return '0px'
    }

    if (typeof value === 'string') {
        const trimmed = value.trim()
        if (trimmed === '') {
            return '0px'
        }

        if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
            return `${trimmed}px`
        }
    }

    return toCSSValue(value)
}

export function getAbsolutePositionStyles(position: AbsolutePosition): string {
    const styles: string[] = []

    const x = resolvePositionValue(position.x)
    const y = resolvePositionValue(position.y)
    let translateX = '0px', translateY = '0px'

    if (position.anchor) {
        switch (position.anchor) {
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
    styles.push(`transform: translate(${translateX}, ${translateY})`)
    return styles.join('; ')
}

export function getBlockBoxStyles(comp: BaseBlock, options: BlockStyleOptions = {}): string {
    const styles: string[] = []

    if (comp.width) styles.push(`width: ${toCSSValue(comp.width)}`)
    if (comp.height) styles.push(`height: ${toCSSValue(comp.height)}`)
    if (comp.outline) styles.push(`outline: ${comp.outline}`)
    if (comp.borderRadius !== undefined) styles.push(`border-radius: ${toCSSValue(comp.borderRadius)}`)
    if (comp.background) styles.push(`background: ${comp.background}`)
    if (comp.opacity !== undefined) styles.push(`opacity: ${comp.opacity}`)
    if (comp.zIndex !== undefined) styles.push(`z-index: ${comp.zIndex}`)

    if (!options.disableTransform && comp.transformAnchor) {
        const originMap: Record<string, string> = {
            'lt': '0% 0%', 'ct': '50% 0%', 'rt': '100% 0%',
            'lc': '0% 50%', 'cc': '50% 50%', 'rc': '100% 50%',
            'lb': '0% 100%', 'cb': '50% 100%', 'rb': '100% 100%'
        }
        styles.push(`transform-origin: ${originMap[comp.transformAnchor]}`)
    }

    const transforms: string[] = []
    if (!options.disableTransform && (comp.translateX || comp.translateY)) {
        transforms.push(`translate(${toCSSValue(comp.translateX)}, ${toCSSValue(comp.translateY)})`)
    }
    if (!options.disableTransform && (comp.scaleX !== undefined || comp.scaleY !== undefined)) {
        const scaleX = comp.scaleX !== undefined ? comp.scaleX : 1
        const scaleY = comp.scaleY !== undefined ? comp.scaleY : 1
        transforms.push(`scale(${scaleX}, ${scaleY})`)
    }
    if (!options.disableTransform && comp.rotation) {
        transforms.push(`rotate(${comp.rotation}deg)`)
    }
    if (transforms.length > 0) {
        styles.push(`transform: ${transforms.join(' ')}`)
    }

    return styles.join('; ') + (!options.disableTransform && comp.customCss ? '; ' + comp.customCss : '')
}

export function getPositionStyles(comp: BaseBlock, options: BlockStyleOptions = {}): string {
    const baseStyles = getBlockBoxStyles(comp, options)
    return ['position: absolute', baseStyles].filter(Boolean).join('; ')
}
