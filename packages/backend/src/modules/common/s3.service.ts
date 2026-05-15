import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    const forcePathStyle = this.configService.get<string>('AWS_S3_FORCE_PATH_STYLE') === 'true';

    this.s3Client = new S3Client({
      region,
      ...(endpoint && { endpoint }),
      forcePathStyle,
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>('AWS_SECRET_ACCESS_KEY'),
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    } as any);

    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET');
  }

  private buildObjectUrl(key: string): string {
    const endpoint = this.configService.get<string>('AWS_S3_ENDPOINT');
    const bucket = this.bucketName;
    const region = this.configService.get<string>('AWS_REGION');
    if (endpoint) {
      const base = endpoint.replace(/\/$/, '');
      return `${base}/${bucket}/${key}`;
    }
    return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  private sanitizeMetadata(metadata?: Record<string, string>): Record<string, string> | undefined {
    if (!metadata) return undefined;
    const result: Record<string, string> = {};
    for (const [k, v] of Object.entries(metadata)) {
      result[k] = Buffer.from(v, 'utf-8').toString('latin1').replace(/[^\x20-\x7E]/g, '_');
    }
    return result;
  }

  async uploadFile(
    buffer: Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      ContentLength: buffer.length,
      Metadata: this.sanitizeMetadata(metadata),
    });
    await this.s3Client.send(command);
    return this.buildObjectUrl(key);
  }

  async uploadStream(
    stream: Readable | Buffer,
    key: string,
    contentType: string,
    metadata?: Record<string, string>
  ): Promise<string> {
    const body = stream instanceof Buffer ? stream : await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      (stream as Readable).on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      (stream as Readable).on('end', () => resolve(Buffer.concat(chunks)));
      (stream as Readable).on('error', reject);
    });
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: body,
      ContentType: contentType,
      ContentLength: (body as Buffer).length,
      Metadata: this.sanitizeMetadata(metadata),
    });
    await this.s3Client.send(command);
    return this.buildObjectUrl(key);
  }

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn });
  }

  async getFile(key: string): Promise<any> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    return this.s3Client.send(command);
  }

  async deleteFile(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  async fileExists(key: string): Promise<boolean> {
    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  generateKey(userId: string, filename: string, prefix = 'skills'): string {
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${prefix}/${userId}/${timestamp}-${sanitizedFilename}`;
  }

  generateGithubSyncKey(owner: string, repo: string, skillPath: string): string {
    const safeName = skillPath.replace(/\//g, '_');
    return `github-sync/${owner}-${repo}/${safeName}.zip`;
  }
}