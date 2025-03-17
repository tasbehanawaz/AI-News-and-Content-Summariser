import nodemailer from 'nodemailer';

// Configure email transporter
const transporter = nodemailer.createTransport({
  // Add your email service configuration here
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export async function sendEmail(userId: string, content: string) {
  try {
    // Get user's email from database (implement this based on your user model)
    const userEmail = await getUserEmail(userId);
    
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: userEmail,
      subject: 'Your AI News Digest',
      html: content,
    });
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

async function getUserEmail(userId: string): Promise<string> {
  // Implement this based on your user model
  // For now, returning a placeholder
  return 'user@example.com';
} 