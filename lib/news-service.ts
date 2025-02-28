import axios from 'axios';

export interface NewsArticle {
  title: string;
  description: string;
  url: string;
  urlToImage: string;
  publishedAt: string;
  source: {
    name: string;
  };
  author: string;
}

export interface NewsResponse {
  articles: NewsArticle[];
  totalResults: number;
  status: string;
}

const NEWS_API_KEY = process.env.NEWS_API_KEY;
const BASE_URL = 'https://newsapi.org/v2';

// Validate API key is present
if (!NEWS_API_KEY) {
  console.error('NEWS_API_KEY is not configured in environment variables');
}

export async function getTopNews(category?: string, page: number = 1) {
  try {
    if (!NEWS_API_KEY) {
      throw new Error('News API key is not configured');
    }

    const response = await axios.get(`${BASE_URL}/top-headlines`, {
      params: {
        country: 'us',
        category,
        page,
        pageSize: 10,
        apiKey: NEWS_API_KEY,
      },
    });
    
    // Validate response structure
    if (response.data.status !== 'ok') {
      throw new Error(response.data.message || 'Failed to fetch news');
    }

    // Filter out articles without required fields
    const articles = response.data.articles.filter((article: NewsArticle) => 
      article.title && 
      article.url && 
      !article.title.includes('[Removed]')
    );

    return {
      articles,
      totalResults: response.data.totalResults,
      status: response.data.status
    } as NewsResponse;
  } catch (error) {
    console.error('Error fetching news:', error);
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    throw new Error('Failed to fetch news');
  }
}

export async function searchNews(query: string, page: number = 1) {
  try {
    if (!NEWS_API_KEY) {
      throw new Error('News API key is not configured');
    }

    const response = await axios.get(`${BASE_URL}/everything`, {
      params: {
        q: query,
        page,
        pageSize: 10,
        apiKey: NEWS_API_KEY,
        sortBy: 'relevancy',
        language: 'en', // Add language filter
      },
    });
    
    // Validate response structure
    if (response.data.status !== 'ok') {
      throw new Error(response.data.message || 'Failed to search news');
    }

    // Filter out articles without required fields
    const articles = response.data.articles.filter((article: NewsArticle) => 
      article.title && 
      article.url && 
      !article.title.includes('[Removed]')
    );

    return {
      articles,
      totalResults: response.data.totalResults,
      status: response.data.status
    } as NewsResponse;
  } catch (error) {
    console.error('Error searching news:', error);
    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }
    throw new Error('Failed to search news');
  }
}

export const NEWS_CATEGORIES = [
  'general',
  'business',
  'technology',
  'entertainment',
  'health',
  'science',
  'sports',
] as const; 