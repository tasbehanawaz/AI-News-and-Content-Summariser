import { exec } from 'child_process';
import fsPromises from 'fs/promises';
import util from 'util';
import axios from 'axios';
import path from 'path';
import os from 'os';
import { TTSService } from './ttsService';
import { CloudinaryService } from './cloudinaryService';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { v4 as uuidv4 } from 'uuid';

const execPromise = util.promisify(exec);

interface VideoGenerationConfig {
  imageFilePath: string;
  audioFilePath: string;
  outputVideoPath: string;
  duration: number;
}

interface SyncLabsConfig {
  videoPath: string;
  audioPath: string;
}

export class VideoService {
  private ttsService: TTSService;
  private cloudinaryService: CloudinaryService;
  private ttsClient: TextToSpeechClient;

  constructor() {
    this.ttsService = new TTSService();
    this.cloudinaryService = new CloudinaryService();
    this.ttsClient = new TextToSpeechClient();
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
      
      // Generate audio from text
      console.log('Generating speech from text...');
      audioPath = await this.ttsService.generateSpeech(text, voiceType);
      console.log('Speech generated successfully:', audioPath);
      
      // Get audio duration
      const audioDuration = await this.ttsService.getAudioDuration(audioPath);
      console.log('Audio duration:', audioDuration, 'seconds');
      
      // Create temporary video path
      tempVideoPath = path.join(os.tmpdir(), `temp-${Date.now()}.mp4`);
      console.log('Temporary video path:', tempVideoPath);

      // Generate initial video
      await this.generateVideoFromImage({
        imageFilePath: avatarPath,
        audioFilePath: audioPath,
        outputVideoPath: tempVideoPath,
        duration: audioDuration,
      });

      try {
        // Try lip sync
        videoUrl = await this.generateLipSyncVideo({
          videoPath: tempVideoPath,
          audioPath: audioPath,
        });
        usedFallback = false;
      } catch (error) {
        console.log('Lip sync failed, using fallback...', error);
        videoUrl = await this.generateFallbackVideo(tempVideoPath);
        usedFallback = true;
      }

      if (!videoUrl) {
        throw new Error('Failed to generate video: No URL returned');
      }

      return { videoUrl, usedFallback };
    } catch (error) {
      console.error('Error in video generation:', error);
      throw error;
    } finally {
      // Cleanup temporary files
      const filesToCleanup = [audioPath, tempVideoPath].filter(Boolean);
      for (const file of filesToCleanup) {
        try {
          await fsPromises.unlink(file as string);
        } catch (err) {
          console.error(`Error deleting file ${file}:`, err);
        }
      }
    }
  }

  async generateVideoFromImage(config: VideoGenerationConfig): Promise<string> {
    try {
      const ffmpegCommand = `ffmpeg -loop 1 -i "${config.imageFilePath}" -i "${config.audioFilePath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -vf "scale=1920:1080" "${config.outputVideoPath}"`;
      await execPromise(ffmpegCommand);
      return config.outputVideoPath;
    } catch (error) {
      console.error('Error generating video:', error);
      throw new Error('Failed to generate video from image');
    }
  }

  private async generateFallbackVideo(videoPath: string): Promise<string> {
    const enhancedVideoPath = path.join(os.tmpdir(), `enhanced-${Date.now()}.mp4`);
    
    try {
      // Add basic animations
      const ffmpegCommand = `ffmpeg -i "${videoPath}" -vf "fade=in:0:25,fade=out:st=25:d=5,zoompan=z='min(zoom+0.002,1.1)':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',scale=1920:1080" -c:a copy "${enhancedVideoPath}"`;
      
      await execPromise(ffmpegCommand);
      
      // Upload to Cloudinary
      const videoUrl = await this.cloudinaryService.uploadFile(enhancedVideoPath);

      // Cleanup
      await fsPromises.unlink(enhancedVideoPath);
      
      return videoUrl;
    } catch (error) {
      console.error('Error in fallback video:', error);
      throw error;
    }
  }

  async generateBasicVideo(text: string, avatarPath: string, audioPath: string): Promise<string> {
    const outputPath = path.join(process.cwd(), 'public', 'generated', `${uuidv4()}.mp4`);
    
    try {
      // Generate video with basic animation
      const ffmpegCommand = `ffmpeg -loop 1 -i "${avatarPath}" -i "${audioPath}" -c:v libx264 -tune stillimage -c:a aac -b:a 192k -pix_fmt yuv420p -shortest -vf "scale=1920:1080,fade=in:0:30,fade=out:st=25:d=5" "${outputPath}"`;
      
      await execPromise(ffmpegCommand);
      
      return outputPath.replace(process.cwd() + '/public', '');
    } catch (error) {
      console.error('Error in basic video generation:', error);
      throw error;
    }
  }

  async generateLipSyncVideo(config: SyncLabsConfig): Promise<string> {
    try {
      if (!process.env.SYNC_API_KEY) {
        throw new Error('SYNC_API_KEY not set');
      }

      const videoUrl = await this.cloudinaryService.uploadFile(config.videoPath);
      const audioUrl = await this.cloudinaryService.uploadFile(config.audioPath);
      
      const response = await axios.post('https://api.sync.so/v2/generate', 
        {
          model: 'lipsync-2.0.0',
          input: [
            { type: 'video', url: videoUrl },
            { type: 'audio', url: audioUrl }
          ],
          options: {
            output_format: 'mp4',
            sync_mode: 'precise',
            fps: 30,
            output_resolution: [1920, 1080],
            active_speaker: true,
            enhance_quality: true
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.SYNC_API_KEY
          },
          timeout: 300000
        }
      );

      if (!response.data?.id) {
        throw new Error('No job ID in response');
      }

      const jobId = response.data.id;
      let attempts = 0;
      const maxAttempts = 30;
      const pollInterval = 10000;

      while (attempts < maxAttempts) {
        const statusResponse = await axios.get(
          `https://api.sync.so/v2/generate/${jobId}`,
          {
            headers: { 'x-api-key': process.env.SYNC_API_KEY }
          }
        );

        if (statusResponse.data.status === 'COMPLETED' && statusResponse.data.outputUrl) {
          return statusResponse.data.outputUrl;
        }

        if (statusResponse.data.status === 'FAILED') {
          throw new Error(statusResponse.data.error || 'Job failed');
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        attempts++;
      }

      throw new Error('Video processing timed out');
    } catch (error) {
      console.error('Error in lip sync:', error);
      throw error;
    }
  }
} 