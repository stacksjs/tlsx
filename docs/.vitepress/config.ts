import type { HeadConfig } from 'vitepress'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { withPwa } from '@vite-pwa/vitepress'
import { defineConfig } from 'vitepress'

import viteConfig from './vite.config'

// https://vitepress.dev/reference/site-config

const analytics = {
  driver: 'fathom',

  drivers: {
    googleAnalytics: {
      trackingId: 'UA-XXXXXXXXX-X',
    },

    fathom: {
      siteId: 'WOLZMJDL',
    },
  },
}

const fathomAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      'src': 'https://cdn.usefathom.com/script.js',
      'data-site': analytics.drivers?.fathom?.siteId || '',
      'defer': '',
    },
  ],
]

const googleAnalyticsHead: HeadConfig[] = [
  [
    'script',
    {
      async: '',
      src: `https://www.googletagmanager.com/gtag/js?id=${analytics.drivers?.googleAnalytics?.trackingId}`,
    },
  ],
  [
    'script',
    {},
    `window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'TAG_ID');`,
  ],
]

const nav = [
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/tlsx/blob/main/CHANGELOG.md',
  },
  // { text: 'Blog', link: 'https://updates.ow3.org' },
  {
    text: 'Resources',
    items: [
      { text: 'Team', link: '/team' },
      { text: 'Sponsors', link: '/sponsors' },
      { text: 'Partners', link: '/partners' },
      { text: 'Postcardware', link: '/postcardware' },
      {
        items: [
          {
            text: 'Awesome Stacks',
            link: 'https://github.com/stacksjs/awesome-stacks',
          },
          {
            text: 'Contributing',
            link: 'https://github.com/stacksjs/stacks/blob/main/.github/CONTRIBUTING.md',
          },
        ],
      },
    ],
  },
]

const sidebar = [
  {
    text: 'Get Started',
    items: [
      { text: 'Introduction', link: '/intro' },
      { text: 'Installation', link: '/install' },
      { text: 'Usage', link: '/usage' },
      { text: 'Configuration', link: '/config' },
    ],
  },
]

const analyticsHead
  = analytics.driver === 'fathom'
    ? fathomAnalyticsHead
    : analytics.driver === 'google-analytics'
      ? googleAnalyticsHead
      : []

export default withPwa(
  defineConfig({
    lang: 'en-US',
    title: 'tlsx',
    description: 'A simple, fast, and secure TLS certificate manager for your projects.',
    metaChunk: true,

    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: './images/logo-mini.svg' }],
      ['link', { rel: 'icon', type: 'image/png', href: './images/logo.png' }],
      ['meta', { name: 'theme-color', content: '#0A0ABC' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:locale', content: 'en' }],
      ['meta', { property: 'og:title', content: 'tlsx | A better developer environment.' }],
      ['meta', { property: 'og:site_name', content: 'tlsx' }],
      ['meta', { property: 'og:image', content: './images/og-image.jpg' }],
      ['meta', { property: 'og:url', content: 'https://tlsx.sh/' }],
      // ['script', { 'src': 'https://cdn.usefathom.com/script.js', 'data-site': '', 'data-spa': 'auto', 'defer': '' }],
      ...analyticsHead,
    ],

    themeConfig: {
      logo: './images/logo-transparent.svg',

      nav,
      sidebar,

      editLink: {
        pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
        text: 'Edit this page on GitHub',
      },

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2024-present Stacks.js, Inc.',
      },

      socialLinks: [
        { icon: 'twitter', link: 'https://twitter.com/stacksjs' },
        { icon: 'bluesky', link: 'https://bsky.app/profile/chrisbreuer.dev' },
        { icon: 'github', link: 'https://github.com/stacksjs/tlsx' },
        { icon: 'discord', link: 'https://discord.gg/stacksjs' },
      ],

      // algolia: services.algolia,

      // carbonAds: {
      //   code: '',
      //   placement: '',
      // },
    },

    pwa: {
      manifest: {
        theme_color: '#0A0ABC',
      },
    },

    markdown: {
      theme: {
        light: 'vitesse-light',
        dark: 'vitesse-dark',
      },

      codeTransformers: [
        transformerTwoslash(),
      ],
    },

    vite: viteConfig,
  }),
)
