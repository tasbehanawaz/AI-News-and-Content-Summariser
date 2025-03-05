import { NextRequest, NextResponse } from 'next/server';
import { VideoService } from '@/app/services/videoService';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { existsSync } from 'fs';

// Initialize VideoService
const videoService = new VideoService();

const AVATAR_PATHS = {
  'male': '/avatars/male.jpg',
  'female': '/avatars/female.jpg'
};

export async function POST(request: NextRequest) {
  try {
    const { url, avatarId, voiceType } = await request.json();

    if (!url || !avatarId || !voiceType) {
      return NextResponse.json(
        { error: 'URL, avatar, and voice type are required', success: false },
        { status: 400 }
      );
    }

    // 1. Fetch and summarize the article
    const summary = await fetchAndSummarizeArticle(url);

    // 2. Get the selected avatar image path
    const avatarRelativePath = AVATAR_PATHS[avatarId as keyof typeof AVATAR_PATHS];
    if (!avatarRelativePath) {
      return NextResponse.json(
        { 
          error: 'Invalid avatar selected',
          details: `Avatar ${avatarId} not found`,
          success: false 
        },
        { status: 400 }
      );
    }

    console.log('Avatar ID:', avatarId);
    console.log('Avatar relative path:', avatarRelativePath);
    
    const avatarPath = path.join(process.cwd(), 'public', avatarRelativePath);
    console.log('Full avatar path:', avatarPath);

    // Verify file exists
    if (!existsSync(avatarPath)) {
      return NextResponse.json(
        { 
          error: 'Avatar file not found',
          details: `File not found at path: ${avatarPath}`,
          success: false 
        },
        { status: 404 }
      );
    }

    // 3. Generate the video with text-to-speech and lip sync
    const { videoUrl, usedFallback } = await videoService.generateVideoFromText(
      summary,
      avatarPath,
      voiceType as 'male' | 'female'
    );

    // 4. Save to database
    const videoSummary = await prisma.videoSummary.create({
      data: {
        videoUrl,
        inputType: 'url',
        inputContent: url,
        usedFallback
      }
    });

    return NextResponse.json({ 
      videoUrl,
      success: true,
      videoSummaryId: videoSummary.id,
      usedFallback
    });

  } catch (error) {
    console.error('Error in request processing:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        retryable: errorMessage.includes('high demand') || errorMessage.includes('Model too busy')
      },
      { 
        status: errorMessage.includes('Missing required fields') ? 400 : 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function fetchAndSummarizeArticle(url: string) {
  try {
    const response = await fetch(`${process.env.BASE_URL}/api/summarize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        url,
        type: 'url'
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Summarization failed with status: ${response.status}`;
      
      if (response.status === 503 || errorMessage.includes('Model too busy')) {
        throw new Error('Service is currently experiencing high demand. Please try again in a few moments.');
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('Error in fetchAndSummarizeArticle:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Provide more user-friendly error messages
    if (errorMessage.includes('Model too busy') || errorMessage.includes('high demand')) {
      throw new Error('Our AI service is currently experiencing high traffic. Please try again in a few moments.');
    } else if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT')) {
      throw new Error('Unable to connect to the service. Please check your internet connection and try again.');
    } else {
      throw new Error('Failed to generate summary: ' + errorMessage);
    }
  }
} 