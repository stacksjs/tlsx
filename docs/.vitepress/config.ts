import type { HeadConfig } from 'vitepress'
import { transformerTwoslash } from '@shikijs/vitepress-twoslash'
import { withPwa } from '@vite-pwa/vitepress'
import { defineConfig } from 'vitepress'
import vite from './vite.config'

// https://vitepress.dev/reference/site-config

const analyticsHead: HeadConfig[] = [
  [
    'script',
    {
      'src': 'https://cdn.usefathom.com/script.js',
      'data-site': 'PPHNWPQF',
      'defer': '',
    },
  ],
]

const nav = [
  { text: 'News', link: 'https://stacksjs.org/news' },
  {
    text: 'Changelog',
    link: 'https://github.com/stacksjs/tlsx/blob/main/CHANGELOG.md',
  },
  {
    text: 'Resources',
    items: [
      { text: 'Team', link: '/team' },
      { text: 'Sponsors', link: '/sponsors' },
      { text: 'Partners', link: '/partners' },
      { text: 'Postcardware', link: '/postcardware' },
      { text: 'Stargazers', link: '/stargazers' },
      { text: 'Showcase', link: '/showcase' },
      { text: 'License', link: '/license' },
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
      { text: 'Intro', link: '/intro' },
      { text: 'Install', link: '/install' },
      { text: 'Usage', link: '/usage' },
      { text: 'Config', link: '/config' },
    ],
  },
  {
    text: 'Features',
    items: [
      { text: 'SSL Support', link: '/features/ssl-support' },
      { text: 'Wildcard Domains', link: '/features/wildcard-domains' },
      { text: 'Multi-domain', link: '/features/multi-domain' },
      { text: 'System Trust Store', link: '/features/system-trust-store' },
      { text: 'Zero-Config', link: '/features/zero-config' },
    ],
  },
  {
    text: 'Advanced',
    items: [
      { text: 'Custom Certificates', link: '/advanced/custom-certificates' },
      { text: 'Certificate Authority', link: '/advanced/certificate-authority' },
      { text: 'Key Usage & Extensions', link: '/advanced/key-usage-extensions' },
    ],
  },
  { text: 'API Reference', link: '/api-reference' },
]

const description = 'A simple, fast, and secure TLS certificate manager for your projects.'
const title = `tlsx | ${description}`

export default withPwa(
  defineConfig({
    lang: 'en-US',
    title: 'tlsx',
    description,
    metaChunk: true,
    lastUpdated: true,
    cleanUrls: true,

    head: [
      ['link', { rel: 'icon', type: 'image/svg+xml', href: './images/logo-mini.svg' }],
      ['link', { rel: 'icon', type: 'image/png', href: './images/logo.png' }],
      ['meta', { name: 'theme-color', content: '#0A0ABC' }],
      ['meta', { name: 'title', content: title }],
      ['meta', { name: 'description', content: description }],
      ['meta', { name: 'author', content: 'Stacks.js, Inc.' }],
      ['meta', {
        name: 'tags',
        content: 'tlsx, stacksjs, certificate, ssl, SSL support, domain, multi-domain, zero-config',
      }],

      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:locale', content: 'en' }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { property: 'og:site_name', content: 'tlsx' }],
      ['meta', { property: 'og:image', content: './images/og-image.png' }],
      ['meta', { property: 'og:url', content: 'https://tlsx.netlify.app/' }],
      ...analyticsHead,
    ],

    themeConfig: {
      search: {
        provider: 'local',
      },
      logo: {
        light: './images/logo-transparent.svg',
        dark: './images/logo-white-transparent.svg',
      },

      nav,
      sidebar,

      editLink: {
        pattern: 'https://github.com/stacksjs/stacks/edit/main/docs/docs/:path',
        text: 'Edit this page on GitHub',
      },

      footer: {
        message: 'Released under the MIT License.',
        copyright: 'Copyright © 2025-present Stacks.js, Inc.',
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
        light: 'github-light',
        dark: 'github-dark',
      },

      codeTransformers: [
        transformerTwoslash(),
      ],
    },

    vite,
  }),
)
