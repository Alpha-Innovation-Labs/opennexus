import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();
const isGhPages = process.env.DOCS_GH_PAGES === '1';
const docsBasePath = process.env.DOCS_BASE_PATH || '';

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  ...(isGhPages
    ? {
        output: 'export',
        trailingSlash: true,
        skipTrailingSlashRedirect: true,
        images: {
          unoptimized: true,
        },
        ...(docsBasePath ? { basePath: docsBasePath } : {}),
      }
    : {}),
  async rewrites() {
    if (isGhPages) {
      return [];
    }

    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.mdx?slug=:path*',
      },
    ];
  },
};

export default withMDX(config);
