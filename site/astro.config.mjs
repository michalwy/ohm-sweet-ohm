import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://michalwy.github.io',
  base: '/ohm-sweet-ohm',
  integrations: [
    starlight({
      title: 'OhmSweetOhm',
      description: 'Self-hosted web app for managing a home electronics workshop.',
      social: [
        {
          icon: 'github',
          label: 'GitHub',
          href: 'https://github.com/michalwy/ohm-sweet-ohm',
        },
      ],
      sidebar: [
        {
          label: 'User Guide',
          items: [
            { label: 'Overview',      slug: 'guides' },
            { label: 'Workspaces',    slug: 'guides/workspaces' },
            { label: 'Organizations', slug: 'guides/organizations' },
            { label: 'Parts',         slug: 'guides/parts' },
            { label: 'Inventory',     slug: 'guides/inventory' },
            { label: 'Designs',       slug: 'guides/designs' },
            { label: 'Builds',        slug: 'guides/builds' },
            { label: 'Purchasing',    slug: 'guides/purchasing' },
            { label: 'Integrations',  slug: 'guides/integrations' },
            { label: 'Settings',      slug: 'guides/settings' },
            { label: 'Deployment',    slug: 'guides/deployment' },
          ],
        },
      ],
    }),
  ],
});
