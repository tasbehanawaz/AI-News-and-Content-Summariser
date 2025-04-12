import { Article } from '@prisma/client';

export interface Summary {
  title: string;
  content: string;
  source?: string;
  author?: string | null;
  publishedAt?: string;
}

async function summarizeWithHuggingFace(text: string): Promise<string> {
  const modelId = process.env.HUGGINGFACE_MODEL_ID || 'facebook/bart-large-cnn';
  const fallbackModelId = process.env.FALLBACK_MODEL_ID || 'sshleifer/distilbart-cnn-12-6';
  
  try {
    const response = await fetch(
      `https://api-inference.huggingface.co/models/${modelId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          inputs: text,
          parameters: {
            max_length: 130,
            min_length: 30,
            do_sample: false,
            temperature: 0.7,
            num_beams: 4,
            early_stopping: true
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error('Failed to generate summary with primary model');
    }

    const result = await response.json();
    return result[0].summary_text || result[0].generated_text;
  } catch (error) {
    console.error('Error with primary model, trying fallback:', error);
    
    // Try fallback model
    const fallbackResponse = await fetch(
      `https://api-inference.huggingface.co/models/${fallbackModelId}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          inputs: text,
          parameters: {
            max_length: 130,
            min_length: 30,
            do_sample: false,
            temperature: 0.7,
            num_beams: 4,
            early_stopping: true
          }
        })
      }
    );

    if (!fallbackResponse.ok) {
      throw new Error('Failed to generate summary with fallback model');
    }

    const result = await fallbackResponse.json();
    return result[0].summary_text || result[0].generated_text;
  }
}

export async function summarizeArticles(articles: Article[]): Promise<Summary[]> {
  try {
    const summaries: Summary[] = [];
    
    for (const article of articles) {
      try {
        const summary = await summarizeWithHuggingFace(article.content);
        
        summaries.push({
          title: article.title,
          content: summary,
          source: article.source || undefined,
          author: article.author || undefined,
          publishedAt: article.publishedAt?.toISOString()
        });
      } catch (error) {
        console.error(`Error summarizing article ${article.id}:`, error);
        // Fallback to original content if summarization fails
        summaries.push({
          title: article.title,
          content: article.content,
          source: article.source || undefined,
          author: article.author || undefined,
          publishedAt: article.publishedAt?.toISOString()
        });
      }
    }
    
    return summaries;
  } catch (error) {
    console.error('Error in summarizeArticles:', error);
    // Fallback to returning original articles if summarization fails
    return articles.map(article => ({
      title: article.title,
      content: article.content,
      source: article.source || undefined,
      author: article.author || undefined,
      publishedAt: article.publishedAt?.toISOString()
    }));
  }
} 