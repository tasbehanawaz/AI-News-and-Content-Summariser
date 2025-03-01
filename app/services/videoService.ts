import { exec } from 'child_process';
import fs from 'fs/promises';
import util from 'util';
import axios from 'axios';
import path from 'path';
import os from 'os';
import { TTSService } from './ttsService';
import { CloudinaryService } from './cloudinaryService';

const execPromise = util.promisify(exec);

interface VideoGenerationConfig {
  imageFilePath: string;
  audioFilePath: string;
  outputVideoPath: string;
  duration: number; // in seconds
}

interface SyncLabsConfig {
  videoPath: string;
  audioPath: string;
}

export class VideoService {
  private ttsService: TTSService;
  private cloudinaryService: CloudinaryService;

  constructor() {
    this.ttsService = new TTSService();
    this.cloudinaryService = new CloudinaryService();
  }

  async generateVideoFromText(
    text: string,
    avatarPath: string,
    voiceType: 'male' | 'female'
  ): Promise<{ videoUrl: string; usedFallback: boolean }> {
    let audioPath: string | null = null;
    let tempVideoPath: string | null = null;
    let videoUrl: string | null = null;
    let usedFallback = false;

    try {
      console.log('Starting video generation process...');
      
      // 1. Generate audio from text
      console.log('Generating speech from text...');
      audioPath = await this.ttsService.generateSpeech(text, voiceType);
      console.log('Speech generated successfully:', audioPath);
      
      // 2. Get audio duration
      console.log('Getting audio duration...');
      const audioDuration = await this.ttsService.getAudioDuration(audioPath);
      console.log('Audio duration:', audioDuration, 'seconds');
      
      // 3. Create temporary video path
      tempVideoPath = path.join(os.tmpdir(), `temp-${Date.now()}.mp4`);
      console.log('Temporary video path:', tempVideoPath);

      // 4. Generate initial video from avatar image
      console.log('Generating initial video from image...');
      await this.generateVideoFromImage({
        imageFilePath: avatarPath,
        audioFilePath: audioPath,
        outputVideoPath: tempVideoPath,
        duration: audioDuration,
      });
      console.log('Initial video generated successfully');

      try {
        // 5. Try to generate lip-synced video
        console.log('Attempting to generate lip-synced video...');
        videoUrl = await this.generateLipSyncVideo({
          videoPath: tempVideoPath,
          audioPath: audioPath,
        });
        console.log('Lip-sync video generated successfully');
        usedFallback = false;
      } catch (lipSyncError) {
        console.log('Lip sync failed, falling back to basic video generation...', lipSyncError);
        // If lip sync fails, fall back to the basic video
        videoUrl = await this.generateFallbackVideo(tempVideoPath);
        console.log('Fallback video generated successfully');
        usedFallback = true;
      }

      if (!videoUrl) {
        throw new Error('Failed to generate video: No URL returned');
      }

      return { videoUrl, usedFallback };
    } catch (error) {
      console.error('Error in video generation process:', error);
      throw new Error(`Failed to generate video from text: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      // Cleanup temporary files
      console.log('Cleaning up temporary files...');
      const filesToCleanup = [audioPath, tempVideoPath].filter(Boolean);
      
      for (const file of filesToCleanup) {
        try {
          await fs.unlink(file as string);
          console.log(`Successfully deleted: ${file}`);
        } catch (err) {
          console.error(`Error deleting file ${file}:`, err);
        }
      }
      console.log('Cleanup completed');
    }
  }

  async generateVideoFromImage(config: VideoGenerationConfig): Promise<string> {
    try {
      // FFmpeg command to create video from image with proper settings
      const ffmpegCommand = `ffmpeg -loop 1 -i "${config.imageFilePath}" -i "${config.audioFilePath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -vf "scale=1920:1080" "${config.outputVideoPath}"`;
      
      await execPromise(ffmpegCommand);
      return config.outputVideoPath;
    } catch (error) {
      console.error('Error generating video:', error);
      throw new Error('Failed to generate video from image');
    }
  }

  async generateLipSyncVideo(config: SyncLabsConfig): Promise<string> {
    try {
      if (!process.env.SYNC_API_KEY) {
        throw new Error('SYNC_API_KEY environment variable is not set');
      }

      console.log('Uploading files to Cloudinary...');
      const videoUrl = await this.cloudinaryService.uploadFile(config.videoPath);
      const audioUrl = await this.cloudinaryService.uploadFile(config.audioPath);
      console.log('Files uploaded successfully');
      
      const requestData = {
        model: 'lipsync-1.9.0-beta',
        input: [
          {
            type: 'video',
            url: videoUrl
          },
          {
            type: 'audio',
            url: audioUrl
          }
        ],
        options: {
          output_format: 'mp4',
          sync_mode: 'bounce',
          fps: 25,
          output_resolution: [854, 480],
          active_speaker: true
        }
      };

      console.log('Making request to Sync Labs API...');
      console.log('API Key:', process.env.SYNC_API_KEY ? 'Present' : 'Missing');
      console.log('API Key length:', process.env.SYNC_API_KEY?.length);
      console.log('API Key first 10 chars:', process.env.SYNC_API_KEY?.substring(0, 10));
      console.log('Environment variables loaded from:', process.env.NODE_ENV);
      console.log('Request data:', JSON.stringify(requestData, null, 2));

      // Make initial API request to SyncLabs
      const apiKey = process.env.SYNC_API_KEY?.trim();
      console.log('Using API key starting with:', apiKey?.substring(0, 10));
      
      const response = await axios.post('https://api.sync.so/v2/generate', requestData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey
        },
        timeout: 300000 // 5 minutes timeout
      });

      console.log('Sync Labs API Response:', response.status);
      console.log('Response data:', response.data);

      if (!response.data?.id) {
        throw new Error('No job ID in SyncLabs response: ' + JSON.stringify(response.data));
      }

      const jobId = response.data.id;
      console.log('Job ID:', jobId);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 30; // 5 minutes total (10 second intervals)
      const pollInterval = 10000; // 10 seconds

      while (attempts < maxAttempts) {
        console.log(`Polling attempt ${attempts + 1}/${maxAttempts}...`);
        
        const statusResponse = await axios.get(`https://api.sync.so/v2/generate/${jobId}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey
          }
        });

        console.log('Status:', statusResponse.data.status);

        if (statusResponse.data.status === 'COMPLETED' && statusResponse.data.outputUrl) {
          console.log('Video processing completed!');
          return statusResponse.data.outputUrl;
        }

        if (statusResponse.data.status === 'FAILED') {
          throw new Error(`Job failed: ${statusResponse.data.error || 'Unknown error'}`);
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      }

      throw new Error('Video processing timed out after 5 minutes');
    } catch (error) {
      console.error('Error in lip sync process:', error);
      if (axios.isAxiosError(error)) {
        console.error('Axios error details:', {
          status: error.response?.status,
          data: error.response?.data,
          headers: error.response?.headers
        });
      }
      throw new Error(`Failed to generate lip sync video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async generateFallbackVideo(videoPath: string): Promise<string> {
    const enhancedVideoPath = path.join(os.tmpdir(), `enhanced-${Date.now()}.mp4`);
    
    try {
      // Add fade in/out effects and slight zoom with simpler animation
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vf "fade=in:0:25,fade=out:st=25:d=5,zoompan=z='min(zoom+0.002,1.1)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',scale=1920:1080" -c:a copy "${enhancedVideoPath}"`;
      
      await execPromise(ffmpegCommand);
      console.log('Enhanced video generated successfully');
      
      // Upload the enhanced video to Cloudinary
      const videoUrl = await this.cloudinaryService.uploadFile(enhancedVideoPath);
      console.log('Enhanced video uploaded successfully');

      // Cleanup enhanced video file
      try {
        await fs.unlink(enhancedVideoPath);
        console.log('Enhanced video file cleaned up');
      } catch (err) {
        console.error('Error cleaning up enhanced video:', err);
      }
      
      return videoUrl;
    } catch (error) {
      console.error('Error generating fallback video:', error);
      throw new Error(`Failed to generate fallback video: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Additional utility functions can be added here
  /*
  async transcribeAudio(audioFilePath: string): Promise<string> {
    // Implement audio transcription logic here
    // You can use services like Whisper API or other transcription services
    throw new Error('Audio transcription not implemented yet');
  }
  */
} 