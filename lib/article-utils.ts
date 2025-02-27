import axios from 'axios';
import * as cheerio from 'cheerio';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import metascraper from 'metascraper';
import metascraperAuthor from 'metascraper-author';
import metascraperDate from 'metascraper-date';
import metascraperPublisher from 'metascraper-publisher';
import type { Chat } from 'openai/resources';

const scraper = metascraper([
  metascraperAuthor(),
  metascraperDate(),
  metascraperPublisher()
]);

const TRUSTED_DOMAINS = [
  'reuters.com',
  'apnews.com',
  'bloomberg.com',
  'nytimes.com',
  'wsj.com',
  'washingtonpost.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'economist.com',
  'ft.com',
  'forbes.com',
  'cnbc.com',
  'cnn.com'
];

export async function fetchArticleContent(url: string): Promise<string> {
  try {
    // Fetch the HTML content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = response.data;
    
    // Parse the HTML content using Readability
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent) {
      throw new Error('Could not extract article content');
    }

    // Clean up the text content
    const cleanContent = article.textContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    return cleanContent;
  } catch (error) {
    console.error('Error fetching article:', error);
    throw new Error('Failed to fetch article content');
  }
}

export async function extractMetadata(url: string) {
  try {
    // Fetch the HTML content
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const html = response.data;
    
    // Extract metadata using metascraper
    const metadata = await scraper({ html, url });
    
    // Parse the domain
    const domain = new URL(url).hostname.replace('www.', '');
    
    // Check if the domain is verified
    const isVerified = TRUSTED_DOMAINS.some(trustedDomain => 
      domain.endsWith(trustedDomain)
    );

    // If we couldn't get an author from metascraper, try extracting it from HTML
    let author = metadata.author;
    if (!author) {
      const $ = cheerio.load(html);
      author = $('meta[name="author"]').attr('content') ||
               $('meta[property="article:author"]').attr('content') ||
               $('[rel="author"]').first().text() ||
               'Unknown';
    }

    return {
      author: author || 'Unknown',
      publishDate: metadata.date ? new Date(metadata.date) : new Date(),
      domain,
      isVerified
    };
  } catch (error) {
    console.error('Error extracting metadata:', error);
    return {
      author: 'Unknown',
      publishDate: new Date(),
      domain: new URL(url).hostname,
      isVerified: false
    };
  }
}

export function calculateConfidenceScore(completion: Chat.ChatCompletion): number {
  try {
    const message = completion.choices[0]?.message;
    if (!message?.content) return 0;

    // Base confidence score
    let score = 70;

    // Factor 1: Response length (longer responses might indicate more comprehensive analysis)
    const wordCount = message.content.split(/\s+/).length;
    if (wordCount > 100) score += 5;
    if (wordCount > 200) score += 5;

    // Factor 2: Model's finish reason
    if (completion.choices[0]?.finish_reason === 'stop') {
      score += 5;
    }

    // Factor 3: Content quality indicators
    const hasNumbers = /\d+/.test(message.content);
    const hasQuotes = /"[^"]*"/.test(message.content);
    const hasParagraphs = message.content.split('\n\n').length > 1;

    if (hasNumbers) score += 5; // Contains specific data points
    if (hasQuotes) score += 5;  // Contains direct quotes
    if (hasParagraphs) score += 5; // Well-structured response

    // Cap the score at 100
    return Math.min(100, score);
  } catch (error) {
    console.error('Error calculating confidence score:', error);
    return 70; // Return a default score if calculation fails
  }
} 