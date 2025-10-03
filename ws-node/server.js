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

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const clients = new Set();

wss.on('connection', (ws, req) => {
  // Plocka token från query-param
  const urlParams = new URLSearchParams(req.url.slice(1));
  const token = urlParams.get('token');

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
    console.log('Client connected:', payload.email || payload.sub);

    ws.user = payload;
    clients.add(ws);

    ws.on('message', (message) => {
      console.log('📩 Received:', message.toString());

      // Broadcast åt alla andra
      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            status: 0,
            msg: message.toString(),
            from: payload.email || payload.user || 'unknown'
          }));
        }
      });
    });

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
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
