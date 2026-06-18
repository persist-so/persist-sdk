import React from 'react';

declare global {
    interface Window {
        ethereum?: any;
    }
}
/**
 * Decrypts a blob using standard Web Crypto API (AES-GCM)
 */
declare function decryptBlob(ciphertextBlob: Blob, rawAESKeyBase64: string): Promise<Blob>;
type TokenGatedStatus = 'locked' | 'connecting' | 'decrypting' | 'unlocked';
/**
 * Headless hook to manage the Token Gating decryption flow
 */
declare function useTokenGatedFile(cid: string): {
    status: TokenGatedStatus;
    error: string | null;
    fileUrl: string | null;
    unlock: () => Promise<void>;
};
interface TokenGatedFileProps {
    cid: string;
    className?: string;
    fileName?: string;
    mimeType?: string;
}
/**
 * Generic Token Gated Component that handles ANY file type.
 * Renders an Image/Video inline if possible, otherwise provides a Download button.
 */
declare function TokenGatedFile({ cid, className, fileName, mimeType }: TokenGatedFileProps): React.JSX.Element;
/**
 * Backward compatibility alias for images specifically
 */
declare const PersistGatedImage: typeof TokenGatedFile;

export { PersistGatedImage, TokenGatedFile, type TokenGatedStatus, decryptBlob, useTokenGatedFile };
