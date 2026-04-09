export default {
  app: {
    menu: {
      file: '文件',
      edit: '编辑',
      view: '查看',
      help: '帮助',
      export2x: '测试导出 2x',
    },
    welcome: {
      title: 'OpenCard',
      subtitle: '打开项目文件夹开始编辑',
    },
  },
  sidebar: {
    files: '文件浏览器',
    git: '版本管理',
    publish: '发布',
    openedEditors: '打开的编辑器',
    timeline: '时间线',
    openProject: '打开项目文件夹',
  },
  panels: {
    gitPlaceholder: 'Git 功能开发中...',
    publishPlaceholder: '发布功能开发中...',
    cardPreview: '卡牌预览',
  },
  status: {
    watching: '监听中',
  },
  fileTypes: {
    plaintext: '纯文本',
    opencard: 'OpenCard 文档',
    json: 'JSON',
    markdown: 'Markdown',
    typescript: 'TypeScript',
    javascript: 'JavaScript',
    vue: 'Vue',
    html: 'HTML',
    css: 'CSS',
    image: '图片',
    env: '环境变量',
    git: 'Git 配置',
  },
} as const
