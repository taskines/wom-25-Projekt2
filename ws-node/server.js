require('dotenv').config();
const http = require('http');
const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET;

app.get('/', (req, res) => res.send('WebSocket server running'));

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws, req) => {
  // Extract JWT token from query string
  const urlParams = new URLSearchParams(req.url.slice(1));
  const token = urlParams.get('token');

  let payload;
  try {
    // Verify token
    payload = jwt.verify(token, JWT_SECRET);
    console.log('Client connected:', payload.email || payload.sub);

    // Save user info in connection
    ws.user = payload;
    clients.add(ws);

    // Handle incoming messages
    ws.on('message', (message) => {
      let parsed;

      // Try to parse JSON message from client
      try {
        parsed = JSON.parse(message);
      } catch {
        parsed = { msg: message.toString(), from: 'Unknown' };
      }

      // Broadcast to all *other* connected clients
      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            status: 0,
            msg: parsed.msg,
            from: parsed.from || payload.email || 'unknown'
          }));
        }
      });
    });

    // Handle disconnection
    ws.on('close', () => {
      clients.delete(ws);
      console.log('Client disconnected');
    });

  } catch (err) {
    console.log('Invalid token:', err.message);

    try {
      if (err.name === 'TokenExpiredError') {
        ws.send(JSON.stringify({ status: 1, msg: 'ERROR: Token expired' }));
      } else {
        ws.send(JSON.stringify({ status: 1, msg: 'ERROR: Invalid token' }));
      }
    } catch (e) {}

    ws.close();
  }
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket server running on ws://localhost:${PORT}`);
});
