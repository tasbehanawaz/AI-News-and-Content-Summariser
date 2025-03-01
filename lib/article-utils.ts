import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import metascraper from 'metascraper';
import metascraperAuthor from 'metascraper-author';
import metascraperDate from 'metascraper-date';
import metascraperPublisher from 'metascraper-publisher';
import metascraperTitle from 'metascraper-title';
import metascraperDescription from 'metascraper-description';
import type { Chat } from 'openai/resources';
import dotenv from 'dotenv';
dotenv.config();

const scraper = metascraper([
  metascraperAuthor(),
  metascraperDate(),
  metascraperPublisher(),
  metascraperTitle(),
  metascraperDescription()
]);

const TRUSTED_DOMAINS = [
  'reuters.com', 'apnews.com', 'bloomberg.com', 'nytimes.com', 'wsj.com',
  'washingtonpost.com', 'bbc.com', 'bbc.co.uk', 'theguardian.com',
  'economist.com', 'ft.com', 'forbes.com', 'cnbc.com', 'cnn.com'
];

// Add known paywalled or restricted sites
const PAYWALLED_DOMAINS = [
  'wsj.com', 'nytimes.com', 'economist.com', 'ft.com',
  'bloomberg.com', 'washingtonpost.com'
];

export type Article = {
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  description?: string;
  // Add other fields as necessary
};

function getDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return hostname.startsWith('www.') ? hostname.slice(4) : hostname;
  } catch {
    return '';
  }
}

// fetch article content function
export async function fetchArticleContent(url: string): Promise<string> {
  try {
    const domain = getDomain(url);
    
    // Check if domain is paywalled
    if (PAYWALLED_DOMAINS.some(d => domain.endsWith(d))) {
      throw new Error(`This article is from ${domain} which requires a subscription. Please try an article from a non-paywalled source like Reuters or AP News.`);
    }

    // Try multiple fetch strategies
    const fetchStrategies = [
      // Strategy 1: Standard browser-like request with enhanced headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Sec-Ch-Ua': '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'https://www.google.com/',
          'Connection': 'keep-alive',
          'DNT': '1'
        }
      },
      // Strategy 2: Mobile user agent with enhanced headers
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Referer': 'https://www.google.com/',
          'DNT': '1'
        }
      }
    ];

    let lastError: Error | null = null;
    
    // Try each strategy with delay between retries
    for (const [index, strategy] of fetchStrategies.entries()) {
      try {
        // Add delay between retries
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        const response = await axios.get(url, {
          ...strategy,
          timeout: 15000,
          maxRedirects: 5,
          validateStatus: function (status) {
            return status < 400; // Accept any status code less than 400
          }
        });

        if (!response.data) continue;

        const html = response.data;
        
        // Try Readability first
        try {
          const dom = new JSDOM(html, { url });  // Pass URL for better parsing
          const reader = new Readability(dom.window.document, {
            charThreshold: 20 // Lower character threshold
          });
          const article = reader.parse();
          if (article?.textContent && article.textContent.length > 50) {
            return article.textContent;
          }
        } catch {
          console.warn('Readability parsing failed, trying Cheerio');
        }

        // Try Cheerio with expanded selectors
        const $ = cheerio.load(html);
        const selectors = [
          'article', 
          '.article-content',
          '.article-body',
          '[itemprop="articleBody"]',
          '.story-content',
          '.post-content',
          'main',
          '.content',
          '#content',
          '.entry-content',
          '.post__content',
          '.story__content',
          '.article__body',
          '.article-text'
        ];

        for (const selector of selectors) {
          const element = $(selector);
          if (element.length) {
            const content = element.text().trim();
            if (content.length > 50) {
              return content;
            }
          }
        }

        // Last resort: Try to get main text content while excluding navigation, headers, etc.
        const mainContent = $('body')
          .clone()
          .children('header, nav, footer, script, style, iframe, .nav, .header, .footer')
          .remove()
          .end()
          .text()
          .trim();
          
        if (mainContent.length > 50) {
          return mainContent;
        }
      } catch (err) {
        lastError = err as Error;
        continue;
      }
    }

    // If we get here, all strategies failed
    if (lastError) {
      if (axios.isAxiosError(lastError)) {
        if (lastError.response?.status === 403) {
          throw new Error(`Unable to access this article. Please try:\n1. An article from Reuters or AP News\n2. A different news source\n3. Make sure the article is publicly accessible`);
        } else if (lastError.response?.status === 404) {
          throw new Error('This article no longer exists or has been moved.');
        } else if (lastError.response?.status === 429) {
          throw new Error('Too many requests to the news site. Please try again in a few minutes.');
        }
      }
      throw lastError;
    }
    
    throw new Error('Could not extract meaningful content from the article. Please try a different article.');
    
  } catch (error) {
    console.error('Error fetching article:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to fetch or parse article content');
  }
}


export async function extractMetadata(url: string) {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json',
        'Authorization': `Bearer ${process.env.NEWS_API_KEY}`
      },
      timeout: 10000
    });

    const html = response.data;
    const metadata = await scraper({ html, url });
    const domain = new URL(url).hostname.replace('www.', '');
    const isVerified = TRUSTED_DOMAINS.some(trusted => domain.endsWith(trusted));

    const $ = cheerio.load(html);
    const fallbackAuthor = $('meta[name="author"]').attr('content') ||
                          $('meta[property="article:author"]').attr('content') ||
                          $('[rel="author"]').first().text() ||
                          'Unknown';

    return {
      author: metadata.author || fallbackAuthor,
      publishDate: metadata.date ? new Date(metadata.date) : new Date(),
      domain,
      isVerified,
      title: metadata.title || $('title').text().trim(),
      description: metadata.description || $('meta[name="description"]').attr('content') || ''
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      author: 'Unknown',
      publishDate: new Date(),
      domain: new URL(url).hostname,
      isVerified: false,
      title: 'Unknown',
      description: ''
    };
  }
}


export function calculateConfidenceScore(completion: Chat.ChatCompletion): number {
  try {
    const message = completion.choices[0]?.message;
    if (!message?.content) return 0;

    let score = 70;
    const wordCount = message.content.split(/\s+/).length;
    if (wordCount > 100) score += 5;
    if (wordCount > 200) score += 5;

    if (completion.choices[0]?.finish_reason === 'stop') score += 5;

    const hasNumbers = /\d+/.test(message.content);
    const hasQuotes = /"[^"]*"/.test(message.content);
    const hasParagraphs = message.content.split('\n\n').length > 1;

    if (hasNumbers) score += 5;
    if (hasQuotes) score += 5;
    if (hasParagraphs) score += 5;

    return Math.min(100, score);
  } catch (error) {
    console.error('Error calculating confidence score:', error);
    return 70;
  }
}

export async function fetchArticlesFromNewsAPI(): Promise<Article[]> {
  try {
    const response = await axios.get(`https://newsapi.org/v2/top-headlines?apiKey=${process.env.NEWS_API_KEY}`);
    return response.data.articles; // Ensure this matches the expected structure
  } catch (error) {
    console.error('Error fetching articles:', error);
    throw new Error('Failed to fetch articles from News API');
  }
}
