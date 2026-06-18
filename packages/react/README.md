# @persist-so-npm/react

The official React SDK for Persist Storage. This package provides drop-in hooks for seamlessly integrating Token Gated Web3 encryption into your React applications.

## Installation

```bash
npm install @persist-so-npm/react ethers
```
*(Note: `ethers` is required as a peer dependency for wallet signing).*

## Usage

### Decrypting Token-Gated Files

The `useTokenGatedFile` hook manages the complex flow of prompting the user for a wallet signature via MetaMask/Phantom, authenticating with the Persist KMS, and decrypting the file directly in the browser's memory using the Web Crypto API.

```tsx
import React from 'react';
import { useTokenGatedFile } from '@persist-so-npm/react';

export function TokenGatedViewer({ cid }) {
  const { status, error, fileUrl, handleUnlock } = useTokenGatedFile(cid);

  if (status === 'unlocked' && fileUrl) {
    return <img src={fileUrl} alt="Decrypted Content" />;
  }

  return (
    <div>
      {status === 'locked' && (
        <button onClick={handleUnlock}>Unlock with Wallet</button>
      )}
      {status === 'connecting' && <p>Waiting for signature...</p>}
      {status === 'decrypting' && <p>Decrypting locally...</p>}
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
    </div>
  );
}
```

### Configuration
By default, the hook talks to `https://api.persist.so`. If you are running a self-hosted instance, you can override the API URL:

```tsx
const { status } = useTokenGatedFile(cid, {
  apiUrl: 'https://my-custom-api.com/v1'
});
```
