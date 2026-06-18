"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  PersistClient: () => PersistClient
});
module.exports = __toCommonJS(index_exports);
var import_axios = __toESM(require("axios"));
var fs = __toESM(require("fs"));
var crypto = __toESM(require("crypto"));
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
    const presignRes = await import_axios.default.post(`${this.apiUrl}/v1/upload/presign`, {
      fileName,
      dualUpload
    }, { headers: this.headers });
    const { presignedUrl, uploadId, web3PresignedUrl, web3UploadId } = presignRes.data;
    if (s3Enabled) {
      const payload = s3Encrypted ? encryptedBuffer : rawFileBuffer;
      await import_axios.default.put(presignedUrl, payload, {
        headers: { "Content-Type": "application/octet-stream" },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
    }
    if (dualUpload && web3PresignedUrl && web3UploadId) {
      await import_axios.default.put(web3PresignedUrl, encryptedBuffer, {
        headers: { "Content-Type": "application/octet-stream" },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });
    }
    const finalizeRes = await import_axios.default.post(`${this.apiUrl}/v1/upload/finalize`, {
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
    const res = await import_axios.default.get(`${this.apiUrl}/v1/files`, { headers: this.headers });
    return res.data.files;
  }
  /**
   * Get specific file details (includes S3 download URL if public)
   */
  async getFile(id) {
    const res = await import_axios.default.get(`${this.apiUrl}/v1/files/${id}`, { headers: this.headers });
    return res.data;
  }
  /**
   * Delete a file
   */
  async deleteFile(id) {
    const res = await import_axios.default.delete(`${this.apiUrl}/v1/files/${id}`, { headers: this.headers });
    return res.data;
  }
  /**
   * Update file privacy settings
   */
  async updateFile(id, updates) {
    const res = await import_axios.default.patch(`${this.apiUrl}/v1/files/${id}`, updates, { headers: this.headers });
    return res.data;
  }
};
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PersistClient
});
