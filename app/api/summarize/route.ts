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

    // Final quality check to prevent any potential garbled text from reaching the frontend
    const isGarbledSummary = isGarbledText(summary);
    if (isGarbledSummary) {
      console.error('❌ Quality check failed: Summary appears to be garbled:', summary);
      
      // Create a fallback summary from the first few sentences of the content
      const sentences = contentToSummarize.match(/[^.!?]+[.!?]+/g) || [];
      if (sentences.length > 0) {
        // Get complete sentences for the fallback
        const sentenceCount = Math.min(sentences.length, 3); // Reduced to 3 sentences for brevity
        const selectedSentences = sentences.slice(0, sentenceCount);
        
        // Format the sentences properly
        let fallbackSummary = selectedSentences.join(' ');
        
        // Clean up the fallback summary
        fallbackSummary = fallbackSummary
          .replace(/\s+/g, ' ')
          .trim();
          
        // Ensure it's not too long
        if (fallbackSummary.length > 300) {
          // Find the last complete sentence that fits within the limit
          const truncatedSentences = [];
          let currentLength = 0;
          
          for (const sentence of selectedSentences) {
            if (currentLength + sentence.length <= 280) {
              truncatedSentences.push(sentence);
              currentLength += sentence.length + 1; // +1 for the space
            } else {
              break;
            }
          }
          
          if (truncatedSentences.length === 0) {
            // If even the first sentence is too long, truncate it
            fallbackSummary = selectedSentences[0].substring(0, 277) + '...';
          } else {
            fallbackSummary = truncatedSentences.join(' ');
          }
        }
        
        summary = fallbackSummary;
        console.log('Using emergency fallback for garbled text - first sentences of article');
      } else {
        summary = "We couldn't generate a proper summary for this article. Please try a different article or try again later.";
      }
      
      // Adjust metrics for fallback summary
      if (aiMetrics) {
        aiMetrics.confidenceScore = Math.max(0.5, aiMetrics.confidenceScore * 0.7);
        aiMetrics.wordCount = summary.split(/\s+/).length;
      }
    } else {
      // Even if not garbled, fix any spacing issues and ensure conciseness
      summary = fixTextSpacing(summary);
      
      // If summary is too long, truncate it while preserving complete sentences
      if (summary.length > 300) {
        // Try to truncate at a sentence boundary
        const sentences = summary.match(/[^.!?]+[.!?]+/g) || [];
        
        if (sentences.length > 0) {
          let conciseSummary = '';
          let sentenceIndex = 0;
          
          // Ensure we keep complete sentences only
          while (sentenceIndex < sentences.length && (conciseSummary.length + sentences[sentenceIndex].length + 1) <= 300) {
            conciseSummary += (sentenceIndex > 0 ? ' ' : '') + sentences[sentenceIndex];
            sentenceIndex++;
          }
          
          // If we couldn't even fit the first sentence, truncate it with ellipsis
          if (conciseSummary.length === 0 && sentences.length > 0) {
            conciseSummary = sentences[0]?.substring(0, 297) + '...' || 'Summary unavailable.';
          }
          
          summary = conciseSummary;
        } else {
          // If we can't find sentence boundaries, just truncate with ellipsis
          summary = summary.substring(0, 297) + '...';
        }
        
        // Update metrics
        if (aiMetrics) {
          aiMetrics.wordCount = summary.split(/\s+/).length;
        }
      }
    }

    // Final check to ensure we have complete sentences
    if (summary) {
      // Check if summary ends mid-sentence (ends with a word character but not a period)
      if (/\w+\s*$/.test(summary) && !/[.!?]$/.test(summary)) {
        console.log('Summary appears to end abruptly:', summary);
        
        // Option 1: Try to find the last complete sentence
        const lastSentenceMatch = summary.match(/^(.*?[.!?])[^.!?]*$/);
        if (lastSentenceMatch && lastSentenceMatch[1]) {
          // Use the last complete sentence
          summary = lastSentenceMatch[1].trim();
          console.log('Fixed to end at last complete sentence:', summary);
        } else {
          // Option 2: Add an ellipsis to indicate truncation
          summary = summary.trim() + '...';
          console.log('Added ellipsis to indicate truncation:', summary);
        }
        
        // Update metrics
        if (aiMetrics) {
          aiMetrics.wordCount = summary.split(/\s+/).length;
        }
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

  // Use prompt that specifically asks for a concise, short summary
  const prompt = `Generate a concise, easy-to-read summary of the following text in 3-4 complete sentences. Focus on the main points only and use simple language. Make sure to complete your thoughts and provide a coherent summary that stands on its own:\n\n${cleanedText}\n\nSummary:`;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      const parameters: ModelParameters = {
        max_length: 150,           // Reduced max length for more concise summaries
        min_length: 30,           // Minimum length for a reasonable summary
        do_sample: true,          // Enable sampling for more natural text
        temperature: 0.7,         // Keep moderate temperature
        top_p: 0.9,               // Added top_p sampling
        length_penalty: 1.0,      // Adjusted length penalty to avoid unnecessarily long summaries
        num_beams: 5,             // Increased beam search
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

      // Use a more robust text cleaning process to fix spacing issues
      summaryText = fixTextSpacing(summaryText);

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

/**
 * Helper function to fix common text spacing issues in the model output
 */
function fixTextSpacing(text: string): string {
  if (!text) return '';
  
  // Step 1: Normalize basic whitespace
  let cleanedText = text.trim().replace(/\s+/g, ' ');
  
  // Step 2: Fix run-together words by adding spaces where capital letters appear mid-word
  // This handles cases like "RegardsDuring" -> "Regards During"
  cleanedText = cleanedText.replace(/([a-z])([A-Z])/g, '$1 $2');
  
  // Step 3: Remove common prefixes added by models
  cleanedText = cleanedText
    .replace(/^Summary:\s*/i, '')
    .replace(/^Here is a summary of the text:\s*/i, '')
    .replace(/^The summary of the article is:\s*/i, '');
  
  // Step 4: Fix words that are improperly concatenated without spaces
  // Look for patterns where lowercase ends and either number or uppercase starts
  cleanedText = cleanedText.replace(/([a-z])(\d+)/g, '$1 $2');
  
  // Step 5: Fix non-spaced punctuation
  cleanedText = cleanedText
    .replace(/([.,!?])([A-Za-z0-9])/g, '$1 $2')  // Add space after punctuation
    .replace(/\s+([.,!?])/g, '$1')               // Remove space before punctuation
    .replace(/\.{3,}/g, '...')                   // Normalize ellipses
    .replace(/\s{2,}/g, ' ');                    // Remove any double spaces created
    
  // Step 6: Split on unusual character sequences that might indicate merged words
  const strangePatterns = [
    /([a-z]{2,})(\d{2,})/g,       // Word followed immediately by multiple digits
    /([a-z])([A-Z]{2,})/g,        // Lowercase letter followed by multiple uppercase
    /([A-Za-z])([^\w\s])/g,       // Letter followed by symbol
    /([^\w\s])([A-Za-z])/g        // Symbol followed by letter
  ];
  
  strangePatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '$1 $2');
  });
  
  // Step 7: Fix common symbols and ensure spaces around them
  cleanedText = cleanedText
    .replace(/\/\//g, '/')           // Fix doubled slashes
    .replace(/([^\s])(https?:)/gi, '$1 $2')  // Fix URLs without spaces before them
    .replace(/(\w)(\()/g, '$1 $2')   // Add space before opening parenthesis
    .replace(/(\))(\w)/g, '$1 $2');  // Add space after closing parenthesis
  
  // Step 8: Clean up after fixes (remove any double spaces created)
  cleanedText = cleanedText.replace(/\s{2,}/g, ' ').trim();
  
  // Step 9: Ensure the text ends with proper punctuation
  if (!/[.!?]$/.test(cleanedText)) {
    cleanedText += '.';
  }
  
  // Step 10: Ensure first letter is capitalized
  cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
  
  return cleanedText;
}

/**
 * Helper function to detect garbled text outside the regular generation flow
 * This serves as a final quality check before sending the summary to the client
 */
function isGarbledText(text: string): boolean {
  if (!text || text.length < 20) return true;
  
  // Check for proper sentence structure
  const hasProperSentences = /[.!?]\s+[A-Z]/.test(text) || 
                            (text.split(/[.!?]/).length > 1 && text.length > 100);
  
  // Check for garbled words (long words without vowels)
  const words = text.split(/\s+/);
  const garbledWordCount = words.filter(word => 
    word.length > 7 && !/[aeiou]/i.test(word)
  ).length;
  
  const garbledRatio = garbledWordCount / words.length;
  const hasGarbledWords = garbledRatio > 0.05; // Lower threshold for final check (5%)
  
  // Check for repetitive patterns that might indicate model failure
  const repeatedPhrases = text.match(/(.{10,50})(?=.*\1)/g);
  const hasRepeatedPhrases = repeatedPhrases ? repeatedPhrases.length > 1 : false;
  
  // Check for run-together words (words without spaces)
  const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
  const hasRunTogetherWords = avgWordLength > 12; // Most English words are shorter than this
  
  // Check for unusual character sequences that might indicate garbled text
  const hasStrangeSequences = /[A-Z]{5,}|[a-z]{15,}|\d{4,}/.test(text);

  return (!hasProperSentences) || 
         hasGarbledWords || 
         hasRepeatedPhrases || 
         hasRunTogetherWords || 
         hasStrangeSequences;
}