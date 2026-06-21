import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface PersistConfig {
  apiKey: string;
  apiUrl?: string;
}

export interface UploadOptions {
  // Storage Tiers
  isS3?: boolean;
  isIpfs?: boolean;
  isFilecoin?: boolean;
  isArweave?: boolean;

  // Web2 Options
  isS3Private?: boolean;
  s3UrlStyle?: 'random' | 'path';
  isS3Encrypted?: boolean;

  // Web3 Options
  isIpfsDag?: boolean;
  isIpfsUnwrapDir?: boolean;
  isWeb3Encrypted?: boolean;
  
  // NFT Options
  isNftCollection?: boolean;
  nftCollectionName?: string;
  nftDescription?: string;

  // Token Gating Options
  isTokenGated?: boolean;
  accType?: 'nft' | 'token';
  accContractAddress?: string;
  accTokenIdOrBalance?: string;

  // Batching & Folders
  batchId?: string;
  virtualPath?: string;
  metadata?: Record<string, any>;
  
  // Callbacks
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void;
}

export class PersistClient {
  private apiKey: string;
  private apiUrl: string;

  constructor(config: string | PersistConfig) {
    if (typeof config === 'string') {
      this.apiKey = config;
      this.apiUrl = 'https://api.persist.so';
    } else {
      this.apiKey = config.apiKey;
      this.apiUrl = config.apiUrl || 'https://api.persist.so';
    }
  }

