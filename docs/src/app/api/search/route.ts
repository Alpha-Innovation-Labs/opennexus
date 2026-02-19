import { source } from '@/lib/source';
import { createFromSource } from 'fumadocs-core/search/server';

export const dynamic = 'force-static';
export const revalidate = false;

const searchRoute = createFromSource(source, {
  // https://docs.orama.com/docs/orama-js/supported-languages
  language: 'english',
});

export async function GET(request: Request) {
  if (process.env.DOCS_GH_PAGES === '1') {
    return Response.json({
      message: 'Search API is disabled for static GitHub Pages export.',
      results: [],
    });
  }

  return searchRoute.GET(request);
}
