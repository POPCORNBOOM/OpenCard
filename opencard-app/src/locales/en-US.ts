export default {
  app: {
    menu: {
      file: 'File',
      edit: 'Edit',
      view: 'View',
      help: 'Help',
      export2x: 'Test Export 2x',
    },
    welcome: {
      title: 'OpenCard',
      subtitle: 'Open a project folder to start editing',
    },
  },
  sidebar: {
    files: 'Explorer',
    git: 'Source Control',
    publish: 'Publish',
    openedEditors: 'Open Editors',
    timeline: 'Timeline',
    openProject: 'Open Project Folder',
  },
  panels: {
    gitPlaceholder: 'Git features are under development...',
    publishPlaceholder: 'Publish features are under development...',
    cardPreview: 'Card Preview',
  },
  status: {
    watching: 'Watching',
  },
  fileTypes: {
    plaintext: 'Plain Text',
    opencard: 'OpenCard Document',
    json: 'JSON',
    markdown: 'Markdown',
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    vue: 'Vue',
    html: 'HTML',
    css: 'CSS',
    image: 'Image',
    env: 'Environment',
    git: 'Git Config',
  },
} as const
