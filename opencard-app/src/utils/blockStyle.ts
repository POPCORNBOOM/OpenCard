import type {
    RenderReadyBaseBlock,
    RenderReadySimpleContainerLocation,
} from '../features/card-rendering/render.types'

type BlockStyleOptions = {
    disableTransform: boolean
}

function isZeroCSSValue(value: string): boolean {
    const normalized = value.trim().toLowerCase()
    return normalized === '' || normalized === '0' || normalized === '0px' || normalized === '0%'
}

export function getAbsolutePositionStyles(position: RenderReadySimpleContainerLocation): string {
    const styles: string[] = []

    const x = position.x
    const y = position.y
    let translateX = '0px', translateY = '0px'

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
    styles.push(`transform: translate(${translateX}, ${translateY})`)
    return styles.join('; ')
}

export function getBlockBoxStyles(comp: RenderReadyBaseBlock, options: BlockStyleOptions): string {
    const styles: string[] = []

    styles.push(`width: ${comp.width}`)
    styles.push(`height: ${comp.height}`)
    if (comp.borderWidth > 0) {
        styles.push(`outline: ${comp.borderWidth}px ${comp.borderStyle} ${comp.borderColor}`)
    }
    if (comp.borderRadius) styles.push(`border-radius: ${comp.borderRadius}`)
    if (comp.background) styles.push(`background: ${comp.background}`)
    if (comp.opacity !== 1) styles.push(`opacity: ${comp.opacity}`)
    if (comp.zIndex !== 0) styles.push(`z-index: ${comp.zIndex}`)

    if (!options.disableTransform && comp.transformAnchor !== 'cc') {
        const originMap: Record<string, string> = {
            'lt': '0% 0%', 'ct': '50% 0%', 'rt': '100% 0%',
            'lc': '0% 50%', 'cc': '50% 50%', 'rc': '100% 50%',
            'lb': '0% 100%', 'cb': '50% 100%', 'rb': '100% 100%'
        }
        styles.push(`transform-origin: ${originMap[comp.transformAnchor]}`)
    }

    const transforms: string[] = []
    if (!options.disableTransform && (!isZeroCSSValue(comp.translateX) || !isZeroCSSValue(comp.translateY))) {
        transforms.push(`translate(${comp.translateX}, ${comp.translateY})`)
    }
    if (!options.disableTransform && (comp.scaleX !== 1 || comp.scaleY !== 1)) {
        transforms.push(`scale(${comp.scaleX}, ${comp.scaleY})`)
    }
    if (!options.disableTransform && comp.rotation !== 0) {
        transforms.push(`rotate(${comp.rotation}deg)`)
    }
    if (transforms.length > 0) {
        styles.push(`transform: ${transforms.join(' ')}`)
    }

    const customCss = comp.customCss.trim()
    return styles.join('; ') + (!options.disableTransform && customCss ? '; ' + customCss : '')
}

export function getPositionStyles(comp: RenderReadyBaseBlock, options: BlockStyleOptions): string {
    const baseStyles = getBlockBoxStyles(comp, options)
    return ['position: absolute', baseStyles].filter(Boolean).join('; ')
}
