import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, topics, frequency, time, days, notificationMethod, enabled } = body;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const preferences = await prisma.newsletterPreferences.upsert({
      where: { userId },
      update: {
        topics,
        frequency,
        time,
        days,
        notificationMethod,
        enabled,
      },
      create: {
        userId,
        topics,
        frequency,
        time,
        days,
        notificationMethod,
        enabled,
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