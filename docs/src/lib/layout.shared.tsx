import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

// fill this with your actual GitHub info, for example:
export const gitConfig = {
  user: 'alpha-innovation-labs',
  repo: 'nexus',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: 'Nexus CLI Docs',
    },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
