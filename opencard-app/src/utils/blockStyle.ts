import { AnchorPosition, BaseBlock, CSSValue } from '../entities/card/model'

type BlockStyleOptions = {
    disableTransform?: boolean
}

function hasCSSValue(value: CSSValue | undefined): boolean {
    if (typeof value === 'number') {
        return true
    }
    if (typeof value === 'string') {
        return value.trim().length > 0
    }
    return false
}

function isZeroCSSValue(value: CSSValue | undefined): boolean {
    if (value === undefined || value === null) {
        return true
    }

    if (typeof value === 'number') {
        return value === 0
    }

    const normalized = value.trim().toLowerCase()
    return normalized === '' || normalized === '0' || normalized === '0px' || normalized === '0%'
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

    if (hasCSSValue(comp.width)) styles.push(`width: ${toCSSValue(comp.width)}`)
    if (hasCSSValue(comp.height)) styles.push(`height: ${toCSSValue(comp.height)}`)
    if ((comp.borderWidth ?? 0) > 0) {
        styles.push(`outline: ${comp.borderWidth}px ${comp.borderStyle ?? 'solid'} ${comp.borderColor ?? '#000000'}`)
    }
    if (hasCSSValue(comp.borderRadius)) styles.push(`border-radius: ${toCSSValue(comp.borderRadius)}`)
    if (typeof comp.background === 'string' && comp.background.trim().length > 0) styles.push(`background: ${comp.background}`)
    if (comp.opacity !== undefined && comp.opacity !== 1) styles.push(`opacity: ${comp.opacity}`)
    if (comp.zIndex !== undefined && comp.zIndex !== 0) styles.push(`z-index: ${comp.zIndex}`)

    if (!options.disableTransform && comp.transformAnchor && comp.transformAnchor !== 'cc') {
        const originMap: Record<string, string> = {
            'lt': '0% 0%', 'ct': '50% 0%', 'rt': '100% 0%',
            'lc': '0% 50%', 'cc': '50% 50%', 'rc': '100% 50%',
            'lb': '0% 100%', 'cb': '50% 100%', 'rb': '100% 100%'
        }
        styles.push(`transform-origin: ${originMap[comp.transformAnchor]}`)
    }

    const transforms: string[] = []
    if (!options.disableTransform && (!isZeroCSSValue(comp.translateX) || !isZeroCSSValue(comp.translateY))) {
        transforms.push(`translate(${toCSSValue(comp.translateX)}, ${toCSSValue(comp.translateY)})`)
    }
    if (!options.disableTransform && ((comp.scaleX ?? 1) !== 1 || (comp.scaleY ?? 1) !== 1)) {
        const scaleX = comp.scaleX !== undefined ? comp.scaleX : 1
        const scaleY = comp.scaleY !== undefined ? comp.scaleY : 1
        transforms.push(`scale(${scaleX}, ${scaleY})`)
    }
    if (!options.disableTransform && comp.rotation !== undefined && comp.rotation !== 0) {
        transforms.push(`rotate(${comp.rotation}deg)`)
    }
    if (transforms.length > 0) {
        styles.push(`transform: ${transforms.join(' ')}`)
    }

    const customCss = typeof comp.customCss === 'string' ? comp.customCss.trim() : ''
    return styles.join('; ') + (!options.disableTransform && customCss ? '; ' + customCss : '')
}

export function getPositionStyles(comp: BaseBlock, options: BlockStyleOptions = {}): string {
    const baseStyles = getBlockBoxStyles(comp, options)
    return ['position: absolute', baseStyles].filter(Boolean).join('; ')
}
