import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, topics, frequency, time, days, notificationMethod, enabled } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Validate required fields
    if (!Array.isArray(topics)) {
      return NextResponse.json({ error: 'Topics must be an array' }, { status: 400 });
    }

    if (!Array.isArray(days)) {
      return NextResponse.json({ error: 'Days must be an array' }, { status: 400 });
    }

    // Create or update preferences
    const preferences = await prisma.newsletterPreferences.upsert({
      where: { userId },
      update: {
        topics,
        frequency: frequency || 'daily',
        time: time || '09:00',
        days,
        notificationMethod: notificationMethod || 'email',
        enabled: enabled ?? true,
      },
      create: {
        userId,
        topics,
        frequency: frequency || 'daily',
        time: time || '09:00',
        days,
        notificationMethod: notificationMethod || 'email',
        enabled: enabled ?? true,
      },
    });

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error saving newsletter preferences:', error);
    return NextResponse.json(
      { error: 'Failed to save newsletter preferences' },
      { status: 500 }
    );
  }
} 