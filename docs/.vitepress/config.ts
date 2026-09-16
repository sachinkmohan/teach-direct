import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Learn From A Tutor — Dev Docs',
  description: 'Internal developer reference',
  // Agent-facing docs and ADRs are not part of the published site.
  srcExclude: ['agents/**', 'adr/**'],
  // Local-dev URLs are intentionally unreachable at build time.
  ignoreDeadLinks: [/^http:\/\/localhost/],
  themeConfig: {
    sidebar: [
      {
        text: 'Overview',
        items: [
          { text: 'Introduction', link: '/' },
          { text: 'Architecture', link: '/architecture' },
          { text: 'Local Development', link: '/local-dev' },
        ],
      },
      {
        text: 'Backend',
        items: [
          { text: 'Database Schema', link: '/database' },
          { text: 'Edge Functions', link: '/edge-functions' },
        ],
      },
      {
        text: 'Features',
        items: [
          { text: 'Auth Flow', link: '/auth' },
          { text: 'Payments & Stripe', link: '/payments' },
          { text: 'Lesson Lifecycle', link: '/lessons' },
        ],
      },
      {
        text: 'Dev Patterns',
        items: [
          { text: 'Common Patterns', link: '/patterns' },
        ],
      },
      {
        text: 'Testing',
        items: [
          { text: 'Stripe Payments (Local)', link: '/testing-stripe-payments' },
        ],
      },
      {
        text: 'Research',
        items: [
          { text: 'Calendar Rendering Library', link: '/research/calendar-rendering-library' },
        ],
      },
    ],
  },
})
