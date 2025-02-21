require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Middleware to extract the target URL from the request path
app.use((req, res, next) => {
    // Extract the target URL from the request path
    const path = req.url; // e.g., "/http://example.com/path/to/resource"
    const targetUrlMatch = path.match(/^\/(https?:\/\/[^\/]+)/i);

    if (!targetUrlMatch) {
        return res.status(400).send('Invalid target URL in request path');
    }

    const targetUrl = targetUrlMatch[1]; // e.g., "http://example.com"
    const remainingPath = path.slice(targetUrlMatch[0].length); // e.g., "/path/to/resource"

    // Modify the request URL to remove the target URL prefix
    req.url = remainingPath || '/';

    // Create the proxy middleware with the dynamic target
    const proxyMiddleware = createProxyMiddleware({
        target: targetUrl,
        changeOrigin: true, // Needed for virtual hosted sites
        onProxyReq: (proxyReq, req, res) => {
            console.log(`Proxying request to: ${targetUrl}${req.url}`);
        },
        onError: (err, req, res) => {
            console.error('Proxy error:', err);
            res.status(500).send('Proxy error');
        },
    });

    // Use the proxy middleware for this request
    proxyMiddleware(req, res, next);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Proxy server is running on port ${PORT}`);
});
