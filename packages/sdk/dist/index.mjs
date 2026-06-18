// src/index.ts
import axios from "axios";
import * as fs from "fs";
import * as crypto from "crypto";
var PersistClient = class {
  constructor(config) {
    if (typeof config === "string") {
      this.apiKey = config;
      this.apiUrl = "https://api.persist.so";
    } else {
      this.apiKey = config.apiKey;
      this.apiUrl = config.apiUrl || "https://api.persist.so";
    }
  }
  get headers() {
    return {
      "Authorization": `Bearer ${this.apiKey}`,
      "Content-Type": "application/json"
    };
  }
  /**
   * Upload a file to Persist (MinIO -> IPFS via Webhook)
   */
  async upload(filePath, options = {}) {
    const s3Enabled = options.s3?.enabled ?? true;
    const s3Private = options.s3?.isPrivate ?? true;
    const s3Encrypted = options.s3?.encrypted ?? false;
    const ipfsEnabled = options.web3?.ipfs ?? true;
    const filecoinEnabled = options.web3?.filecoin ?? false;
    const arweaveEnabled = options.web3?.arweave ?? false;
    const web3Encrypted = options.web3?.encrypted ?? false;
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const fileName = filePath.split(/[/\\]/).pop() || "uploaded_file";
    const stat = fs.statSync(filePath);
    const rawFileBuffer = fs.readFileSync(filePath);
    let encryptedBuffer = null;
    let decryptionKey = null;
    if (s3Encrypted || web3Encrypted) {
      const key = crypto.randomBytes(32);
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([cipher.update(rawFileBuffer), cipher.final()]);
      const authTag = cipher.getAuthTag();
      encryptedBuffer = Buffer.concat([iv, authTag, encrypted]);
      decryptionKey = key.toString("hex");
      console.log(`[Persist SDK] File encrypted locally. Keep this key safe: ${decryptionKey}`);
    }
    const dualUpload = s3Enabled && !s3Encrypted && (ipfsEnabled || filecoinEnabled || arweaveEnabled) && web3Encrypted;
    const presignRes = await axios.post(`${this.apiUrl}/v1/upload/presign`, {
      fileName,
      dualUpload
    }, { headers: this.headers });
    const { presignedUrl, uploadId, web3PresignedUrl, web3UploadId } = presignRes.data;
    if (s3Enabled) {
      const payload = s3Encrypted ? encryptedBuffer : rawFileBuffer;
      await axios.put(presignedUrl, payload, {
        headers: { "Content-Type": "application/octet-stream" },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
    }
    if (dualUpload && web3PresignedUrl && web3UploadId) {
      await axios.put(web3PresignedUrl, encryptedBuffer, {
        headers: { "Content-Type": "application/octet-stream" },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
    }
    const finalizeRes = await axios.post(`${this.apiUrl}/v1/upload/finalize`, {
      uploadId,
      fileName,
      fileSize: stat.size,
      isS3: s3Enabled,
      isS3Private: s3Private,
      isS3Encrypted: s3Encrypted,
      isIpfs: ipfsEnabled,
      isFilecoin: filecoinEnabled,
      isArweave: arweaveEnabled,
      isWeb3Encrypted: web3Encrypted,
      web3UploadId: dualUpload && web3UploadId ? web3UploadId : null
    }, { headers: this.headers });
    return {
      ...finalizeRes.data,
      decryptionKey: decryptionKey || void 0
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
  async getFile(id) {
    const res = await axios.get(`${this.apiUrl}/v1/files/${id}`, { headers: this.headers });
    return res.data;
  }
  /**
   * Delete a file
   */
  async deleteFile(id) {
    const res = await axios.delete(`${this.apiUrl}/v1/files/${id}`, { headers: this.headers });
    return res.data;
  }
  /**
   * Update file privacy settings
   */
  async updateFile(id, updates) {
    const res = await axios.patch(`${this.apiUrl}/v1/files/${id}`, updates, { headers: this.headers });
    return res.data;
  }
};
export {
  PersistClient
};
