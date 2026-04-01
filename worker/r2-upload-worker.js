/**
 * Cloudflare Worker — R2 Image Upload Proxy
 *
 * Deploy steps:
 *   1. Cloudflare Dashboard → Workers & Pages → Create → "Create Worker"
 *   2. Name it: "r2-upload-worker" (or any name you like)
 *   3. Paste this entire code into the editor, click "Deploy"
 *   4. Go to Worker Settings → Variables → add environment variable:
 *        UPLOAD_SECRET = (set a random password, e.g. "my-secret-key-123")
 *   5. Go to Worker Settings → R2 Bucket Bindings → add:
 *        Variable name: BUCKET
 *        R2 bucket: icypic
 *   6. Done! Your worker URL is: https://r2-upload-worker.<your-subdomain>.workers.dev
 */

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: corsHeaders(),
      });
    }

    // GET — proxy-read an image from R2 (with CORS headers)
    if (request.method === 'GET') {
      const url = new URL(request.url);
      const key = url.searchParams.get('key');
      if (!key) {
        return jsonResponse({ error: 'Missing ?key= parameter' }, 400);
      }
      try {
        const object = await env.BUCKET.get(key);
        if (!object) {
          return jsonResponse({ error: 'Not found' }, 404);
        }
        const headers = new Headers(corsHeaders());
        headers.set('Content-Type', object.httpMetadata?.contentType || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000');
        return new Response(object.body, { status: 200, headers });
      } catch (err) {
        return jsonResponse({ error: err.message || 'Failed to fetch from R2' }, 500);
      }
    }

    // Only accept POST for uploads
    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    try {
      const body = await request.json();
      const { image, filename, secret } = body;

      // Verify secret
      if (!secret || secret !== env.UPLOAD_SECRET) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      if (!image) {
        return jsonResponse({ error: 'Missing image data' }, 400);
      }

      // Detect content type from base64 header
      let contentType = 'image/jpeg';
      let ext = 'jpg';
      if (image.startsWith('data:image/webp')) {
        contentType = 'image/webp';
        ext = 'webp';
      } else if (image.startsWith('data:image/png')) {
        contentType = 'image/png';
        ext = 'png';
      }

      // Generate filename if not provided
      const name = filename || `${Date.now()}-${randomId()}.${ext}`;
      const key = `images/${name}`;

      // Convert base64 to binary
      const pure = image.includes(',') ? image.split(',')[1] : image;
      const binaryString = atob(pure);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Upload to R2
      await env.BUCKET.put(key, bytes.buffer, {
        httpMetadata: {
          contentType: contentType,
          cacheControl: 'public, max-age=31536000',
        },
      });

      // Build the public URL
      const publicUrl = `https://pub-106dc7a6bb4a423e9e215a20be033278.r2.dev/${key}`;

      return jsonResponse({
        success: true,
        url: publicUrl,
        key: key,
      });
    } catch (err) {
      return jsonResponse({ error: err.message || 'Internal error' }, 500);
    }
  },
};

function randomId() {
  return Math.random().toString(36).substring(2, 14);
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders(),
    },
  });
}
