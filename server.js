require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { URL } = require('url');
const app = express();
const PORT = process.env.PORT || 3000;

// CORS Configuration
const CORS_CONFIG = {
    allowOrigins: process.env.CORS_ORIGINS || '*',
    allowMethods: process.env.CORS_METHODS || 'GET, OPTIONS',
    allowHeaders: process.env.CORS_HEADERS || 'Content-Type, Authorization, Range',
    exposeHeaders: process.env.CORS_EXPOSE_HEADERS || 'Content-Length, Content-Range',
    maxAge: process.env.CORS_MAX_AGE || '86400'
};

// Supported MIME types
const MIME_TYPES = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    m3u8: 'application/x-mpegURL',
    ts: 'video/MP2T'
};

// Health check endpoint
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// CORS middleware
app.use((req, res, next) => {
    console.log('CORS middleware request');
    res.setHeader('Access-Control-Allow-Origin', CORS_CONFIG.allowOrigins);
    res.setHeader('Access-Control-Allow-Methods', CORS_CONFIG.allowMethods);
    res.setHeader('Access-Control-Allow-Headers', CORS_CONFIG.allowHeaders);
    res.setHeader('Access-Control-Expose-Headers', CORS_CONFIG.exposeHeaders);
    res.setHeader('Access-Control-Max-Age', CORS_CONFIG.maxAge);

    // Handle preflight requests first
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', CORS_CONFIG.allowOrigins);
        res.header('Access-Control-Allow-Methods', CORS_CONFIG.allowMethods);
        res.header('Access-Control-Allow-Headers', CORS_CONFIG.allowHeaders);
        res.header('Access-Control-Max-Age', CORS_CONFIG.maxAge);
        return res.sendStatus(204);
    }
    next();
});

// URL validation middleware
app.use((req, res, next) => {
    try {
        const targetUrl = req.url.slice(1);
        console.log('URL validation middleware for targetUrl:', targetUrl);
        const isValid = targetUrl.startsWith('http://') || targetUrl.startsWith('https://');

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid URL format' });
        }

        const parsedUrl = new URL(targetUrl);
        req.targetUrl = targetUrl;
        req.extension = parsedUrl.pathname.split('.').pop().toLowerCase();
        next();
    } catch (error) {
        res.status(400).json({ error: 'Malformed URL' });
    }
});

// Proxy configuration
app.use(
    createProxyMiddleware({
        target: '',
        changeOrigin: true,
        pathRewrite: { '^.*': '' },
        logLevel: 'debug', // Enable logging
        logProvider: (provider) => console,
        onProxyReq: (proxyReq, req) => {
            console.log('[onProxyReq] Requesting:', req.targetUrl);
            // Preserve range headers for video streaming
            if (req.headers.range) {
                proxyReq.setHeader('Range', req.headers.range);
            }

            if (MIME_TYPES[req.extension]) {
                proxyReq.setHeader('Accept', MIME_TYPES[req.extension]);
            }
        },
        onProxyRes: (proxyRes, req, res) => {
            console.log('[onProxyRes] Response:', req.targetUrl);
            // Forward Content-Range for byte-range requests
            if (proxyRes.headers['content-range']) {
                res.setHeader('Content-Range', proxyRes.headers['content-range']);
            }

            // Set MIME type based on file extension
            if (MIME_TYPES[req.extension]) {
                res.setHeader('Content-Type', MIME_TYPES[req.extension]);
            }

            // Add security headers
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('X-Frame-Options', 'DENY');

            // CORS
            // res.setHeader('Access-Control-Allow-Origin', CORS_CONFIG.allowOrigins);
        },
        router: (req) => req.targetUrl
    })
);



app.listen(PORT, () => console.log(`Proxy running on port ${PORT}`));
