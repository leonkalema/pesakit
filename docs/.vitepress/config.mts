import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'pesakit',
  description: 'Pesapal API 3.0 client for Node, Bun, Deno and edge runtimes',
  base: '/pesakit/',
  cleanUrls: true,
  themeConfig: {
    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/client' },
      { text: 'Frameworks', link: '/frameworks/express' },
      { text: 'npm', link: 'https://www.npmjs.com/package/pesakit' },
    ],
    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting started', link: '/guide/getting-started' },
          { text: 'Payments', link: '/guide/payments' },
          { text: 'IPN and verification', link: '/guide/ipn' },
          { text: 'Subscriptions', link: '/guide/subscriptions' },
          { text: 'Refunds and cancellation', link: '/guide/refunds' },
          { text: 'Checkout in the browser', link: '/guide/checkout' },
          { text: 'Testing', link: '/guide/testing' },
          { text: 'Errors', link: '/guide/errors' },
          { text: 'Go live', link: '/guide/production' },
        ],
      },
      {
        text: 'Frameworks',
        items: [
          { text: 'Express', link: '/frameworks/express' },
          { text: 'Next.js', link: '/frameworks/next' },
          { text: 'SvelteKit', link: '/frameworks/sveltekit' },
          { text: 'Hono and Workers', link: '/frameworks/hono' },
          { text: 'Fastify', link: '/frameworks/fastify' },
        ],
      },
      {
        text: 'API reference',
        items: [
          { text: 'Pesakit client', link: '/api/client' },
          { text: 'Types', link: '/api/types' },
        ],
      },
      {
        text: 'More',
        items: [
          { text: 'Why pesakit', link: '/why' },
          { text: 'Migrating', link: '/migrating' },
          { text: 'Payouts', link: '/payouts' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/leonkalema/pesakit' }],
    search: { provider: 'local' },
    footer: { message: 'MIT licensed', copyright: 'Leon Kalema' },
  },
});
