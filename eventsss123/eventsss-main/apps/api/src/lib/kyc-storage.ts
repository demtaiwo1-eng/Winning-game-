import { createHash, createHmac, randomUUID } from "node:crypto";
import { HttpError } from "./errors";

const STORAGE_SCHEME = "neon-kyc://";
const MAX_DOCUMENT_BYTES = 650 * 1024;

type StorageConfig = {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

function config(): StorageConfig {
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim();
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.KYC_STORAGE_BUCKET?.trim();
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new HttpError(503, "KYC_STORAGE_NOT_CONFIGURED", "Secure document storage is not configured.");
  }
  let parsed: URL;
  try { parsed = new URL(endpoint); } catch {
    throw new HttpError(503, "KYC_STORAGE_MISCONFIGURED", "Secure document storage endpoint is invalid.");
  }
  if (parsed.protocol !== "https:" || parsed.search || parsed.hash) {
    throw new HttpError(503, "KYC_STORAGE_MISCONFIGURED", "Secure document storage endpoint must be an HTTPS origin.");
  }
  return { endpoint: parsed.toString().replace(/\/$/, ""), region, accessKeyId, secretAccessKey, bucket };
}

function hmac(key: Buffer | string, value: string): Buffer {
  return createHmac("sha256", key).update(value, "utf8").digest();
}

function objectUrl(cfg: StorageConfig, key: string): URL {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return new URL(`${cfg.endpoint}/${encodeURIComponent(cfg.bucket)}/${encodedKey}`);
}

async function signedRequest(method: "PUT" | "GET", key: string, body?: Buffer, contentType?: string): Promise<Response> {
  const cfg = config();
  const url = objectUrl(cfg, key);
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = createHash("sha256").update(body ?? Buffer.alloc(0)).digest("hex");
  const headers: Record<string, string> = {
    host: url.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  };
  if (contentType) headers["content-type"] = contentType;
  const signedHeaders = Object.keys(headers).sort().join(";");
  const canonicalHeaders = Object.keys(headers).sort().map((name) => `${name}:${headers[name].trim()}\n`).join("");
  const canonicalRequest = [
    method,
    url.pathname,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");
  const scope = `${dateStamp}/${cfg.region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const dateKey = hmac(`AWS4${cfg.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, cfg.region);
  const serviceKey = hmac(regionKey, "s3");
  const signingKey = hmac(serviceKey, "aws4_request");
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");
  const authorization = `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const requestHeaders: Record<string, string> = {
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
    authorization,
  };
  if (contentType) requestHeaders["content-type"] = contentType;
  return fetch(url, {
    method,
    headers: requestHeaders,
    body: method === "PUT" && body ? new Uint8Array(body) : undefined,
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
}

export function isStoredKycDocument(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(STORAGE_SCHEME);
}

export async function storeKycDocument(input: {
  base64: string;
  fileName: string;
}): Promise<string> {
  const encoded = input.base64.trim();
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded)) {
    throw new HttpError(400, "INVALID_DOCUMENT", "The uploaded document encoding is invalid.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError(413, "KYC_DOCUMENT_TOO_LARGE", "KYC document must be no larger than 650 KB.");
  }
  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "").toLowerCase();
  const extension = safeName.split(".").pop() || "";
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
  };
  const contentType = mimeTypes[extension];
  if (!contentType) throw new HttpError(400, "UNSUPPORTED_DOCUMENT_TYPE", "Upload a PDF, JPG, PNG, or WEBP document.");
  const signatures: Record<string, boolean> = {
    pdf: bytes.subarray(0, 5).toString("ascii") === "%PDF-",
    jpg: bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    jpeg: bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
    png: bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    webp: bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP",
  };
  if (!signatures[extension]) {
    throw new HttpError(400, "DOCUMENT_CONTENT_MISMATCH", "The document content does not match its file type.");
  }
  const key = `documents/${randomUUID()}.${extension}`;
  let response: Response;
  try {
    response = await signedRequest("PUT", key, bytes, contentType);
  } catch {
    throw new HttpError(503, "KYC_STORAGE_UNAVAILABLE", "Secure document storage is temporarily unavailable.");
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new HttpError(503, "KYC_STORAGE_UNAVAILABLE", "Secure document storage could not accept the upload.");
  }
  return `${STORAGE_SCHEME}${key}`;
}

export async function readKycDocument(reference: string): Promise<{ bytes: Buffer; contentType: string }> {
  if (!isStoredKycDocument(reference)) throw new HttpError(404, "KYC_DOCUMENT_NOT_FOUND", "Stored KYC document not found.");
  const key = reference.slice(STORAGE_SCHEME.length);
  if (!/^documents\/[a-f0-9-]+\.(pdf|jpg|jpeg|png|webp)$/.test(key)) {
    throw new HttpError(404, "KYC_DOCUMENT_NOT_FOUND", "Stored KYC document not found.");
  }
  let response: Response;
  try { response = await signedRequest("GET", key); } catch {
    throw new HttpError(503, "KYC_STORAGE_UNAVAILABLE", "Secure document storage is temporarily unavailable.");
  }
  if (response.status === 404) throw new HttpError(404, "KYC_DOCUMENT_NOT_FOUND", "Stored KYC document not found.");
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new HttpError(503, "KYC_STORAGE_UNAVAILABLE", "Secure document storage could not retrieve the document.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_DOCUMENT_BYTES) {
    throw new HttpError(502, "KYC_DOCUMENT_INVALID", "Stored KYC document failed validation.");
  }
  const extension = key.split(".").pop()!;
  const contentType = extension === "pdf" ? "application/pdf" : extension === "png" ? "image/png" : extension === "webp" ? "image/webp" : "image/jpeg";
  return { bytes, contentType };
}
