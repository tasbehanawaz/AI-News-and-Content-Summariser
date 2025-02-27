import axios from 'axios';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function fetchArticleContent(url: string) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Remove unnecessary elements
    $('script, style, nav, footer, header, aside').remove();

    // Extract article metadata
    const title = $('h1').first().text() || $('title').text();
    const author = $('meta[name="author"]').attr('content') || 
                  $('article[data-author]').attr('data-author') || 
                  'Unknown';
    const publishDate = $('meta[property="article:published_time"]').attr('content') ||
                       $('time').attr('datetime') ||
                       'Unknown';
    
    // Extract main content
    const content = $('article, [role="main"], .article-content, .post-content')
      .first()
      .text()
      .trim();

    // Fallback to body content if no article content found
    const bodyContent = content || $('body').text().trim();

    // Clean up the text
    const cleanContent = bodyContent
      .replace(/\s+/g, ' ')
      .replace(/\n+/g, '\n')
      .trim();

    return {
      title,
      author,
      publishDate,
      content: cleanContent,
      domain: new URL(url).hostname
    };
  } catch (error) {
    console.error('Error fetching article:', error);
    throw new Error('Failed to fetch article content');
  }
}

export async function generateSummary(content: string) {
  // Check for API key before making any API calls
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_api_key_here') {
    console.log('No valid API key found, returning placeholder summary');
    return {
      summary: "This is a placeholder summary while the OpenAI API key is not configured. The actual summary will be generated once the API key is set up. This summary would typically contain key points from the article, main arguments, and important details, all processed by AI to give you the most relevant information.",
      aiMetrics: {
        confidenceScore: 95,
        processingTime: 1.2,
        wordCount: 54
      }
    };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional news summarizer. Create concise, accurate summaries while maintaining key information and context."
        },
        {
          role: "user",
          content: `Please summarize the following article content. Focus on the main points and key details:\n\n${content}`
        }
      ],
      temperature: 0.5,
      max_tokens: 500
    });

    const summary = response.choices[0].message.content || '';
    
    // Calculate metrics
    const confidenceScore = calculateConfidenceScore(summary, content);
    const wordCount = summary.split(/\s+/).length;

    return {
      summary,
      aiMetrics: {
        confidenceScore,
        processingTime: response.usage?.total_tokens || 0,
        wordCount
      }
    };
  } catch (error) {
    console.error('Error generating summary:', error);
    throw new Error('Failed to generate summary');
  }
}

function calculateConfidenceScore(summary: string, originalContent: string): number {
  // Basic confidence score calculation
  // You can make this more sophisticated based on your needs
  const summaryLength = summary.length;
  const originalLength = originalContent.length;
  
  // If summary is too short or too long relative to content
  if (summaryLength < 50 || summaryLength > originalLength * 0.5) {
    return 70; // Base confidence
  }

  // Higher confidence for optimal length summaries
  return 85;
} 