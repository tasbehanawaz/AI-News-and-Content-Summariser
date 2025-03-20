import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Configure email transporter
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function GET() {
  try {
    // Send test email
    const info = await transporter.sendMail({
      from: {
        name: 'AI News Summariser',
        address: process.env.EMAIL_FROM || 'noreply@ainewssummariser.com'
      },
      to: process.env.EMAIL_FROM, // sending to yourself for testing
      subject: 'Test Email from AI News Summariser',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">AI News Summariser</h1>
          <p>This is a test email to verify that the email service is working correctly.</p>
          <p>If you're receiving this, the email configuration is successful!</p>
          <div style="margin-top: 20px; padding: 10px; background-color: #f3f4f6;">
            <p style="margin: 0; color: #4b5563; font-size: 0.875rem;">
              This is an automated test message.
            </p>
          </div>
        </div>
      `,
    });

    console.log('Test email sent successfully:', info.messageId);
    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('Failed to send test email:', error);
    return NextResponse.json(
      { error: 'Failed to send test email' },
      { status: 500 }
    );
  }
} 