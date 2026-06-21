// src/index.tsx
import React, { useState, useEffect } from "react";
import { BrowserProvider } from "ethers";
async function decryptBlob(ciphertextBlob, rawAESKeyBase64) {
  const rawKeyBytes = Uint8Array.from(atob(rawAESKeyBase64), (c) => c.charCodeAt(0));
  const cryptoKey = await window.crypto.subtle.importKey(
    "raw",
    rawKeyBytes,
    "AES-GCM",
    true,
    ["decrypt"]
  );
  const arrayBuffer = await ciphertextBlob.arrayBuffer();
  const iv = arrayBuffer.slice(0, 12);
  const data = arrayBuffer.slice(12);
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    data
  );
  return new Blob([decryptedBuffer]);
}
function useTokenGatedFile(cid, options = {}) {
  const apiUrl = options.apiUrl || "https://api.persist.so";
  const [status, setStatus] = useState("locked");
  const [error, setError] = useState(null);
  const [fileUrl, setFileUrl] = useState(null);
  const handleUnlock = async () => {
    try {
      setStatus("connecting");
      setError(null);
      if (!window.ethereum) {
        throw new Error("No Web3 wallet installed.");
      }
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();
      setStatus("decrypting");
      const urlRes = await fetch(`${apiUrl}/generateDownloadUrl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: { uploadId: cid } })
      });
      const urlData = await urlRes.json();
      if (urlData.error) throw new Error(urlData.error.message || "Failed to get download URL");
      const blobRes = await fetch(urlData.result.presignedUrl);
      const ciphertextBlob = await blobRes.blob();
      const message = `Sign this message to decrypt the file via Persist KMS.

File: ${cid}
Address: ${address}
Timestamp: ${Date.now()}`;
      const signature = await signer.signMessage(message);
      const kmsRes = await fetch(`${apiUrl}/retrieveKmsKey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: { cid, siweMessage: message, signature }
        })
      });
      const kmsData = await kmsRes.json();
      if (kmsData.error) throw new Error(kmsData.error.message || "Failed to retrieve KMS Key. Access Denied.");
      const decryptedBlob = await decryptBlob(ciphertextBlob, kmsData.result.rawAESKeyBase64);
      const objUrl = URL.createObjectURL(decryptedBlob);
      setFileUrl(objUrl);
      setStatus("unlocked");
    } catch (err) {
      console.error(err);
      setError(err.message || "An unknown error occurred.");
      setStatus("locked");
    }
  };
  useEffect(() => {
    return () => {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
    };
  }, [fileUrl]);
  return { status, error, fileUrl, unlock: handleUnlock };
}
function TokenGatedFile({ cid, className, fileName, mimeType }) {
  const { status, error, fileUrl, unlock } = useTokenGatedFile(cid);
  if (status === "unlocked" && fileUrl) {
    const isImage = mimeType?.startsWith("image/") || fileName?.match(/\.(jpeg|jpg|gif|png|webp|svg)$/i);
    const isVideo = mimeType?.startsWith("video/") || fileName?.match(/\.(mp4|webm|ogg)$/i);
    if (isImage) {
      return /* @__PURE__ */ React.createElement("img", { src: fileUrl, alt: fileName || "Decrypted Image", className });
    }
    if (isVideo) {
      return /* @__PURE__ */ React.createElement("video", { src: fileUrl, controls: true, className }, "Your browser does not support the video tag.");
    }
    return /* @__PURE__ */ React.createElement("div", { className: `flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg border border-gray-200 ${className || ""}` }, /* @__PURE__ */ React.createElement("svg", { className: "w-12 h-12 text-gray-500 mb-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, /* @__PURE__ */ React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" })), /* @__PURE__ */ React.createElement("p", { className: "text-gray-800 font-medium mb-4" }, fileName || "Decrypted File"), /* @__PURE__ */ React.createElement(
      "a",
      {
        href: fileUrl,
        download: fileName || "download",
        className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded shadow transition-colors"
      },
      "Download File"
    ));
  }
  return /* @__PURE__ */ React.createElement("div", { className: `relative flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 overflow-hidden min-h-[300px] ${className || ""}` }, /* @__PURE__ */ React.createElement("div", { className: "absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-3xl" }), /* @__PURE__ */ React.createElement("div", { className: "relative z-10 flex flex-col items-center p-6 text-center" }, /* @__PURE__ */ React.createElement("div", { className: "w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4" }, /* @__PURE__ */ React.createElement("svg", { className: "w-8 h-8 text-blue-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, /* @__PURE__ */ React.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }))), /* @__PURE__ */ React.createElement("h3", { className: "text-white font-bold text-lg mb-2" }, "Protected Asset"), /* @__PURE__ */ React.createElement("p", { className: "text-gray-400 text-sm mb-6 max-w-xs" }, "Connect your wallet to verify permissions and unlock this asset."), error && /* @__PURE__ */ React.createElement("div", { className: "text-red-400 text-sm mb-4 max-w-xs bg-red-400/10 p-2 rounded-lg border border-red-400/20" }, error), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: unlock,
      disabled: status !== "locked",
      className: "bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    },
    status === "locked" && "Unlock via KMS",
    status === "connecting" && "Connecting...",
    status === "decrypting" && "Decrypting..."
  )));
}
var PersistGatedImage = TokenGatedFile;
export {
  PersistGatedImage,
  TokenGatedFile,
  decryptBlob,
  useTokenGatedFile
};
