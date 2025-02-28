import { NextResponse } from 'next/server';
import { getTopNews, searchNews } from '@/lib/news-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const query = searchParams.get('query');
    const page = parseInt(searchParams.get('page') || '1');

    if (query) {
      const data = await searchNews(query, page);
      return NextResponse.json(data);
    } else {
      const data = await getTopNews(category || undefined, page);
      return NextResponse.json(data);
    }
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch news' },
      { status: 500 }
    );
  }
} 