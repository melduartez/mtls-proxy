import https from 'https';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      message: 'mTLS proxy endpoint is ready',
      usage: 'Send a POST request with { url, method, headers, body, cert, key }'
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const proxySecret = process.env.MTLS_PROXY_SECRET;
  if (!proxySecret) {
    return res.status(500).json({ error: 'MTLS_PROXY_SECRET not configured' });
  }

  const authHeader = req.headers['authorization'];
  if (authHeader !== 'Bearer ' + proxySecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, method, headers, body, cert, key } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid URL: ' + e.message });
  }

  const bodyStr = body ? String(body) : '';
  const reqHeaders = { ...headers };

  if (bodyStr && !reqHeaders['Content-Length'] && !reqHeaders['content-length']) {
    reqHeaders['Content-Length'] = Buffer.byteLength(bodyStr);
  }

  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || 443,
    path: urlObj.pathname + urlObj.search,
    method: method || 'GET',
    headers: reqHeaders
  };

  if (cert && key) {
    options.cert = cert;
    options.key = key;
    options.rejectUnauthorized = true;
  }

  const proxyReq = https.request(options, (proxyRes) => {
    const chunks = [];
    proxyRes.on('data', (chunk) => chunks.push(chunk));
    proxyRes.on('end', () => {
      const data = Buffer.concat(chunks).toString('utf-8');
      res.status(200).json({
        status: proxyRes.statusCode,
        statusText: proxyRes.statusMessage || '',
        headers: proxyRes.headers,
        body: data
      });
    });
  });

  proxyReq.on('error', (e) => {
    console.error('Proxy request error:', e.message);
    res.status(502).json({ error: 'Proxy request failed: ' + e.message });
  });

  if (bodyStr) proxyReq.write(bodyStr);
  proxyReq.end();
}