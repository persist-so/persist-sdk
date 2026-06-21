# Persist SDKs

The official SDKs for [Persist Storage](https://persist.so), the complete platform for Hybrid S3/Web3 Storage and Token Gated Encryption.

This repository contains the Javascript and React SDKs for seamlessly interacting with the Persist ecosystem.

## Packages

| Package | Description | Version |
| ------- | ----------- | ------- |
| [`@persist-so-npm/sdk`](./packages/sdk) | Core TypeScript/JavaScript SDK for interacting with the Persist API and S3. | [![npm version](https://badge.fury.io/js/@persist-so-npm%2Fsdk.svg)](https://badge.fury.io/js/@persist-so-npm%2Fsdk) |
| [`@persist-so-npm/react`](./packages/react) | React hooks for seamless token-gated decryption and wallet integration. | [![npm version](https://badge.fury.io/js/@persist-so-npm%2Freact.svg)](https://badge.fury.io/js/@persist-so-npm%2Freact) |

## Quick Start

### For Node.js / Backend
Use the core SDK to generate upload URLs and encrypt data on the server.

```bash
npm install @persist-so-npm/sdk
```

```javascript
import { PersistClient } from '@persist-so-npm/sdk';

const client = new PersistClient({ apiKey: 'YOUR_API_KEY' });

// Generate an upload URL
const { presignedUrl, key } = await client.generateUploadUrl({
  fileName: 'test.jpg',
  tier: 's3', 
  isPrivate: true
});
```

### For React / Frontend
Use the React SDK to prompt users for MetaMask/Phantom signatures and decrypt Token Gated IPFS files directly in the browser's memory.

```bash
npm install @persist-so-npm/react ethers
```

```tsx
import { useTokenGatedFile } from '@persist-so-npm/react';

export function Viewer({ cid }) {
  const { status, fileUrl, handleUnlock } = useTokenGatedFile(cid);

  if (status === 'unlocked' && fileUrl) {
    return <img src={fileUrl} alt="Decrypted" />;
  }

  return <button onClick={handleUnlock}>Unlock with Wallet</button>;
}
```

## Contributing
These packages use `npm workspaces` for monorepo management. 

To install dependencies across all packages:
```bash
npm install
```

To build all packages:
```bash
npm run build
```

## License
MIT
