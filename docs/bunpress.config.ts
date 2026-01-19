import type { BunPressConfig } from 'bunpress'

export default {
  title: 'tlsx',
  description: 'A TLS/HTTPS library with automation',
  lang: 'en-US',

  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['meta', { name: 'theme-color', content: '#5c6bc0' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'tlsx - TLS/HTTPS Library' }],
    ['meta', { property: 'og:description', content: 'A TLS/HTTPS library with automation for certificate generation and management' }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'tlsx Documentation' }],
    ['meta', { name: 'twitter:description', content: 'A TLS/HTTPS library with automation' }],
    ['meta', { name: 'keywords', content: 'tls, https, ssl, security, certificates' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'tlsx',

    nav: [
      { text: 'Guide', link: '/intro' },
      { text: 'Features', link: '/features/certificate-generation' },
      { text: 'Advanced', link: '/advanced/configuration' },
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/stacksjs/tlsx' },
          { text: 'Changelog', link: 'https://github.com/stacksjs/tlsx/releases' },
          { text: 'Contributing', link: 'https://github.com/stacksjs/contributing' },
        ],
      },
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Introduction', link: '/intro' },
          { text: 'Installation', link: '/install' },
          { text: 'Usage', link: '/usage' },
          { text: 'Configuration', link: '/config' },
        ],
      },
      {
        text: 'Features',
        items: [
          { text: 'Certificate Generation', link: '/features/certificate-generation' },
          { text: 'Auto-Renewal', link: '/features/auto-renewal' },
          { text: 'Root CA', link: '/features/root-ca' },
          { text: 'Trust Store Management', link: '/features/trust-store-management' },
        ],
      },
      {
        text: 'Advanced',
        items: [
          { text: 'Configuration', link: '/advanced/configuration' },
          { text: 'Custom CAs', link: '/advanced/custom-cas' },
          { text: 'Performance', link: '/advanced/performance' },
          { text: 'CI/CD Integration', link: '/advanced/ci-cd-integration' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/stacksjs/tlsx' },
      { icon: 'discord', link: 'https://discord.gg/stacksjs' },
    ],

    editLink: {
      pattern: 'https://github.com/stacksjs/tlsx/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright 2024-present Stacks.js Contributors',
    },

    search: {
      provider: 'local',
    },
  },
} satisfies BunPressConfig
