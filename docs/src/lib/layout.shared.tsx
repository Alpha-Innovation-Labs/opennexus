import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { Orbit } from 'lucide-react';

// fill this with your actual GitHub info, for example:
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="inline-flex items-center gap-2">
          <Orbit className="h-4 w-4" />
          <span>OpenNexus</span>
        </span>
      ),
    },
    links: [
      {
        type: 'button',
        text: 'Docs',
        url: '/docs',
        on: 'nav',
        secondary: true,
      },
    ],
  };
}
