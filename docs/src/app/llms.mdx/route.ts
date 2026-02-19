import { getLLMText, source } from '@/lib/source';

export const dynamic = 'force-static';
export const revalidate = false;

export async function GET(request: Request) {
  if (process.env.DOCS_GH_PAGES === '1') {
    return new Response('Not available in static export.', { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const slugParam = searchParams.get('slug') ?? '';
  const slug = slugParam.split('/').filter(Boolean);
  const page = source.getPage(slug);

  if (!page) {
    return new Response('Not found.', { status: 404 });
  }

  return new Response(await getLLMText(page), {
    headers: {
      'Content-Type': 'text/markdown',
    },
  });
}
