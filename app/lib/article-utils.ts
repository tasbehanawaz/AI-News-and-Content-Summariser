import * as cheerio from 'cheerio';
import axios from 'axios';

export async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    // Remove unwanted elements
    $('nav, header, footer, script, style, .ad, .advertisement, .nav, .menu, .sidebar').remove();
    $('.social-share, .related-content, .newsletter-signup').remove();
    $('[class*="ad-"], [class*="Advertisement"], [id*="ad-"]').remove();
    $('meta, link, iframe').remove();

    // Get the headline
    const headline = $('h1').first().text().trim();

    // For CNN specifically
    if (url.includes('cnn.com')) {
      // Get the main article content
      const articleText = $('.article__content, .article-body, .article__body')
        .find('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(text => text.length > 0)
        .join('\n\n');

      // Limit content length to avoid API issues
      const fullContent = `${headline}\n\n${articleText}`;
      return fullContent.length > 5000 ? fullContent.substring(0, 5000) : fullContent;
    }

    // For other news sites, get main content
    const mainContent = $('article, [role="main"], .main-content, .article-content')
      .find('p')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(text => text.length > 0)
      .join('\n\n');

    // Fallback to any paragraph text if specific selectors fail
    let content = mainContent;
    if (!mainContent) {
      content = $('p')
        .map((_, el) => $(el).text().trim())
        .get()
        .filter(text => text.length > 0 && !text.includes('Advertisement'))
        .join('\n\n');
    }

    // Combine headline and content, then limit length
    const fullContent = headline ? `${headline}\n\n${content}` : content;
    return fullContent.length > 5000 ? fullContent.substring(0, 5000) : fullContent;
  } catch (error) {
    console.error('Error fetching article content:', error);
    throw new Error('Failed to fetch article content');
  }
}

export async function extractMetadata(url: string) {
  try {
    const response = await axios.get(url);
    const $ = cheerio.load(response.data);

    return {
      author: $('meta[name="author"]').attr('content') || 
              $('[class*="author"], [class*="byline"]').first().text().trim() || 
              null,
      publishDate: $('meta[property="article:published_time"]').attr('content') || 
                   $('time').attr('datetime') || 
                   null,
      domain: new URL(url).hostname,
      isVerified: true // You can implement your own verification logic
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return null;
  }
} 