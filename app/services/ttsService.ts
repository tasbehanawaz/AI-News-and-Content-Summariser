import { TextToSpeechClient, protos } from '@google-cloud/text-to-speech';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import util from 'util';
import { exec as execCb } from 'child_process';

const exec = util.promisify(execCb);

type SynthesizeSpeechRequest = protos.google.cloud.texttospeech.v1.ISynthesizeSpeechRequest;
type SynthesizeSpeechResponse = protos.google.cloud.texttospeech.v1.ISynthesizeSpeechResponse;

// Voice configurations for different languages and genders
const VOICE_CONFIGS = {
  male: {
    name: 'en-US-Neural2-D',
    languageCode: 'en-US',
    ssmlGender: 'MALE' as const,
  },
  female: {
    name: 'en-US-Neural2-F',
    languageCode: 'en-US',
    ssmlGender: 'FEMALE' as const,
  },
};

export class TTSService {
  private client: TextToSpeechClient;

  constructor() {
    console.log('Initializing TTS Service with credentials path:', process.env.GOOGLE_APPLICATION_CREDENTIALS);
    try {
      this.client = new TextToSpeechClient();
      console.log('TTS Client initialized successfully');
    } catch (error) {
      console.error('Error initializing TTS client:', error);
      throw error;
    }
  }

  async generateSpeech(text: string, voiceType: 'male' | 'female'): Promise<string> {
    try {
      console.log('Starting speech generation with voice type:', voiceType);
      const voiceConfig = VOICE_CONFIGS[voiceType];
      console.log('Using voice config:', voiceConfig);

      // Configure the request
      const request: SynthesizeSpeechRequest = {
        input: { text },
        voice: {
          languageCode: voiceConfig.languageCode,
          name: voiceConfig.name,
          ssmlGender: voiceConfig.ssmlGender,
        },
        audioConfig: {
          audioEncoding: 'MP3',
          pitch: 0,
          speakingRate: 1,
        },
      };

      console.log('Sending request to Google TTS...');
      const [response] = await this.client.synthesizeSpeech(request);
      console.log('Received response from Google TTS');

      if (!response.audioContent) {
        throw new Error('No audio content received from Google TTS');
      }

      // Save the audio file temporarily
      const tempDir = os.tmpdir();
      const audioPath = path.join(tempDir, `speech-${Date.now()}.mp3`);
      console.log('Saving audio to:', audioPath);
      await fs.writeFile(audioPath, response.audioContent as Buffer);
      console.log('Audio file saved successfully');

      return audioPath;
    } catch (error) {
      console.error('Detailed error in generateSpeech:', error);
      if (error instanceof Error) {
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw new Error('Failed to generate speech from text');
    }
  }

  async getAudioDuration(audioPath: string): Promise<number> {
    try {
      console.log('Getting duration for audio file:', audioPath);
      // Use ffprobe to get audio duration
      const cmd = `ffprobe -i "${audioPath}" -show_entries format=duration -v quiet -of csv="p=0"`;
      const { stdout } = await exec(cmd);
      
      // Parse duration and return as number of seconds
      const duration = parseFloat(stdout.trim());
      console.log('Audio duration:', duration, 'seconds');
      return isNaN(duration) ? 30 : duration;
    } catch (error) {
      console.error('Error getting audio duration:', error);
      return 30; // Default duration if unable to determine
    }
  }
} 