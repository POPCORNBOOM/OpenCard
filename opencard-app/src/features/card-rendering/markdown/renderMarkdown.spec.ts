import { describe, expect, it } from 'vitest'
import type { ProjectIconCatalog } from '../../workspace/services/projectIconCatalog'
import { renderMarkdown } from './renderMarkdown'

const catalog: ProjectIconCatalog = {
  series: [{ name: 'Status icons', key: 'status', source: 'status.png', src: 'asset://status', imageWidth: 16, imageHeight: 8 }],
  entries: [{ seriesKey: 'status', iconKey: 'wide', name: 'Wide', source: 'status.png', src: 'asset://status', x: 0, y: 0, width: 8, height: 4, imageWidth: 16, imageHeight: 8 }],
  errors: [],
}

describe('renderMarkdown project icons', () => {
  it('renders a valid project icon at its original crop ratio', () => {
    const html = renderMarkdown('A [[icon:status/wide]] B', { projectIconCatalog: catalog })
    expect(html).toContain('class="project-inline-icon"')
    expect(html).toContain('width:2em')
  })

  it('keeps missing references and ignores inline code and escaped syntax', () => {
    expect(renderMarkdown('[[icon:status/missing]]', { projectIconCatalog: catalog })).toContain('[[icon:status/missing]]')
    expect(renderMarkdown('`[[icon:status/wide]]`', { projectIconCatalog: catalog })).not.toContain('project-inline-icon')
    expect(renderMarkdown('\\[[icon:status/wide]]', { projectIconCatalog: catalog })).not.toContain('project-inline-icon')
  })
})
