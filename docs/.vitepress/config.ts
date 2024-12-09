import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'bunfig',
  description: 'A smart config leader for Bun projects.',
  cleanUrls: true,

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: 'Docs', link: '/intro' },
      { text: 'Changelog', link: 'https://github.com/stacksjs/bunfig/releases' },
    ],

    sidebar: [
      {
        text: 'Get Started',
        items: [
          { text: 'Introduction', link: '/intro' },
          { text: 'Install', link: '/install' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/stacksjs/bunfig' },
      { icon: 'bluesky', link: 'https://bsky.app/profile/chrisbreuer.dev' },
      { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
    ],
  },
})
