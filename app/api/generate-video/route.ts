import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/app/services/videoService';
import { prisma } from '@/lib/prisma';

// Initialize VideoService
const videoService = new VideoService();

// Use only Daisy
const AVATAR_MAP = {
  'Daisy-inskirt-20220818': 'Daisy-inskirt-20220818'
};

// Fixed voice ID (the one that worked in your curl command)
const FIXED_VOICE_ID = '2d5b0e6cf36f460aa7fc47e3eee4ba54';

export async function POST(request: NextRequest) {
  try {
    const { url, avatarId } = await request.json();

    if (!url || !avatarId) {
      return NextResponse.json(
        { error: 'URL and avatar are required', success: false },
        { status: 400 }
      );
    }

    // 1. Fetch and summarize the article
    const summary = await fetchAndSummarizeArticle(url);

    // 2. Map avatar selection for HeyGen
    const selectedAvatarId = AVATAR_MAP[avatarId as keyof typeof AVATAR_MAP] || avatarId;

    console.log('Using HeyGen Avatar ID:', selectedAvatarId);
    console.log('Using HeyGen Voice ID:', FIXED_VOICE_ID);

    // 3. Generate the video using HeyGen
    const { videoUrl, usedFallback } = await videoService.generateVideoFromText(
      summary,
      selectedAvatarId,
      FIXED_VOICE_ID
    );

    // 4. Save to database (optional)
    const videoSummary = await prisma.videoSummary.create({
      data: {
        videoUrl,
        inputType: 'url',
        inputContent: url,
        usedFallback,
      },
    });

    return NextResponse.json({
      videoUrl,
      success: true,
      videoSummaryId: videoSummary.id,
      usedFallback,
    });
  } catch (error) {
    console.error('Error in request processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: errorMessage,
        retryable: errorMessage.includes('high demand') || errorMessage.includes('Model too busy'),
      },
      {
        status: errorMessage.includes('Missing required fields') ? 400 : 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

async function fetchAndSummarizeArticle(url: string) {
  try {
    console.log(`Fetching and summarizing article from URL: ${url}`);

    const response = await fetch(`${process.env.BASE_URL}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type: 'url' }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Summarization failed with status: ${response.status}`;

      if (response.status === 503 || errorMessage.includes('Model too busy')) {
        throw new Error(
          'Service is currently experiencing high demand. Please try again in a few moments.'
        );
      }

      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log(`Summary generated successfully, length: ${data.summary.length} characters`);
    return data.summary;
  } catch (error) {
    console.error('Error in fetchAndSummarizeArticle:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (errorMessage.includes('Model too busy') || errorMessage.includes('high demand')) {
      throw new Error(
        'Our AI service is currently experiencing high traffic. Please try again in a few moments.'
      );
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
      throw new Error(
        'Unable to connect to the service. Please check your internet connection and try again.'
      );
    } else {
      throw new Error('Failed to generate summary: ' + errorMessage);
    }
  }
}
