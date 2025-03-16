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

export class VideoService {
  constructor() {}

  async generateVideoFromText(
    text: string,
    avatarId: string,
    voiceId: string
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
  
      // Sanitize and truncate the text
      const sanitizedText = config.text
        .replace(/[’‘“”]/g, "'")   // Replace curly quotes with straight quotes
        .slice(0, 200);            // Truncate to 200 characters (adjust if needed)
  
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
              value: '#008000',  // Matches the working curl command
            },
          }],
          dimension: { width: 1280, height: 720 },
        },
        {
          headers: {
            'X-Api-Key': process.env.HEYGEN_API_KEY,
            'Content-Type': 'application/json',
            'User-Agent': 'curl/7.68.0' // add a curl-like User-Agent
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
      const pollInterval = 10000; // 10 seconds
      let attempts = 0;
  
      console.log(`Checking status for video ID: ${videoId}`);
  
      while (attempts < maxAttempts) {
        try {
          const response = await axios.get(
            `https://api.heygen.com/v2/video/status?video_id=${videoId}`,
            {
              headers: { 
                'X-Api-Key': process.env.HEYGEN_API_KEY,
                'Content-Type': 'application/json',
                'User-Agent': 'curl/7.68.0' // Add the same user agent as in generation
              }
            }
          );
  
          console.log(`Status check attempt ${attempts + 1}:`, JSON.stringify(response.data, null, 2));
  
          // Check if v2 api response structure is different
          const status = response.data?.data?.status;
          const videoUrl = response.data?.data?.video_url;
  
          if (status === 'completed' && videoUrl) {
            console.log('Video generation completed successfully');
            return videoUrl;
          }
  
          if (status === 'failed') {
            const errorMessage = response.data?.data?.error || 'Unknown error';
            console.error(`HeyGen video generation failed: ${errorMessage}`);
            throw new Error(`HeyGen video generation failed: ${errorMessage}`);
          }
  
          console.log(`Waiting for HeyGen video generation (attempt ${attempts + 1}/${maxAttempts})...`);
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          attempts++;
        } catch (error) {
          // If we get a specific error we might want to retry with backoff
          console.error(`Error in status check attempt ${attempts + 1}:`, error);
          
          // Add some backoff
          const backoffTime = Math.min(pollInterval * (attempts + 1), 30000);
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
          attempts++;
        }
      }
  
      throw new Error(`HeyGen video processing timed out after ${maxAttempts} attempts`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Axios error checking HeyGen video status:');
        console.error('Error message:', error.message);
        console.error('Status code:', error.response?.status);
        console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
      } else {
        console.error('Error checking HeyGen video status:', error);
      }
      throw error;
    }
  }
  
}
