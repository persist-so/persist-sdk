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

// src/index.tsx
var index_exports = {};
__export(index_exports, {
  PersistGatedImage: () => PersistGatedImage,
  TokenGatedFile: () => TokenGatedFile,
  decryptBlob: () => decryptBlob,
  useTokenGatedFile: () => useTokenGatedFile
});
module.exports = __toCommonJS(index_exports);
var import_react = __toESM(require("react"));
var import_ethers = require("ethers");
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
  const [status, setStatus] = (0, import_react.useState)("locked");
  const [error, setError] = (0, import_react.useState)(null);
  const [fileUrl, setFileUrl] = (0, import_react.useState)(null);
  const handleUnlock = async () => {
    try {
      setStatus("connecting");
      setError(null);
      if (!window.ethereum) {
        throw new Error("No Web3 wallet installed.");
      }
      const provider = new import_ethers.BrowserProvider(window.ethereum);
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
  (0, import_react.useEffect)(() => {
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
      return /* @__PURE__ */ import_react.default.createElement("img", { src: fileUrl, alt: fileName || "Decrypted Image", className });
    }
    if (isVideo) {
      return /* @__PURE__ */ import_react.default.createElement("video", { src: fileUrl, controls: true, className }, "Your browser does not support the video tag.");
    }
    return /* @__PURE__ */ import_react.default.createElement("div", { className: `flex flex-col items-center justify-center p-6 bg-gray-100 rounded-lg border border-gray-200 ${className || ""}` }, /* @__PURE__ */ import_react.default.createElement("svg", { className: "w-12 h-12 text-gray-500 mb-3", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, /* @__PURE__ */ import_react.default.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" })), /* @__PURE__ */ import_react.default.createElement("p", { className: "text-gray-800 font-medium mb-4" }, fileName || "Decrypted File"), /* @__PURE__ */ import_react.default.createElement(
      "a",
      {
        href: fileUrl,
        download: fileName || "download",
        className: "bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded shadow transition-colors"
      },
      "Download File"
    ));
  }
  return /* @__PURE__ */ import_react.default.createElement("div", { className: `relative flex items-center justify-center bg-gray-900 rounded-xl border border-gray-800 overflow-hidden min-h-[300px] ${className || ""}` }, /* @__PURE__ */ import_react.default.createElement("div", { className: "absolute inset-0 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 backdrop-blur-3xl" }), /* @__PURE__ */ import_react.default.createElement("div", { className: "relative z-10 flex flex-col items-center p-6 text-center" }, /* @__PURE__ */ import_react.default.createElement("div", { className: "w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mb-4" }, /* @__PURE__ */ import_react.default.createElement("svg", { className: "w-8 h-8 text-blue-500", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" }, /* @__PURE__ */ import_react.default.createElement("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }))), /* @__PURE__ */ import_react.default.createElement("h3", { className: "text-white font-bold text-lg mb-2" }, "Protected Asset"), /* @__PURE__ */ import_react.default.createElement("p", { className: "text-gray-400 text-sm mb-6 max-w-xs" }, "Connect your wallet to verify permissions and unlock this asset."), error && /* @__PURE__ */ import_react.default.createElement("div", { className: "text-red-400 text-sm mb-4 max-w-xs bg-red-400/10 p-2 rounded-lg border border-red-400/20" }, error), /* @__PURE__ */ import_react.default.createElement(
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
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  PersistGatedImage,
  TokenGatedFile,
  decryptBlob,
  useTokenGatedFile
});
