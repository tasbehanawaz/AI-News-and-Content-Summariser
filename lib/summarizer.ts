interface Article {
  title: string;
  content: string;
  url: string;
}

interface Summary {
  title: string;
  content: string;
  originalUrl: string;
}

async function summarizeWithHuggingFace(text: string): Promise<string> {
  const modelId = process.env.HUGGINGFACE_MODEL_ID || 'facebook/bart-large-cnn';
  
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
    throw new Error('Failed to generate summary');
  }

  const result = await response.json();
  return result[0].summary_text || result[0].generated_text;
}

export async function summarizeArticles(articles: Article[]): Promise<Summary[]> {
  return Promise.all(articles.map(async (article) => {
    const summary = await summarizeWithHuggingFace(article.content);
    return {
      title: article.title,
      content: summary,
      originalUrl: article.url,
    };
  }));
} 