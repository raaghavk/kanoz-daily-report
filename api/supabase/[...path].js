// Vercel Serverless Function: Proxy requests to Supabase
// This bypasses ISP blocks in India by routing through Vercel's servers

const SUPABASE_URL = 'https://coguzmhpfmjkxmuasuoj.supabase.co'

export default async function handler(req, res) {
  const { path } = req.query
  const targetPath = Array.isArray(path) ? path.join('/') : path
  const targetUrl = `${SUPABASE_URL}/${targetPath}${req.url.includes('?') ? '?' + req.url.split('?').slice(1).join('?') : ''}`

  // Forward headers (except host)
  const headers = { ...req.headers }
  delete headers.host
  delete headers['x-forwarded-for']
  delete headers['x-forwarded-host']
  delete headers['x-forwarded-port']
  delete headers['x-forwarded-proto']
  delete headers['x-vercel-id']
  delete headers['x-vercel-deployment-url']
  delete headers['x-vercel-forwarded-for']
  delete headers['connection']

  try {
    const fetchOptions = {
      method: req.method,
      headers,
    }

    // Forward body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      fetchOptions.body = JSON.stringify(req.body)
    }

    const response = await fetch(targetUrl, fetchOptions)

    // Forward response headers
    const responseHeaders = {}
    response.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding' && key.toLowerCase() !== 'content-encoding') {
        responseHeaders[key] = value
      }
    })

    // Add CORS headers
    responseHeaders['access-control-allow-origin'] = '*'
    responseHeaders['access-control-allow-methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    responseHeaders['access-control-allow-headers'] = '*'

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.status(204)
      Object.entries(responseHeaders).forEach(([k, v]) => res.setHeader(k, v))
      return res.end()
    }

    const body = await response.text()
    res.status(response.status)
    Object.entries(responseHeaders).forEach(([k, v]) => res.setHeader(k, v))
    res.send(body)
  } catch (error) {
    res.status(502).json({ error: 'Proxy error', message: error.message })
  }
}
