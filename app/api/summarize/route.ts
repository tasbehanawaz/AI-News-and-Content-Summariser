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
        const { summary: generatedSummary, confidenceScore } = await generateSummary(contentToSummarize);
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

async function generateSummary(content: string): Promise<{ summary: string; confidenceScore: number }> {
  const MAX_INPUT_LENGTH = 1024; // Set a maximum input length for the model

  // Truncate content if it exceeds the maximum length
  if (content.length > MAX_INPUT_LENGTH) {
    console.warn(`Content length exceeds ${MAX_INPUT_LENGTH}. Truncating...`);
    content = content.substring(0, MAX_INPUT_LENGTH);
  }

  console.log('Generating summary for content:', content); // Log the content being summarized

  const response = await fetch("https://api-inference.huggingface.co/models/facebook/bart-large-cnn", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: content,
      parameters: { max_length: 500, min_length: 100, do_sample: false },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Error response from Hugging Face API:', errorText);
    
    if (response.status === 503) {
      throw new Error('Hugging Face API is currently unavailable. Please try again later.');
    }
    
    throw new Error(`Hugging Face API Error: ${response.status} ${response.statusText}`);
  }

  const huggingFaceResponse = await response.json();
  console.log('Hugging Face API Response:', huggingFaceResponse);

  if (!Array.isArray(huggingFaceResponse) || !huggingFaceResponse[0]?.summary_text) {
    throw new Error('Unexpected response format from Hugging Face');
  }

  // Extract the summary and confidence score from the response
  const summary = huggingFaceResponse[0].summary_text;
  const confidenceScore = huggingFaceResponse[0]?.confidence_score || 85; // Adjust this line based on actual API response

  return {
    summary,
    confidenceScore,
  };
}
