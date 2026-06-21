# @persist-so-npm/sdk

The official Node.js SDK for Persist Storage. This SDK provides a seamless interface to upload, manage, and encrypt files on IPFS, Filecoin, Arweave, and S3, with built-in support for Zero-Knowledge Vault Encryption.

## Installation

```bash
npm install @persist-so-npm/sdk
```

## Initialization

```typescript
import { PersistClient } from '@persist-so-npm/sdk';

// Initialize with your API Key
const client = new PersistClient('YOUR_API_KEY');

// Or override the API URL if hosting your own instance
const client = new PersistClient({
  apiKey: 'YOUR_API_KEY',
  apiUrl: 'https://api.persist.so'
});
```

## Usage

### Upload a Public File to IPFS & S3
```typescript
const result = await client.upload('./path/to/my-file.png', {
  s3: { enabled: true, isPrivate: false },
  web3: { ipfs: true }
});
console.log('Upload successful:', result);
```

### Upload a Private Zero-Knowledge Encrypted File
When you enable `s3.encrypted`, the SDK encrypts the file locally on your machine using AES-256-GCM before it ever touches the network.

```typescript
const result = await client.upload('./path/to/secret-doc.pdf', {
  s3: { enabled: true, isPrivate: true, encrypted: true }
});
// Keep the returned decryptionKey safe! The server does not store it.
console.log('Encrypted Upload:', result);
```
