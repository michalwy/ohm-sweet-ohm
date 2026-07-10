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
          items: [{ autogenerate: { directory: 'guides' } }],
        },
      ],
    }),
  ],
});
