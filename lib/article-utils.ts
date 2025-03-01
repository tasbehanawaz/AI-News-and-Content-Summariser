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

export type Article = {
  title: string;
  url: string;
  author?: string;
  publishedAt?: string;
  description?: string;
  // Add other fields as necessary
};

// fetch article content function
export async function fetchArticleContent(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'text/html',
      },
    });

    const html = response.data;
    const dom = new JSDOM(html);
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    // If Readability provides content, return it
    if (article?.textContent) {
      return article.textContent.trim();
    }

    // Fallback to cheerio if Readability fails
    const $ = cheerio.load(html);
    const articleContent = $('article').text() || $('body').text(); // Example selector

    return articleContent.trim();
  } catch (error) {
    console.error('Error fetching article:', error);
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
