import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchArticleContent, extractMetadata } from '@/lib/article-utils';

type AiMetrics = {
  confidenceScore: number;
  processingTime: number;
  wordCount: number;
};

export async function POST(req: Request) {
  try {
    console.log('API Key:', process.env.HUGGINGFACE_API_KEY ? 'Loaded ✅' : 'Not Found ❌');
    
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error('❌ Invalid JSON in request body:', error);
      return NextResponse.json({ error: 'Invalid JSON format' }, { status: 400 });
    }

    const { url, type } = body || {};

    if (!url || !type) {
      return NextResponse.json({ error: 'URL and type must be provided' }, { status: 400 });
    }

    const startTime = Date.now();
    let contentToSummarize: string;

    try {
      contentToSummarize = await fetchArticleContent(url);
    } catch (error) {
      console.error('❌ Error fetching content:', error);
      return NextResponse.json({ error: 'Failed to fetch article content' }, { status: 422 });
    }

    if (!contentToSummarize || contentToSummarize.length < 50) {
      return NextResponse.json({ error: 'Insufficient content for summarization' }, { status: 422 });
    }

    let summary: string = '';
    let aiMetrics: AiMetrics | null = null;

    if (!process.env.HUGGINGFACE_API_KEY) {
      summary = `This is a placeholder summary. Add your Hugging Face API key for real summaries.`;
      aiMetrics = { confidenceScore: 85, processingTime: 0.5, wordCount: 150 };
    } else {
      try {
        const { summary: generatedSummary, confidenceScore } = await generateSummary(contentToSummarize, type);
        summary = generatedSummary;
        aiMetrics = {
          confidenceScore,
          processingTime: (Date.now() - startTime) / 1000,
          wordCount: summary.split(/\s+/).length,
        };
      } catch (error) {
        console.error('❌ Summarization error:', error);
        return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
      }
    }

    let sourceMetadata = null;
    if (type === 'url') {
      try {
        sourceMetadata = await extractMetadata(url);
      } catch (error) {
        console.error('⚠️ Error extracting metadata:', error);
        sourceMetadata = null;
      }
    }

    console.log('✅ Source Metadata:', sourceMetadata);
    console.log('✅ AI Metrics:', aiMetrics);
    console.log('Summary:', summary);
    console.log('Input Type:', type);
    console.log('Input Content:', url);

    let savedSummary;
    try {
      // Ensure required fields are present before saving
      if (!summary || !type || !url) {
        console.error('❌ Missing required fields for saving summary:', { summary, type, inputContent: url });
        return NextResponse.json({ error: 'Missing required fields for saving summary' }, { status: 400 });
      }
      
      // Log the values being saved
      console.log('Saving summary with the following data:', {
        content: summary,
        inputType: type,
        inputContent: url,
        sourceMetadata,
        aiMetrics,
      });

      // Ensure sourceMetadata and aiMetrics are properly formatted before saving
      savedSummary = await prisma.summary.create({
        data: {
          content: summary,
          inputType: type,
          inputContent: url,
          sourceMetadata: sourceMetadata
            ? {
                create: {
                  author: sourceMetadata.author ?? null,
                  publishDate: sourceMetadata.publishDate ?? null,
                  domain: sourceMetadata.domain ?? null,
                  isVerified: sourceMetadata.isVerified ?? false,
                },
              }
            : undefined,
          aiMetrics: aiMetrics
            ? {
                create: {
                  confidenceScore: aiMetrics.confidenceScore,
                  processingTime: aiMetrics.processingTime,
                  wordCount: aiMetrics.wordCount,
                },
              }
            : undefined,
        },
        include: { sourceMetadata: true, aiMetrics: true },
      });
    } catch (error: unknown) {
      console.error('❌ Database error while saving summary:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return NextResponse.json({ error: 'Failed to save summary', details: errorMessage }, { status: 500 });
    }

    return NextResponse.json({
      summary: savedSummary.content,
      sourceMetadata: savedSummary.sourceMetadata,
      aiMetrics: savedSummary.aiMetrics,
    });
  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

async function generateSummary(text: string, type: string, maxRetries = 3, initialDelay = 2000) {
  // Truncate text if it's too long (typical model limit is around 1024 tokens)
  const maxChars = 4096;
  const truncatedText = text.length > maxChars ? text.substring(0, maxChars) : text;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${process.env.HUGGINGFACE_MODEL_ID}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            inputs: truncatedText,
            parameters: {
              max_length: 150,
              min_length: 50,
              length_penalty: 2.0,
              num_beams: 4,
              do_sample: false
            }
          })
        }
      );

      if (!response.ok) {
        if (response.status === 503) {
          console.log('Model is loading, retrying...');
          throw new Error('Model is loading');
        }
        
        const errorText = await response.text();
        throw new Error(`Hugging Face API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (Array.isArray(result) && result.length > 0) {
        const summaryText = result[0].summary_text || result[0].generated_text;
        return {
          summary: summaryText,
          confidenceScore: 0.95 // Default confidence score
        };
      }
      
      throw new Error('Invalid response format from API');

    } catch (error) {
      attempt++;
      console.error(`Attempt ${attempt} failed:`, error);

      if (attempt === maxRetries) {
        if (error instanceof Error && error.message.includes('NetworkError')) {
          throw new Error('Network connection is unstable. Please check your internet connection and try again.');
        }
        if (error instanceof Error && error.message.includes('Model is loading')) {
          throw new Error('The AI model is currently initializing. Please try again in a few moments.');
        }
        throw new Error(`Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to generate summary after maximum retries');
}
