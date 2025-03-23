/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { exec } from 'child_process';
import fs from 'fs/promises';
import util from 'util';
import axios from 'axios';
import path from 'path';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const execPromise = util.promisify(exec);

interface HeyGenConfig {
  text: string;
  avatarId: string;
  voiceId: string;
}

interface VideoGenerationOptions {
  optimize?: boolean;
  format?: string;
  quality?: string;
}

export class VideoService {
  constructor() { }

  async generateVideoFromText(
    text: string,
    avatarId: string,
    voiceId: string,
    options?: VideoGenerationOptions
  ): Promise<{ videoUrl: string; usedFallback: boolean }> {
    let videoUrl: string | null = null;
    let usedFallback = false;

    try {
      console.log('Generating video using HeyGen API...');
      console.log(`Using avatarId: ${avatarId}, voiceId: ${voiceId}`);

      videoUrl = await this.generateHeyGenVideo({
        text,
        avatarId,
        voiceId,
      });

      if (!videoUrl) {
        throw new Error('Failed to generate video: No URL returned');
      }

      return { videoUrl, usedFallback };
    } catch (error) {
      console.error('Error in video generation:', error);
      throw error;
    }
  }

  async generateHeyGenVideo(config: HeyGenConfig): Promise<string> {
    try {
      if (!process.env.HEYGEN_API_KEY) {
        throw new Error('HEYGEN_API_KEY not set');
      }
      console.log('HEYGEN_API_KEY is set:', !!process.env.HEYGEN_API_KEY);

      // Extensive text cleanup and sanitation
      let sanitizedText = config.text
        .replace(/[''""]/g, "'")   // Replace curly quotes with straight quotes
        .replace(/\s+/g, ' ')      // Normalize spacing
        .replace(/[^\x20-\x7E\n]/g, '') // Remove non-printable characters
        .trim();

      // Check if the text is garbled (many long words without vowels)
      const words = sanitizedText.split(/\s+/);
      const garbledWordCount = words.filter(word => 
        word.length > 7 && !/[aeiou]/i.test(word)
      ).length;
      const garbledRatio = garbledWordCount / words.length;
      
      if (garbledRatio > 0.1 || sanitizedText.length < 20) {
        console.log('Detected garbled or invalid text, using fallback text');
        sanitizedText = "This article discusses the latest news and developments. Please read the full article for more details.";
      }
      
      // Ensure text isn't too long for the API
      sanitizedText = sanitizedText.slice(0, 1000);
      
      // Format text into proper sentences if needed
      if (!/[.!?]\s+[A-Z]/.test(sanitizedText) && sanitizedText.length > 100) {
        // Try to create sentences from the text
        let formattedText = '';
        let currentSentence = '';
        let wordCount = 0;
        
        for (const word of sanitizedText.split(/\s+/)) {
          currentSentence += (wordCount === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : ' ' + word);
          wordCount++;
          
          if (wordCount >= 10 || word.endsWith(',')) {
            formattedText += currentSentence + '. ';
            currentSentence = '';
            wordCount = 0;
          }
        }
        
        if (currentSentence) {
          formattedText += currentSentence + '.';
        }
        
        sanitizedText = formattedText.trim();
      }

      console.log('Sanitized text:', sanitizedText);

      console.log('Making HeyGen API request with config:', JSON.stringify({
        text: sanitizedText,
        avatarId: config.avatarId,
        voiceId: config.voiceId,
      }));

      const response = await axios.post(
        'https://api.heygen.com/v2/video/generate',
        {
          video_inputs: [{
            character: {
              type: 'avatar',
              avatar_id: config.avatarId,
              avatar_style: 'normal',
            },
            voice: {
              type: 'text',
              input_text: sanitizedText,
              voice_id: config.voiceId,
            },
            background: {
              type: 'color',
              value: '#008000',
            },
          }],
          dimension: { width: 1280, height: 720 },
          test_mode: false,
          enhance: true,
        },
        {
          headers: {
            'X-Api-Key': process.env.HEYGEN_API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'curl/7.68.0'
          },
          timeout: 300000,
        }
      );

      console.log('HeyGen API response:', JSON.stringify(response.data, null, 2));

      if (!response.data?.data?.video_id) {
        console.error('Invalid API response:', JSON.stringify(response.data, null, 2));
        throw new Error('No video ID in response. Possible issue with API request.');
      }

      return await this.checkHeyGenVideoStatus(response.data.data.video_id);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error in HeyGen video generation:');
        console.error('Error message:', error.message);
        console.error('Status code:', error.response?.status);
        console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
        console.error('Request config:', JSON.stringify(error.config, null, 2));
      } else {
        console.error('Error in HeyGen video generation:', error);
      }
      throw error;
    }
  }

  async checkHeyGenVideoStatus(videoId: string): Promise<string> {
    try {
      if (!process.env.HEYGEN_API_KEY) {
        throw new Error('HEYGEN_API_KEY not set');
      }

      const maxAttempts = 30;
      const pollInterval = 30000; // 20 seconds
      let attempts = 0;

      console.log(`Checking status for video ID: ${videoId}`);

      // Initial delay before first status check
      console.log('Waiting 30 seconds before first status check...');
      await new Promise((resolve) => setTimeout(resolve, 30000));

      while (attempts < maxAttempts) {
        try {
          // Ensure video ID is properly formatted
          const encodedVideoId = encodeURIComponent(videoId.trim());

          console.log(`Making status check request for video ID: ${encodedVideoId} (attempt ${attempts + 1}/${maxAttempts})`);

          const response = await axios.get(
            `https://api.heygen.com/v1/video_status.get?video_id=${encodedVideoId}`,
            {
              headers: {
                'X-Api-Key': process.env.HEYGEN_API_KEY,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'curl/7.68.0'
              }
            }
          );

          console.log(`Status check attempt ${attempts + 1} response:`, JSON.stringify(response.data, null, 2));

          // Check response structure according to v1 API
          if (response.data?.code === 100) {
            const status = response.data?.data?.status;
            const videoUrl = response.data?.data?.video_url;
            const error = response.data?.data?.error;

            if (status === 'completed' && videoUrl) {
              // Verify the video URL is accessible
              try {
                const videoCheck = await axios.head(videoUrl);
                if (videoCheck.status === 200) {
                  console.log('Video URL is accessible');
                  return videoUrl;
                }
              } catch (videoCheckError) {
                console.error('Video URL check failed:', videoCheckError);
              }
            }

            if (status === 'failed') {
              const errorMessage = error?.detail || error?.message || 'Unknown error';
              console.error(`HeyGen video generation failed: ${errorMessage}`);
              throw new Error(`HeyGen video generation failed: ${errorMessage}`);
            }

            console.log(`Video still processing (status: ${status}). Waiting for next check (attempt ${attempts + 1}/${maxAttempts})...`);
          } else {
            console.log(`Unexpected response code: ${response.data?.code}. Waiting for next check...`);
          }

          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          attempts++;
        } catch (error) {
          if (axios.isAxiosError(error)) {
            console.error(`Error in status check attempt ${attempts + 1}:`, error.message);
            console.error('Status code:', error.response?.status);
            console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
          } else {
            console.error(`Non-Axios error in status check:`, error);
          }

          // Implement exponential backoff with jitter
          const baseDelay = Math.min(pollInterval * (attempts + 1), 60000);
          const jitter = Math.floor(Math.random() * 5000);
          const backoffTime = baseDelay + jitter;

          console.log(`Retrying after ${backoffTime}ms (attempt ${attempts + 1}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
          attempts++;
        }
      }

      throw new Error(`HeyGen video processing timed out after ${maxAttempts} attempts. The video might still be processing - check your HeyGen account dashboard.`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error in status check function:');
        console.error('Error message:', error.message);
        console.error('Status code:', error.response?.status);
        console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
      } else {
        console.error('Error in status check function:', error);
      }
      throw error;
    }
  }
}
