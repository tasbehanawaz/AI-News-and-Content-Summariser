import nodemailer from 'nodemailer';
import { prisma } from './prisma.js';
import { Summary } from './summarizer.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface NewsletterSummary {
  title: string;
  content: string;
  source: string;
  author?: string;
  publishedAt?: string;
}

// Configure email transporter with SendGrid settings
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // SendGrid requires TLS
  auth: {
    user: process.env.EMAIL_USER, // 'apikey' for SendGrid
    pass: process.env.EMAIL_PASSWORD, // SendGrid API Key
  },
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  }
});

// Verify transporter configuration on startup
transporter.verify(function (error) {
  if (error) {
    console.error('SendGrid configuration error:', error);
    console.error('Email configuration details:', {
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      user: 'apikey', // Always 'apikey' for SendGrid
      from: process.env.EMAIL_FROM
    });
  } else {
    console.log('SendGrid email service is ready');
  }
});

async function retryOperation<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      console.error(`SendGrid attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError || new Error('SendGrid operation failed after retries');
}

export async function sendEmail(userId: string, content: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  if (!user?.email) {
    throw new Error('User email not found');
  }

  const fromEmail = process.env.EMAIL_FROM;
  if (!fromEmail) {
    throw new Error('Sender email address not configured');
  }

  const mailOptions = {
    from: {
      name: 'AI News Summariser',
      address: fromEmail
    },
    to: user.email,
    subject: 'Your AI News Digest',
    html: content,
    text: content.replace(/<[^>]*>/g, ''),
    headers: {
      'X-SMTPAPI': JSON.stringify({
        category: ['newsletter'],
        unique_args: {
          userId: userId
        }
      }),
      'List-Unsubscribe': `<${process.env.BASE_URL}/preferences>, <mailto:unsubscribe@${fromEmail.split('@')[1]}>`,
      'Precedence': 'bulk',
      'X-Auto-Response-Suppress': 'OOF, AutoReply'
    },
    priority: 'normal' as const
  };

  try {
    await retryOperation(() => transporter.sendMail(mailOptions));
    console.log(`Newsletter sent successfully to ${user.email}`);
  } catch (error) {
    console.error('Failed to send newsletter:', error);
    await prisma.newsletterError.create({
      data: {
        userId,
        error: error instanceof Error ? error.message : 'Unknown SendGrid error',
        timestamp: new Date()
      }
    });
    throw error;
  }
}

// Helper function to format newsletter content
export function formatNewsletterEmail(summaries: Summary[], frequency: 'daily' | 'weekly' = 'daily'): string {
  const date = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="format-detection" content="telephone=no, date=no, address=no">
  <title>Your ${frequency === 'daily' ? 'Daily' : 'Weekly'} AI News Digest</title>
  <style>
    /* Reset styles for email clients */
    body, p, h1, h2, h3, h4, h5, h6, ul, ol, li, div, span, table {
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 100%;
      font: inherit;
      vertical-align: baseline;
    }
    /* Base styles */
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f8f9fa;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      padding: 20px;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header h1 {
      color: #1a73e8;
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .article {
      margin-bottom: 30px;
      padding: 20px;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .article-title {
      color: #1a73e8;
      font-size: 20px;
      font-weight: bold;
      margin-bottom: 10px;
      text-decoration: none;
    }
    .article-meta {
      color: #666;
      font-size: 14px;
      margin-bottom: 10px;
      padding: 5px 0;
      border-bottom: 1px solid #eee;
    }
    .article-content {
      font-size: 16px;
      line-height: 1.8;
      color: #444;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding: 20px;
      background-color: #ffffff;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      color: #666;
      font-size: 14px;
    }
    .footer a {
      color: #1a73e8;
      text-decoration: none;
    }
    .footer a:hover {
      text-decoration: underline;
    }
    /* Dark mode support */
    @media (prefers-color-scheme: dark) {
      body {
        background-color: #1a1a1a;
        color: #e0e0e0;
      }
      .header, .article, .footer {
        background-color: #2d2d2d;
        box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      }
      .article-title {
        color: #4a9eff;
      }
      .article-meta {
        color: #b0b0b0;
        border-bottom-color: #444;
      }
      .article-content {
        color: #d0d0d0;
      }
      .footer a {
        color: #4a9eff;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Your ${frequency === 'daily' ? 'Daily' : 'Weekly'} AI News Digest</h1>
    <p>${date}</p>
  </div>

  ${summaries.map(summary => `
    <div class="article">
      <h2 class="article-title">${summary.title}</h2>
      <div class="article-meta">
        ${summary.author ? `By ${summary.author} • ` : ''}
        ${summary.source} • ${new Date(summary.publishedAt || '').toLocaleDateString()}
      </div>
      <div class="article-content">
        ${summary.content}
      </div>
    </div>
  `).join('')}

  <div class="footer">
    <p>AI News Summariser - Your ${frequency === 'daily' ? 'daily' : 'weekly'} digest of AI news</p>
    <p style="margin: 10px 0;">
      You received this email because you subscribed to our newsletter.
      <br>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/preferences">Update your preferences</a> or 
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/unsubscribe">unsubscribe</a>
    </p>
    <p style="margin-top: 20px; font-size: 12px; color: #888;">
      © ${new Date().getFullYear()} AI News Summariser. All rights reserved.
      <br>
      Our mailing address: ${process.env.COMPANY_ADDRESS || '123 Newsletter St, News City, NC 12345'}
    </p>
  </div>
</body>
</html>
  `.trim();
} 