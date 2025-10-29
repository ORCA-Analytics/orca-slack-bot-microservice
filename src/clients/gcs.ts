import { Storage } from "@google-cloud/storage";
import type { GCSFileInfo } from '@/types/index.js';

export class GCSClient {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    let storageOptions;
    let credentials = null;

    if (process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CLOUD_STORAGE_CREDENTIALS);
        storageOptions = {
          projectId: credentials.project_id,
          credentials: credentials,
        };
        console.log('Using dedicated GCS credentials for project:', credentials.project_id);
      } catch (error) {
        console.warn('GOOGLE_CLOUD_STORAGE_CREDENTIALS is not valid JSON, ignoring:', error);
      }
    }

    if (!credentials && process.env.GOOGLE_CLOUD_CREDENTIALS) {
      try {
        credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
        storageOptions = {
          projectId: credentials.project_id,
          credentials: credentials,
        };
        console.log('Using BigQuery credentials for GCS, project:', credentials.project_id);
      } catch (error) {
        console.warn('GOOGLE_CLOUD_CREDENTIALS is not valid JSON, ignoring:', error);
      }
    }

    if (!credentials) {
      if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        storageOptions = {
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'orcaanalytics',
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        };
        console.log('Using file path for GCS');
      } else {
        storageOptions = {
          projectId: 'orcaanalytics',
          keyFilename: './bigquery-key.json',
        };
        console.log('Using local key file for GCS');
      }
    }
    
    this.storage = new Storage(storageOptions);
    this.bucketName = process.env.GCS_BUCKET_NAME || 'orca-slack-bot';
    console.log('Using GCS bucket:', this.bucketName);
  }

  async uploadImage(
    imageBuffer: Buffer, 
    filename: string = 'table.png', 
    messageId: string | null = null, 
    channelId: string | null = null
  ): Promise<GCSFileInfo | null> {
    try {
      console.log('Starting Google Cloud Storage upload:', {
        filename,
        messageId,
        channelId,
        bufferSize: imageBuffer.length,
        bufferType: typeof imageBuffer,
        isBuffer: Buffer.isBuffer(imageBuffer)
      });

      const bucket = this.storage.bucket(this.bucketName);
      
      const timestamp = Date.now();
      const messageIdPart = messageId ? `msg-${messageId}` : 'msg-unknown';
      const channelIdPart = channelId ? `ch-${channelId}` : 'ch-unknown';
      const sanitizedFilename = filename.replace(/\s+/g, '_');
      const uniqueFilename = `slack-images/${timestamp}_${messageIdPart}_${channelIdPart}_${sanitizedFilename}`;
      const file = bucket.file(uniqueFilename);

      console.log('Uploading to GCS:', {
        bucketName: this.bucketName,
        filename: uniqueFilename
      });

      await file.save(imageBuffer, {
        metadata: {
          contentType: 'image/png',
          cacheControl: 'public, max-age=86400'
        }
      });

      console.log('File uploaded to GCS successfully');

      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${uniqueFilename}`;
      
      console.log('Generated public URL:', {
        publicUrl: publicUrl,
        bucketName: this.bucketName,
        filename: uniqueFilename
      });
      
      const workingUrl = publicUrl;
      
      console.log('GCS upload successful:', {
        filename: uniqueFilename,
        publicUrl: workingUrl,
        size: imageBuffer.length
      });

      return {
        filename: uniqueFilename,
        publicUrl: workingUrl,
        bucketName: this.bucketName
      };
      
    } catch (error) {
      console.error('Error uploading image to GCS:', error);
      return null;
    }
  }

  async saveImageForDebugging(imageBuffer: Buffer, filename: string): Promise<string | null> {
    try {
      const fs = await import("fs");
      const path = await import("path");
      
      const debugPath = path.join('/tmp', `debug_${filename}`);
      fs.writeFileSync(debugPath, imageBuffer);
      console.log(`Debug: Image saved to ${debugPath} for inspection`);
      return debugPath;
    } catch (error) {
      console.warn('Could not save debug image:', error);
      return null;
    }
  }
}
