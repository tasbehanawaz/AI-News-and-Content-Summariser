import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';
import { ChatCompletion } from 'openai/resources/chat';
import { fetchArticleContent, extractMetadata, calculateConfidenceScore } from '@/lib/article-utils';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { url, text, type } = await req.json();
    const startTime = Date.now();

    if (!url && !text) {
      return NextResponse.json(
        { error: 'Either URL or text must be provided' },
        { status: 400 }
      );
    }

    // Validate URL if provided
    if (type === 'url') {
      try {
        new URL(url);
      } catch {
        return NextResponse.json(
          { error: 'Invalid URL format' },
          { status: 400 }
        );
      }
    }

    let contentToSummarize: string;
    try {
      contentToSummarize = type === 'url' ? await fetchArticleContent(url) : text;
    } catch (error) {
      console.error('Error fetching content:', error);
      return NextResponse.json(
        { error: 'Failed to fetch article content. Please check if the URL is accessible.' },
        { status: 422 }
      );
    }

    if (!contentToSummarize || contentToSummarize.length < 50) {
      return NextResponse.json(
        { error: 'Could not extract meaningful content. Please check the input.' },
        { status: 422 }
      );
    }

    let summary: string;
    let completion: ChatCompletion;

    // Check if OpenAI API key is properly configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.trim() === '') {
      // Return mock data for development
      const mockSourceMetadata = type === 'url' ? {
        author: "John Doe",
        publishDate: new Date().toISOString(),
        domain: new URL(url).hostname,
        isVerified: true
      } : null;

      const mockAiMetrics = {
        confidenceScore: 85,
        processingTime: 0.5,
        wordCount: 150
      };

      return NextResponse.json({
        summary: `This is a development placeholder summary for the following content type: ${type}.\n\nWhen you add your OpenAI API key, this will be replaced with an AI-generated summary of your content.\n\nThe content will be processed and analyzed using OpenAI's GPT model to provide accurate, concise summaries while maintaining key information.`,
        sourceMetadata: mockSourceMetadata,
        aiMetrics: mockAiMetrics
      });
    } else {
      // Generate summary using OpenAI
      completion = await openai.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "You are a professional news summarizer. Provide concise, accurate summaries while maintaining key information. Include key facts, figures, and quotes when relevant. Structure the summary with clear paragraphs."
          },
          {
            role: "user",
            content: `Please summarize the following content:\n\n${contentToSummarize}`
          }
        ],
        model: "gpt-3.5-turbo",
        temperature: 0.7,
        max_tokens: 500,
      });
      summary = completion.choices[0]?.message?.content || 'No summary generated';
    }

    const processingTime = (Date.now() - startTime) / 1000; // Convert to seconds

    // Extract source metadata for URLs
    const sourceMetadata = type === 'url' ? await extractMetadata(url) : null;

    // Calculate AI metrics
    const aiMetrics = {
      confidenceScore: calculateConfidenceScore(completion),
      processingTime,
      wordCount: summary.split(/\s+/).length
    };

    // Store in database
    const savedSummary = await prisma.summary.create({
      data: {
        content: summary,
        inputType: type,
        inputContent: type === 'url' ? url : text,
        sourceMetadata: sourceMetadata ? {
          create: {
            author: sourceMetadata.author,
            publishDate: sourceMetadata.publishDate,
            domain: sourceMetadata.domain,
            isVerified: sourceMetadata.isVerified
          }
        } : undefined,
        aiMetrics: {
          create: {
            confidenceScore: aiMetrics.confidenceScore,
            processingTime: aiMetrics.processingTime,
            wordCount: aiMetrics.wordCount
          }
        }
      },
      include: {
        sourceMetadata: true,
        aiMetrics: true
      }
    });

    return NextResponse.json({
      summary: savedSummary.content,
      sourceMetadata: savedSummary.sourceMetadata,
      aiMetrics: savedSummary.aiMetrics
    });

  } catch (error) {
    console.error('Summarization error:', error);
    return NextResponse.json(
      { error: 'Failed to generate summary' },
      { status: 500 }
    );
  }
} 