import { describe, expect, it } from 'vitest'
import { getBlockBoxStyles } from './blockStyle'

describe('getBlockBoxStyles', () => {
    it('renders structured block borders without changing the box model', () => {
        const styles = getBlockBoxStyles({
            id: 'block-1',
            width: 120,
            height: 80,
            borderColor: '#ff0000',
            borderWidth: 3,
            borderStyle: 'dashed',
        })

        expect(styles).toContain('width: 120px')
        expect(styles).toContain('height: 80px')
        expect(styles).toContain('outline: 3px dashed #ff0000')
        expect(styles).not.toMatch(/(^|;)\s*border:/)
    })

    it('does not render an outline when the border width is zero', () => {
        const styles = getBlockBoxStyles({
            id: 'block-1',
            borderColor: '#ff0000',
            borderWidth: 0,
            borderStyle: 'solid',
        })

        expect(styles).not.toContain('outline:')
    })
})