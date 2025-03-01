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
        error: 'Failed to process request',
        details: errorMessage,
        success: false
      },
      { status: 500 }
    );
  }
}

async function fetchAndSummarizeArticle(url: string): Promise<string> {
  if (!process.env.BASE_URL) {
    throw new Error('BASE_URL environment variable is not set');
  }

  try {
    const response = await fetch(`${process.env.BASE_URL}/api/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, type: 'url' })
    });

    if (!response.ok) {
      throw new Error(`Summarization failed with status: ${response.status}`);
    }

    const data = await response.json();
    return data.summary;
  } catch (error) {
    console.error('Error in fetchAndSummarizeArticle:', error);
    throw new Error('Failed to fetch and summarize article: ' + (error instanceof Error ? error.message : 'Unknown error'));
  }
} 