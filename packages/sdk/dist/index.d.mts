interface PersistConfig {
    apiKey: string;
    apiUrl?: string;
}
interface UploadOptions {
    s3?: {
        enabled?: boolean;
        isPrivate?: boolean;
        encrypted?: boolean;
    };
    web3?: {
        ipfs?: boolean;
        filecoin?: boolean;
        arweave?: boolean;
        encrypted?: boolean;
    };
}
declare class PersistClient {
    private apiKey;
    private apiUrl;
    constructor(config: string | PersistConfig);
    private get headers();
    /**
     * Upload a file to Persist (MinIO -> IPFS via Webhook)
     */
    upload(filePath: string, options?: UploadOptions): Promise<any>;
    /**
     * List files in your workspace
     */
    listFiles(): Promise<any>;
    /**
     * Get specific file details (includes S3 download URL if public)
     */
    getFile(id: string): Promise<any>;
    /**
     * Delete a file
     */
    deleteFile(id: string): Promise<any>;
    /**
     * Update file privacy settings
     */
    updateFile(id: string, updates: {
        isPrivate: boolean;
    }): Promise<any>;
}

export { PersistClient, type PersistConfig, type UploadOptions };
