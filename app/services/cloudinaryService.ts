import { v2 as cloudinary } from 'cloudinary';

export class CloudinaryService {
  constructor() {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
  }

  async uploadFile(filePath: string): Promise<string> {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        resource_type: 'auto',
        folder: 'ai-news-summaries'
      });
      return result.secure_url;
    } catch (error) {
      console.error('Error uploading to Cloudinary:', error);
      throw new Error('Failed to upload file to Cloudinary');
    }
  }
} 