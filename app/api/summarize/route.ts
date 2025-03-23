import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { fetchArticleContent, extractMetadata } from '@/lib/article-utils';

type AiMetrics = {
  confidenceScore: number;
  processingTime: number;
  wordCount: number;
};

interface ModelParameters {
  max_length: number;
  min_length: number;
  do_sample: boolean;
  temperature: number;
  length_penalty?: number;
  num_beams?: number;
  early_stopping?: boolean;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;    // Added for repetition control
  no_repeat_ngram_size?: number;  // Added for n-gram repetition control
}

export async function POST(req: Request) {
  try {
    // Validate environment variables
    const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();
    const modelId = process.env.HUGGINGFACE_MODEL_ID?.trim();
    const fallbackModelId = process.env.FALLBACK_MODEL_ID || 'sshleifer/distilbart-cnn-12-6';

    if (!apiKey || !apiKey.startsWith('hf_')) {
      console.error('Invalid API key format:', {
        exists: !!apiKey,
        length: apiKey?.length,
        startsWithHf: apiKey?.startsWith('hf_')
      });
      return NextResponse.json({ 
        error: 'Invalid API configuration. Please check your API key format.' 
      }, { status: 500 });
    }

    if (!modelId) {
      console.error('Missing model ID');
      return NextResponse.json({ 
        error: 'Invalid API configuration. Model ID is missing.' 
      }, { status: 500 });
    }

    console.log('Configuration validated:', {
      modelId,
      fallbackModelId,
      apiKeyLength: apiKey.length,
      apiKeyPrefix: apiKey.substring(0, 5)
    });

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
 * Estimates token count - this is an approximation as different models tokenize differently
 */
function estimateTokenCount(text: string): number {
  // A very rough approximation: 1 token ≈ 4 characters for English text
  return Math.ceil(text.length / 4);
}

async function generateSummary(text: string, type: string, maxRetries = 3, initialDelay = 2000) {
  const modelId = process.env.HUGGINGFACE_MODEL_ID || 'facebook/bart-large-cnn';
  const fallbackModelId = process.env.FALLBACK_MODEL_ID || 'sshleifer/distilbart-cnn-12-6';
  const apiKey = process.env.HUGGINGFACE_API_KEY?.trim();

  console.log('Attempting API call with:');
  console.log('Model ID:', modelId);
  console.log('Fallback Model ID:', fallbackModelId);
  console.log('API Key length:', apiKey?.length);
  console.log('API Key starts with:', apiKey?.substring(0, 5));
  
  // Initial text cleaning before processing
  let cleanedText = text
    // Basic cleanup
    .replace(/[\u2018\u2019]/g, "'")   // Smart quotes
    .replace(/[\u201C\u201D]/g, '"')   // Smart double quotes
    .replace(/[\u2013\u2014]/g, '-')   // Em and en dashes
    .replace(/\s+/g, ' ')              // Multiple spaces
    .replace(/[^\x20-\x7E\n]/g, '')    // Keep only printable ASCII and newlines
    .trim();

  // Split into sentences and rejoin to ensure proper formatting
  const sentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [cleanedText];
  cleanedText = sentences
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0)
    .join(' ');

  // Truncate if needed
  const maxTokens = 1024;
  const estimatedTokens = estimateTokenCount(cleanedText);
  if (estimatedTokens > maxTokens) {
    const safeMaxChars = Math.floor((maxTokens * 0.75) * 4);
    // Try to truncate at a sentence boundary
    const truncated = cleanedText.substring(0, safeMaxChars);
    const lastSentence = truncated.match(/.*[.!?]/);
    cleanedText = lastSentence ? lastSentence[0] : truncated;
  }

  const prompt = `Generate a comprehensive summary of the following text. Format your response as complete, well-structured paragraphs with clear sentences. Include the main points and key details of the text. Maintain a logical flow between ideas:\n\n${cleanedText}\n\nSummary:`;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const parameters: ModelParameters = {
        max_length: 300,           // Increased max length
        min_length: 30,           // Reduced min length
        do_sample: true,          // Enable sampling for more natural text
        temperature: 0.7,         // Increased temperature for more variety
        top_p: 0.9,              // Added top_p sampling
        length_penalty: 1.5,      // Adjusted length penalty
        num_beams: 5,            // Increased beam search
        early_stopping: true,
        repetition_penalty: 1.2,  // Add repetition penalty to avoid repetitive phrases
        no_repeat_ngram_size: 3   // Prevent 3-grams from repeating
      };

      const response = await fetch(
        `https://api-inference.huggingface.co/models/${modelId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            inputs: prompt,
            parameters,
            options: {
              use_cache: false,
              wait_for_model: true
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
        console.error('API Response:', {
          status: response.status,
          text: errorText
        });
        throw new Error(`Hugging Face API Error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      console.log('Raw API Response:', JSON.stringify(result, null, 2));
      
      // Extract and clean the summary text
      let summaryText = '';
      if (Array.isArray(result) && result.length > 0) {
        summaryText = result[0].summary_text || result[0].generated_text || '';
      } else if (typeof result === 'object' && result !== null) {
        summaryText = result.summary_text || result.generated_text || '';
        
        // Handle nested output formats
        if (!summaryText && result.output) {
          summaryText = typeof result.output === 'string' ? result.output :
                       (Array.isArray(result.output) ? result.output.join(' ') : '');
        }
        
        // Handle alternative responses with different property names
        if (!summaryText && result.text) {
          summaryText = result.text;
        }
      } else if (typeof result === 'string') {
        summaryText = result;
      }

      // If we still couldn't find a summary, try a more aggressive approach
      if (!summaryText) {
        // Try to find any string property in the response object
        if (typeof result === 'object' && result !== null) {
          const extractText = (obj: Record<string, unknown>): string => {
            for (const key in obj) {
              const value = obj[key];
              if (typeof value === 'string' && value.length > 50) {
                return value;
              } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                const nestedText = extractText(value as Record<string, unknown>);
                if (nestedText) return nestedText;
              } else if (Array.isArray(value) && value.length > 0) {
                const firstItem = value[0];
                if (typeof firstItem === 'string' && firstItem.length > 50) {
                  return firstItem;
                } else if (typeof firstItem === 'object' && firstItem !== null) {
                  const nestedText = extractText(firstItem as Record<string, unknown>);
                  if (nestedText) return nestedText;
                }
              }
            }
            return '';
          };
          
          summaryText = extractText(result);
        }
      }

      if (!summaryText) {
        throw new Error('Failed to extract summary from API response');
      }

      // Final cleaning and validation of the summary
      summaryText = summaryText
        .trim()
        .replace(/^Summary:?\s*/i, '')
        .replace(/^This article\s+/i, 'The article ')
        .replace(/\s+/g, ' ')
        .replace(/[^\x20-\x7E\n]/g, '')
        .trim();

      // Check if the summary is a jumbled mess of words (no proper sentences)
      const hasProperSentences = /[.!?]\s+[A-Z]/.test(summaryText) || // Checks for sentence endings followed by capital letters
                                (summaryText.split(/[.!?]/).length > 1 && summaryText.length > 100); // Or multiple sentence endings and reasonable length
      
      // Check for garbled text by counting the ratio of long words without vowels
      const words = summaryText.split(/\s+/);
      const garbledWordCount = words.filter(word => 
        word.length > 7 && !/[aeiou]/i.test(word)
      ).length;
      const garbledRatio = garbledWordCount / words.length;
      const isGarbled = garbledRatio > 0.1 || // More than 10% garbled words
                         (words.length > 20 && !hasProperSentences); // Long text without proper sentences
      
      if (isGarbled) {
        console.log('Detected garbled text, trying fallback model');
        
        // Try to use the fallback model if this is the first attempt
        if (attempt === 0) {
          try {
            // Use a different model with different parameters
            const fallbackResponse = await fetch(
              `https://api-inference.huggingface.co/models/${fallbackModelId}`,
              {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${apiKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                  inputs: `Summarize the following text in a concise way: ${cleanedText.substring(0, 1000)}`,
                  parameters: {
                    max_length: 300,
                    min_length: 50,
                    do_sample: false,       // Disable sampling for more deterministic output
                    num_beams: 4,           // Use beam search
                    top_k: 50,              // Restrict to top 50 tokens
                    temperature: 0.3,       // Lower temperature for more focused output
                    no_repeat_ngram_size: 3 // Avoid repetitive phrases
                  }
                })
              }
            );
            
            if (fallbackResponse.ok) {
              const fallbackResult = await fallbackResponse.json();
              console.log('Fallback model response:', JSON.stringify(fallbackResult, null, 2));
              
              // Extract the text from the fallback model response
              let fallbackText = '';
              if (Array.isArray(fallbackResult) && fallbackResult.length > 0) {
                fallbackText = fallbackResult[0].generated_text || '';
              } else if (typeof fallbackResult === 'object' && fallbackResult !== null) {
                fallbackText = fallbackResult.generated_text || fallbackResult.summary_text || '';
              }
              
              if (fallbackText && fallbackText.length > 50) {
                // Clean the fallback text
                fallbackText = fallbackText
                  .trim()
                  .replace(/^Summarize the following text[^:]*:\s*/i, '')
                  .replace(/\s+/g, ' ')
                  .trim();
                
                // Verify it's not garbled
                const fallbackWords = fallbackText.split(/\s+/);
                const fallbackGarbledCount = fallbackWords.filter(word => 
                  word.length > 7 && !/[aeiou]/i.test(word)
                ).length;
                
                if (fallbackGarbledCount / fallbackWords.length < 0.05) {
                  console.log('Using fallback model summary');
                  return {
                    summary: fallbackText,
                    confidenceScore: 0.75
                  };
                }
              }
            }
          } catch (fallbackError) {
            console.error('Error using fallback model:', fallbackError);
            // Continue with the original text extraction fallback
          }
        }
        
        // If fallback model fails or this is a retry, use text extraction
        console.log('Using text extraction as fallback');
        
        // Create a simplified summary from the original text instead
        let simpleSummary = '';
        
        // Extract the first 3-5 sentences from the original text as a simple summary
        const originalSentences = cleanedText.match(/[^.!?]+[.!?]+/g) || [];
        if (originalSentences.length > 0) {
          const sentenceCount = Math.min(originalSentences.length, 5);
          simpleSummary = originalSentences.slice(0, sentenceCount).join(' ');
          
          // Make sure it's not too long
          if (simpleSummary.length > 500) {
            simpleSummary = simpleSummary.substring(0, 497) + '...';
          }
          
          // Add a disclaimer
          simpleSummary = "Summary: " + simpleSummary;
          
          console.log('Using fallback summary method with first few sentences of the article');
          summaryText = simpleSummary;
        } else {
          // If we can't extract sentences, create a generic message
          summaryText = "This article discusses various topics. Please read the full article for more details.";
        }
      } else if (!hasProperSentences) {
        // Try to reformat by adding sentence breaks if it's just a series of words
        const words = summaryText.split(/\s+/);
        if (words.length > 20) { // Only attempt to fix longer jumbled summaries
          // Create sentences of 8-12 words each for better readability
          let reformatted = '';
          let currentSentence = '';
          let wordCount = 0;
          
          for (const word of words) {
            currentSentence += (wordCount === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ' ' + word);
            wordCount++;
            
            if (wordCount >= 10 || // Create reasonably sized sentences
                word.endsWith(',') || // Use commas as natural breaking points
                reformatted.length + currentSentence.length > 400) { // Prevent overly long sentences
              
              reformatted += currentSentence + '. ';
              currentSentence = '';
              wordCount = 0;
            }
          }
          
          if (currentSentence) {
            reformatted += currentSentence + '.';
          }
          
          summaryText = reformatted.trim();
        } else {
          // For shorter summaries, just ensure it ends with a period
          if (!/[.!?]$/.test(summaryText)) {
            summaryText += '.';
          }
        }
      } else {
        // Add period if missing at the end for well-formed summaries
        if (!/[.!?]$/.test(summaryText)) {
          summaryText += '.';
        }
      }

      // Ensure first letter is capitalized
      summaryText = summaryText.charAt(0).toUpperCase() + summaryText.slice(1);

      // More lenient validation
      if (summaryText.length < 20) { // Reduced minimum length
        console.log('Summary too short:', summaryText);
        throw new Error('Generated summary is too short');
      }

      const confidenceScore = Math.min(
        0.95,
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
        throw error;
      }
      
      await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, attempt)));
    }
  }

  throw new Error('Failed to generate summary after maximum retries');
}