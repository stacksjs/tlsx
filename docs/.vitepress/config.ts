import fs from 'node:fs'
import { defineConfig } from 'vitepress'
import { config } from '../../src/config'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'TLSX Docs',
  description: 'A better developer environment.',
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Examples', link: '/markdown-examples' },
    ],

    sidebar: [
      {
        text: 'Examples',
        items: [
          { text: 'Markdown Examples', link: '/markdown-examples' },
          { text: 'Runtime API Examples', link: '/api-examples' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/stacksjs/stacks' },
      { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
    ],
  },
  vite: {
    server: {
      https: {
        cert: fs.readFileSync(config.certPath),
        key: fs.readFileSync(config.keyPath),
      },
    },
  },
})
