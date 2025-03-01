import { TTSService } from '../services/ttsService';

async function testTTS() {
  try {
    console.log('Environment variable check:', {
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      exists: !!process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    console.log('Initializing TTS Service...');
    const tts = new TTSService();

    const testText = 'This is a test of the Google Cloud Text-to-Speech service. If you can hear this clearly, the setup is working correctly.';
    
    console.log('Generating male voice...');
    const maleAudioPath = await tts.generateSpeech(testText, 'male');
    console.log('Male audio generated at:', maleAudioPath);
    
    console.log('Getting audio duration...');
    const duration = await tts.getAudioDuration(maleAudioPath);
    console.log('Audio duration:', duration, 'seconds');

    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Test failed with detailed error:', error);
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run the test
testTTS(); 