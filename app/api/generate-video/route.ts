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
    const { summary } = await fetchAndSummarizeArticle(url);

    // 2. Map avatar selection for HeyGen
    const selectedAvatarId = AVATAR_MAP[avatarId as keyof typeof AVATAR_MAP] || avatarId;

    console.log('Using HeyGen Avatar ID:', selectedAvatarId);
    console.log('Using HeyGen Voice ID:', FIXED_VOICE_ID);

    // 3. Use only the summary as the video script
    const videoScript = summary;

    // 4. Generate the video using HeyGen
    const { videoUrl, usedFallback } = await videoService.generateVideoFromText(
      videoScript,
      selectedAvatarId,
      FIXED_VOICE_ID,
      {
        optimize: true,
        format: 'mp4',
        quality: 'high'
      }
    );

    console.log('Generated video URL:', videoUrl);

    if (!videoUrl) {
      throw new Error('Failed to generate video: No URL returned');
    }

    // 5. Save to database with only summary
    try {
      const videoSummary = await prisma.videoSummary.create({
        data: {
          videoUrl,
          inputType: 'url',
          inputContent: url,
          summary,
          usedFallback,
          updatedAt: new Date()
        },
      });

      return NextResponse.json({
        videoUrl,
        success: true,
        videoSummaryId: videoSummary.id,
        usedFallback,
        summary,
      });
    } catch (dbError) {
      console.error('Error saving to database:', dbError);
      return NextResponse.json({
        videoUrl,
        success: true,
        usedFallback,
        summary,
      });
    }
  } catch (error) {
    console.error('Error in request processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    return NextResponse.json(
      {
        error: errorMessage,
        success: false,
        retryable: errorMessage.includes('high demand') || errorMessage.includes('Model too busy'),
      },
      {
        status: errorMessage.includes('Missing required fields') ? 400 : 500,
      }
    );
  }
}

async function fetchAndSummarizeArticle(url: string): Promise<{ summary: string }> {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 2000; // 2 seconds

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      console.log(`Fetching and summarizing article from URL: ${url} (Attempt ${attempt}/${MAX_RETRIES})`);

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

        if (errorMessage.includes('Model is loading')) {
          if (attempt < MAX_RETRIES) {
            console.log(`Model is loading, waiting ${RETRY_DELAY}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            continue;
          }
          throw new Error('The AI model is still initializing. Please try again in a few moments.');
        }

        // Other error checks remain the same
        if (errorMessage.includes('requires a subscription')) {
          throw new Error(
            'This article is from a paywalled website. Please use an article from a free source like Reuters or AP News.'
          );
        }

        if (response.status === 503 || errorMessage.includes('Model too busy')) {
          throw new Error(
            'Service is currently experiencing high demand. Please try again in a few moments.'
          );
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`Summary generated successfully, length: ${data.summary.length} characters`);
      
      return {
        summary: data.summary
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (attempt === MAX_RETRIES) {
        console.error('Error in fetchAndSummarizeArticle after all retries:', error);
        
        if (errorMessage.includes('Model is loading') || errorMessage.includes('initializing')) {
          throw new Error('The AI service is still initializing. Please try again in a few moments.');
        } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
          throw new Error('Unable to connect to the service. Please check your internet connection and try again.');
        } else {
          throw new Error('Failed to generate summary: ' + errorMessage);
        }
      }
    }
  }

  throw new Error('Failed to generate summary after all retries');
}
