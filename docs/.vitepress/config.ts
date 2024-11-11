import fs from 'node:fs'
import os from 'node:os'
import { defineConfig } from 'vitepress'

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

    socialLinks: [{ icon: 'github', link: 'https://github.com/vuejs/vitepress' }],
  },
  vite: {
    server: {
      https: {
        cert: fs.readFileSync(`${os.homedir()}/.stacks/ssl/tlsx.localhost.crt`),
        key: fs.readFileSync(`${os.homedir()}/.stacks/ssl/tlsx.localhost.crt.key`),
      },
    },
  },
})
