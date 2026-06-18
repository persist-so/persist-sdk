import React, { useState, useEffect } from 'react';
import { BrowserProvider } from 'ethers';

declare global {
  interface Window {
    ethereum?: any;
  }
}


/**
 * Decrypts a blob using standard Web Crypto API (AES-GCM)
 */
export async function decryptBlob(ciphertextBlob: Blob, rawAESKeyBase64: string): Promise<Blob> {
  const rawKeyBytes = Uint8Array.from(atob(rawAESKeyBase64), c => c.charCodeAt(0));
  const cryptoKey = await window.crypto.subtle.importKey(
    'raw',
    rawKeyBytes,
    'AES-GCM',
    true,
    ['decrypt']
  );

  const arrayBuffer = await ciphertextBlob.arrayBuffer();
  // Standard format: [12 bytes IV] + [Ciphertext]
  const iv = arrayBuffer.slice(0, 12);
  const data = arrayBuffer.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  );

  return new Blob([decryptedBuffer]);
}

export type TokenGatedStatus = 'locked' | 'connecting' | 'decrypting' | 'unlocked';

export interface TokenGatedOptions {
  apiUrl?: string;
}

/**
 * Headless hook to manage the Token Gating decryption flow
 */
export function useTokenGatedFile(cid: string, options: TokenGatedOptions = {}) {
  const apiUrl = options.apiUrl || "https://api.persist.so";
  const [status, setStatus] = useState<TokenGatedStatus>('locked');
  const [error, setError] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  const handleUnlock = async () => {
    try {
      setStatus('connecting');
      setError(null);

      if (!window.ethereum) {
        throw new Error("No Web3 wallet installed.");
      }
      
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      setStatus('decrypting');

      // Fetch encrypted bytes
      const urlRes = await fetch(`${apiUrl}/generateDownloadUrl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { uploadId: cid } })
      });
      const urlData = await urlRes.json();
      if (urlData.error) throw new Error(urlData.error.message || "Failed to get download URL");

      const blobRes = await fetch(urlData.result.presignedUrl);
      const ciphertextBlob = await blobRes.blob();

      // Sign SIWE Message
      const message = `Sign this message to decrypt the file via Persist KMS.\n\nFile: ${cid}\nAddress: ${address}\nTimestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);

      // Retrieve AES Key from KMS
      const kmsRes = await fetch(`${apiUrl}/retrieveKmsKey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: { cid, siweMessage: message, signature }
        })
      });
      
      const kmsData = await kmsRes.json();
      if (kmsData.error) throw new Error(kmsData.error.message || "Failed to retrieve KMS Key. Access Denied.");

      // Decrypt locally
      const decryptedBlob = await decryptBlob(ciphertextBlob, kmsData.result.rawAESKeyBase64);
      const objUrl = URL.createObjectURL(decryptedBlob);
      
      setFileUrl(objUrl);
      setStatus('unlocked');

    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unknown error occurred.");
      setStatus('locked');
    }
  };

  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);

  return { status, error, fileUrl, unlock: handleUnlock };
}

// ==============================================
// HIGHER ORDER COMPONENTS
// ==============================================

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
export function TokenGatedFile({ cid, className, fileName, mimeType }: TokenGatedFileProps) {
  const { status, error, fileUrl, unlock } = useTokenGatedFile(cid);

  if (status === 'unlocked' && fileUrl) {
    const isImage = mimeType?.startsWith('image/') || fileName?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
    const isVideo = mimeType?.startsWith('video/') || fileName?.match(/\.(mp4|webm|ogg)$/i);

    if (isImage) {
      return <img src={fileUrl} alt={fileName || "Decrypted Image"} className={className} />;
    }

    if (isVideo) {
      return (
        <video src={fileUrl} controls className={className}>
          Your browser does not support the video tag.
        </video>
      );
    }

    return (
      <div className={`flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg border border-gray-200 ${className || ''}`}>
        <svg className="w-12 h-12 text-gray-500 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <p className="text-gray-800 font-medium mb-4">{fileName || "Decrypted File"}</p>
        <a 
          href={fileUrl} 
          download={fileName || "download"}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded shadow transition-colors"
        >
          Download File
        </a>
      </div>
    );
  }

  return (
    <div className={`relative flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 overflow-hidden min-h-[300px] ${className || ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-3xl"></div>
      <div className="relative z-10 flex flex-col items-center p-6 text-center">
        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        
        <h3 className="text-white font-bold text-lg mb-2">Protected Asset</h3>
        <p className="text-gray-400 text-sm mb-6 max-w-xs">Connect your wallet to verify permissions and unlock this asset.</p>
        
        {error && (
          <div className="text-red-400 text-sm mb-4 max-w-xs bg-red-400/10 p-2 rounded-lg border border-red-400/20">
            {error}
          </div>
        )}

        <button
          onClick={unlock}
          disabled={status !== 'locked'}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === 'locked' && 'Unlock via KMS'}
          {status === 'connecting' && 'Connecting...'}
          {status === 'decrypting' && 'Decrypting...'}
        </button>
      </div>
    </div>
  );
}

/**
 * Backward compatibility alias for images specifically
 */
export const PersistGatedImage = TokenGatedFile;
