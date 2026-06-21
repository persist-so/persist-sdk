interface PersistConfig {
    apiKey: string;
    apiUrl?: string;
}
interface UploadOptions {
    isS3?: boolean;
    isIpfs?: boolean;
    isFilecoin?: boolean;
    isArweave?: boolean;
    isS3Private?: boolean;
    s3UrlStyle?: 'random' | 'path';
    isS3Encrypted?: boolean;
    isIpfsDag?: boolean;
    isIpfsUnwrapDir?: boolean;
    isWeb3Encrypted?: boolean;
    isNftCollection?: boolean;
    nftCollectionName?: string;
    nftDescription?: string;
    isTokenGated?: boolean;
    accType?: 'nft' | 'token';
    accContractAddress?: string;
    accTokenIdOrBalance?: string;
    batchId?: string;
    virtualPath?: string;
    metadata?: Record<string, any>;
    onProgress?: (progress: {
        loaded: number;
        total: number;
        percentage: number;
    }) => void;
}
declare class PersistClient {
    private apiKey;
    private apiUrl;
    constructor(config: string | PersistConfig);
    private get headers();
    /**
     * Upload a file to Persist (Handles Multipart for files > 5MB)
     */
    upload(filePath: string, options?: UploadOptions): Promise<any>;
    /**
     * Upload an entire local directory to Persist.
     * Auto-generates a batchId and preserves the relative folder structure.
     */
    uploadDirectory(dirPath: string, options?: UploadOptions): Promise<{
        batchId: string;
        totalFiles: number;
        successfulUploads: number;
        results: ({
            filePath: string;
            success: boolean;
            data: any;
            error?: undefined;
        } | {
            filePath: string;
            success: boolean;
            error: any;
            data?: undefined;
        })[];
    }>;
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
