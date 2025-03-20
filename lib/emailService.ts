import nodemailer from 'nodemailer';
import { prisma } from './prisma.js';
import { Summary } from './summarizer.js';

interface NewsletterSummary {
  title: string;
  content: string;
  source: string;
  author?: string;
  publishedAt?: string;
}

// Configure email transporter with improved settings
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
  // Add DKIM support if configured
  ...(process.env.DKIM_PRIVATE_KEY && {
    dkim: {
      domainName: process.env.EMAIL_DOMAIN || '',
      keySelector: 'default',
      privateKey: process.env.DKIM_PRIVATE_KEY,
    }
  }),
  // Improve TLS settings
  tls: {
    rejectUnauthorized: true,
    minVersion: 'TLSv1.2'
  },
  // Add pool configuration to manage connections
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
  rateDelta: 1000,
  rateLimit: 5,
});

// Verify transporter configuration
transporter.verify(function (error) {
  if (error) {
    console.error('Email service configuration error:', error);
  } else {
    console.log('Email service is ready to send messages');
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
      console.warn(`Attempt ${attempt} failed:`, error);
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay * attempt));
      }
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

export async function sendEmail(userId: string, content: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true }
  });

  if (!user?.email) {
    throw new Error('User email not found');
  }

  const mailOptions = {
    from: {
      name: process.env.EMAIL_FROM_NAME || 'AI News Summariser',
      address: process.env.EMAIL_FROM || 'noreply@ainewssummariser.com'
    },
    to: user.email,
    subject: 'Your AI News Digest',
    html: content,
    // Add headers to improve deliverability
    headers: {
      'List-Unsubscribe': `<${process.env.NEXT_PUBLIC_APP_URL}/preferences>, <mailto:unsubscribe@${process.env.EMAIL_DOMAIN}>`,
      'Precedence': 'bulk',
      'X-Auto-Response-Suppress': 'OOF, AutoReply',
      'X-Report-Abuse': `Please report abuse here: ${process.env.NEXT_PUBLIC_APP_URL}/report-abuse`,
      'X-Mailer': 'AI News Summariser Newsletter Service'
    },
    // Add text version for better deliverability
    text: content.replace(/<[^>]*>/g, ''), // Strip HTML tags for text version
    // Add message priority
    priority: 'normal',
    // Add category for better filtering
    category: 'newsletter',
  };

  await transporter.sendMail(mailOptions);
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