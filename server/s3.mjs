// Minimal S3-compatible client (AWS Signature Version 4) for off-site backups. No dependencies.
// Works with Backblaze B2, Cloudflare R2, AWS S3, MinIO. Path-style addressing: https://endpoint/bucket/key.
// Operations: put, get, list (ListObjectsV2). Credentials never leave this process except as the signature.

import { createHash, createHmac } from 'node:crypto';

const sha256hex = (d) => createHash('sha256').update(d).digest('hex');
const hmac = (key, data) => createHmac('sha256', key).update(data, 'utf8').digest();
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
const encPath = (p) => p.split('/').map(enc).join('/');

// Builds the Authorization header. `headers` must already contain host and x-amz-date (and x-amz-content-sha256).
export function signV4({ method, path, query = {}, headers, payloadHash, region, service = 's3', accessKeyId, secretAccessKey, amzDate }) {
  const date = amzDate.slice(0, 8);
  const names = Object.keys(headers).map((h) => h.toLowerCase()).sort();
  const canonHeaders = names.map((n) => `${n}:${String(Object.entries(headers).find(([k]) => k.toLowerCase() === n)[1]).trim().replace(/\s+/g, ' ')}\n`).join('');
  const signedHeaders = names.join(';');
  const canonQuery = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&');
  const canonical = [method, encPath(path), canonQuery, canonHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${date}/${region}/${service}/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256hex(canonical)].join('\n');
  const kDate = hmac(`AWS4${secretAccessKey}`, date);
  const signature = createHmac('sha256', hmac(hmac(hmac(kDate, region), service), 'aws4_request')).update(toSign, 'utf8').digest('hex');
  return { authorization: `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`, signature, signedHeaders };
}

const amzNow = (d = new Date()) => d.toISOString().replace(/[:-]|\.\d{3}/g, '');

export function s3Client({ endpoint, region, bucket, accessKeyId, secretAccessKey, fetchImpl = fetch, now = () => new Date() }) {
  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) throw new Error('s3_not_configured');
  const base = new URL(endpoint);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('s3_endpoint_must_be_https');

  async function request(method, key, { body = Buffer.alloc(0), query = {}, extraHeaders = {} } = {}) {
    const path = `/${bucket}${key ? `/${key}` : ''}`;
    const payloadHash = sha256hex(body);
    const amzDate = amzNow(now());
    const headers = { host: base.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate, ...extraHeaders };
    const { authorization } = signV4({ method, path, query, headers, payloadHash, region, accessKeyId, secretAccessKey, amzDate });
    const qs = Object.keys(query).sort().map((k) => `${enc(k)}=${enc(query[k])}`).join('&');
    const res = await fetchImpl(`${base.origin}${encPath(path)}${qs ? `?${qs}` : ''}`, {
      method, headers: { ...headers, authorization }, body: method === 'PUT' ? body : undefined, signal: AbortSignal.timeout(60000),
    });
    return res;
  }
  return {
    async put(key, body) {
      const res = await request('PUT', key, { body: Buffer.from(body), extraHeaders: { 'content-type': 'application/octet-stream' } });
      if (!res.ok) throw new Error(`s3_put_${res.status}`);
    },
    async get(key) {
      const res = await request('GET', key);
      if (!res.ok) throw new Error(`s3_get_${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    },
    async list(prefix = '') {
      const res = await request('GET', '', { query: { 'list-type': '2', prefix } });
      if (!res.ok) throw new Error(`s3_list_${res.status}`);
      const xml = await res.text();
      return [...xml.matchAll(/<Key>([^<]+)<\/Key>/g)].map((m) => m[1].replace(/&amp;/g, '&')).sort();
    },
  };
}
