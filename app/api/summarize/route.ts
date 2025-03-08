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

/**
 * Creates a model-appropriate prompt based on the model ID
 */
function createModelPrompt(text: string, modelId: string): string {
  const isT5Model = modelId.includes('t5');
  const isBartModel = modelId.includes('bart');
  const isFlanModel = modelId.includes('flan');
  
  if (isT5Model) {
    return `summarize: ${text}`;
  } else if (isBartModel) {
    return text; // BART models typically don't need a prefix
  } else if (isFlanModel) {
    return `Summarize the following text in a concise way:\n\n${text}\n\nSummary:`;
  } else {
    // Generic approach for other models
    return `Please provide a concise summary of the following text:\n\n${text}\n\nSummary:`;
  }
}

/**
 * Estimates token count - this is an approximation as different models tokenize differently
 */
function estimateTokenCount(text: string): number {
  // A very rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

async function generateSummary(text: string, type: string, maxRetries = 3, initialDelay = 2000) {
  const modelId = process.env.HUGGINGFACE_MODEL_ID || '';
  const isT5Model = modelId.includes('t5');
  const isBartModel = modelId.includes('bart');
  const isGPTModel = modelId.includes('gpt');
  
  // Safe token count for most Hugging Face models
  const maxTokens = 800;
  
  // Estimate token count and truncate if necessary
  const estimatedTokens = estimateTokenCount(text);
  const needsTruncation = estimatedTokens > maxTokens;
  
  // More conservative truncation to avoid token limit issues
  let truncatedText = text;
  if (needsTruncation) {
    // If we need to truncate, keep only about 75% of max tokens to be safe
    const safeMaxChars = Math.floor((maxTokens * 0.75) * 4);
    truncatedText = text.substring(0, safeMaxChars);
    console.log(`Truncated text from ~${estimatedTokens} tokens to ~${estimateTokenCount(truncatedText)} tokens`);
  }
  
  // Create a model-specific prompt
  const prompt = createModelPrompt(truncatedText, modelId);
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Configure parameters based on model type
      let parameters: any = {
        max_length: 130,
        min_length: 30,
        do_sample: true,
        temperature: 0.7
      };
      
      if (isT5Model || isBartModel) {
        // Summarization-specific parameters
        parameters = {
          ...parameters,
          length_penalty: 1.0,
          num_beams: 4,
          early_stopping: true
        };
      } else if (isGPTModel) {
        // Generation-specific parameters
        parameters = {
          ...parameters,
          top_p: 0.9,
          frequency_penalty: 0.5,
          presence_penalty: 0.5
        };
      }
      
      const response = await fetch(
        `https://api-inference.huggingface.co/models/${modelId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            inputs: prompt,
            parameters
          })
        }
      );

      if (!response.ok) {
        if (response.status === 503) {
          console.log('Model is loading, retrying...');
          throw new Error('Model is loading');
        }
        
        const errorText = await response.text();
        console.error(`API Error Response: ${errorText}`);
        throw new Error(`Hugging Face API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('API Response format:', typeof result, Array.isArray(result) ? 'array' : 'not array');
      
      // Handle different model output formats
      let summaryText = '';
      
      if (Array.isArray(result) && result.length > 0) {
        // Format for sequence-to-sequence models like BART/T5
        summaryText = result[0].summary_text || result[0].generated_text || '';
      } else if (result.generated_text) {
        // Format for text generation models
        summaryText = result.generated_text;
      } else if (typeof result === 'object' && result !== null) {
        // Generic fallback - try to find any property that might contain the summary
        summaryText = result.summary_text || result.generated_text || '';
        
        // If we couldn't find a standard property, inspect the object deeper
        if (!summaryText && Object.keys(result).length > 0) {
          const firstKey = Object.keys(result)[0];
          if (typeof result[firstKey] === 'string') {
            summaryText = result[firstKey];
          }
        }
      } else if (typeof result === 'string') {
        // Some models might directly return a string
        summaryText = result;
      }
      
      if (!summaryText) {
        console.error('API Response:', JSON.stringify(result, null, 2));
        throw new Error('Failed to extract summary from API response');
      }
      
      // Clean up the summary
      summaryText = summaryText.trim()
        .replace(/^Summary: /i, '')  // Remove "Summary:" prefix if present
        .replace(/^This article /i, 'The article '); // Minor cleaning
      
      // Calculate a simple confidence score based on summary length and retry attempts
      const confidenceScore = Math.min(
        0.95, // Max score
        0.70 + (summaryText.length / 500) * 0.20 - (attempt * 0.05)
      );

      return {
        summary: summaryText,
        confidenceScore
      };

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
        if (error instanceof Error && error.message.includes('INDICES element is out of DATA bounds')) {
          throw new Error('The content is too large for the AI model to process. Try with a shorter text or different model.');
        }
        throw new Error(`Summarization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      const delay = initialDelay * Math.pow(2, attempt) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Failed to generate summary after maximum retries');
}