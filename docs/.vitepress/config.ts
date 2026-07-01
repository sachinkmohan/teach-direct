import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Learn From A Tutor — Dev Docs',
  description: 'Internal developer reference',
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
    ],
  },
})