  private get headers() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  /**
   * Upload a file to Persist (Handles Multipart for files > 5MB)
   */
  async upload(filePath: string, options: UploadOptions = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const fileName = filePath.split(/[/\\]/).pop() || 'uploaded_file';
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    
    // Convert options to backend format
    const payloadOpts = {
      isS3: options.isS3 ?? true,
      isS3Private: options.isS3Private ?? false,
      isS3Encrypted: options.isS3Encrypted ?? false,
      s3UrlStyle: options.s3UrlStyle || 'random',
      
      isIpfs: options.isIpfs ?? true,
      isIpfsDag: options.isIpfsDag ?? false,
      isIpfsUnwrapDir: options.isIpfsUnwrapDir ?? true,
      isWeb3Encrypted: options.isWeb3Encrypted ?? false,
      
      isNftCollection: options.isNftCollection ?? false,
      nftCollectionName: options.nftCollectionName || '',
      nftDescription: options.nftDescription || '',
      
      isTokenGated: options.isTokenGated ?? false,
      accType: options.accType || '',
      accContractAddress: options.accContractAddress || '',
      accTokenIdOrBalance: options.accTokenIdOrBalance || '',
      
      batchId: options.batchId || null,
      virtualPath: options.virtualPath || '',
      metadata: options.metadata || null,
      
      isFilecoin: options.isFilecoin ?? false,
      isArweave: options.isArweave ?? false,
    };

    let decryptionKey: string | null = null;
    let web3UploadId: string | null = null;

    // 1. Handle Encryption (Fallback to RAM for encrypted files)
    let bufferToUpload: Buffer | null = null;
    if (payloadOpts.isS3Encrypted || payloadOpts.isWeb3Encrypted) {
      if (fileSize > 500 * 1024 * 1024) {
        throw new Error("Client-side encryption is currently limited to files under 500MB to prevent memory crashes.");
      }
      const rawFileBuffer = fs.readFileSync(filePath);
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const encrypted = Buffer.concat([cipher.update(rawFileBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();
      
      bufferToUpload = Buffer.concat([iv, authTag, encrypted]);
      decryptionKey = key.toString('hex');
      console.log(`[Persist SDK] File encrypted. Keep this key safe: ${decryptionKey}`);
    }

    const targetSize = bufferToUpload ? bufferToUpload.length : fileSize;
    const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB MinIO minimum
    let finalUploadId = '';

    // ==========================================
    // 2. MULTIPART UPLOAD LOGIC (For files > 5MB)
    // ==========================================
    if (targetSize > CHUNK_SIZE) {
      // 2a. Start Multipart
      const startRes = await axios.post(`${this.apiUrl}/v1/upload/multipart/start`, { fileName }, { headers: this.headers });
      const { uploadId, key } = startRes.data;
      finalUploadId = key;
      
      const numParts = Math.ceil(targetSize / CHUNK_SIZE);
      const partsArr = Array.from({ length: numParts }, (_, i) => i + 1);

      // 2b. Get Presigned URLs for all parts
      const presignRes = await axios.post(`${this.apiUrl}/v1/upload/multipart/presign`, {
        key, uploadId, parts: partsArr
      }, { headers: this.headers });
      
      const presignedUrls = presignRes.data.presignedUrls;
      const completedParts: { ETag: string, PartNumber: number }[] = [];
      let totalUploaded = 0;

      // 2c. Upload Chunks (Limit concurrency to 4)
      const maxConcurrency = 4;
      for (let i = 0; i < partsArr.length; i += maxConcurrency) {
        const chunkBatch = partsArr.slice(i, i + maxConcurrency);
        const promises = chunkBatch.map(async (partNumber) => {
          const start = (partNumber - 1) * CHUNK_SIZE;
          const end = Math.min(start + CHUNK_SIZE - 1, targetSize - 1);
          
          let chunkData: Buffer | fs.ReadStream;
          if (bufferToUpload) {
            chunkData = bufferToUpload.slice(start, end + 1);
          } else {
            chunkData = fs.createReadStream(filePath, { start, end });
          }

          const url = presignedUrls[partNumber];
          const uploadRes = await axios.put(url, chunkData, {
             headers: { 'Content-Type': 'application/octet-stream' },
             maxBodyLength: Infinity,
             maxContentLength: Infinity
          });
          
          // ETag must be enclosed in quotes per S3 spec
          const etag = uploadRes.headers.etag || uploadRes.headers.eTag;
          completedParts.push({ ETag: etag.replace(/"/g, ''), PartNumber: partNumber });
          
          totalUploaded += (end - start + 1);
          if (options.onProgress) {
             options.onProgress({ loaded: totalUploaded, total: targetSize, percentage: Math.round((totalUploaded / targetSize) * 100) });
          }
        });
        
        await Promise.all(promises);
      }
      
      completedParts.sort((a, b) => a.PartNumber - b.PartNumber);

      // 2d. Complete Multipart
      await axios.post(`${this.apiUrl}/v1/upload/multipart/complete`, {
        key, uploadId, parts: completedParts
      }, { headers: this.headers });

    } else {
      // ==========================================
      // 3. STANDARD UPLOAD LOGIC (For files <= 5MB)
      // ==========================================
      const dualUpload = (payloadOpts.isS3 && !payloadOpts.isS3Encrypted) && (payloadOpts.isIpfs || payloadOpts.isFilecoin || payloadOpts.isArweave) && payloadOpts.isWeb3Encrypted;

      const presignRes = await axios.post(`${this.apiUrl}/v1/upload/presign`, {
        fileName, dualUpload
      }, { headers: this.headers });

      const { presignedUrl, uploadId, web3PresignedUrl, web3UploadId: w3Id } = presignRes.data;
      finalUploadId = uploadId;
      web3UploadId = w3Id;

      if (payloadOpts.isS3) {
        const payload = bufferToUpload || fs.createReadStream(filePath);
        await axios.put(presignedUrl, payload, {
          headers: { 'Content-Type': 'application/octet-stream' },
          maxBodyLength: Infinity, maxContentLength: Infinity
        });
      }

      if (dualUpload && web3PresignedUrl && web3UploadId) {
        await axios.put(web3PresignedUrl, bufferToUpload, {
          headers: { 'Content-Type': 'application/octet-stream' },
          maxBodyLength: Infinity, maxContentLength: Infinity
        });
      }
    }

    // 4. Finalize DB Entry
    const finalizeRes = await axios.post(`${this.apiUrl}/v1/upload/finalize`, {
      uploadId: finalUploadId,
      fileName,
      fileSize: targetSize,
      web3UploadId,
      ...payloadOpts
    }, { headers: this.headers });

    return {
       ...finalizeRes.data,
       decryptionKey: decryptionKey || undefined
    };
  }

  /**
   * Upload an entire local directory to Persist.
   * Auto-generates a batchId and preserves the relative folder structure.
   */
  async uploadDirectory(dirPath: string, options: UploadOptions = {}) {
    if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
      throw new Error(`Directory not found or is not a directory: ${dirPath}`);
    }

    const batchId = Math.random().toString(36).substring(7);
    const filesToUpload: string[] = [];

    const traverse = (currentPath: string) => {
      const items = fs.readdirSync(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        if (fs.statSync(fullPath).isDirectory()) {
          traverse(fullPath);
        } else {
          // Exclude hidden files or metadata sidecars if needed, 
          // but for now we upload everything except .DS_Store
          if (item !== '.DS_Store') {
             filesToUpload.push(fullPath);
          }
        }
      }
    };

    traverse(dirPath);

    console.log(`[Persist SDK] Found ${filesToUpload.length} files in directory. Starting batch upload (Batch ID: ${batchId})...`);

    const results = [];
    const baseDirName = path.basename(dirPath);

    // Limit concurrency to avoid network overload
    const maxConcurrency = 4;
    for (let i = 0; i < filesToUpload.length; i += maxConcurrency) {
      const batch = filesToUpload.slice(i, i + maxConcurrency);
      const promises = batch.map(async (filePath) => {
         // Calculate relative path for IPFS DAG structure
         // e.g. dirPath="my-folder", filePath="my-folder/sub/file.png" -> "my-folder/sub"
         const relativePath = path.relative(dirPath, filePath);
         const virtualPath = path.dirname(path.join(baseDirName, relativePath)).replace(/\\/g, '/');

         const fileOptions: UploadOptions = {
            ...options,
            batchId,
            virtualPath: virtualPath === '.' ? baseDirName : virtualPath
         };

         try {
            const res = await this.upload(filePath, fileOptions);
            return { filePath, success: true, data: res };
         } catch (err: any) {
            console.error(`[Persist SDK] Failed to upload ${filePath}:`, err.message);
            return { filePath, success: false, error: err.message };
         }
      });

      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    return {
      batchId,
      totalFiles: filesToUpload.length,
      successfulUploads: results.filter(r => r.success).length,
      results
    };
  }

  /**
   * List files in your workspace
   */
  async listFiles() {
    const res = await axios.get(`${this.apiUrl}/v1/files`, { headers: this.headers });
    return res.data.files;
  }

  /**
   * Get specific file details (includes S3 download URL if public)
   */
  async getFile(id: string) {
    const res = await axios.get(`${this.apiUrl}/v1/files/${id}`, { headers: this.headers });
    return res.data;
  }

  /**
   * Delete a file
   */
  async deleteFile(id: string) {
    const res = await axios.delete(`${this.apiUrl}/v1/files/${id}`, { headers: this.headers });
    return res.data;
  }

  /**
   * Update file privacy settings
   */
  async updateFile(id: string, updates: { isPrivate: boolean }) {
    const res = await axios.patch(`${this.apiUrl}/v1/files/${id}`, updates, { headers: this.headers });
    return res.data;
  }
}
