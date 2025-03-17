import twilio from 'twilio';

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

export async function sendSMS(userId: string, content: string) {
  try {
    // Get user's phone number from database (implement this based on your user model)
    const userPhone = await getUserPhone(userId);
    
    await client.messages.create({
      body: content,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: userPhone,
    });
  } catch (error) {
    console.error('Failed to send SMS:', error);
    throw error;
  }
}

async function getUserPhone(userId: string): Promise<string> {
  // Implement this based on your user model
  // For now, returning a placeholder
  return '+1234567890';
} 