const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);

// Initialize the WebSocket server
const wss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 8080;
// Dynamic ElevenLabs Agent ID configuration passed via environment variable
const AGENT_ID = process.env.ELEVENLABS_AGENT_ID || "agent_4701kt44menpf2xav2d18ahb93c1";

// 1. Standard HTTP Handshake - Send Exotel the required JSON object configuration
app.get("/", (req, res) => {
  const webSocketEndpoint = `wss://${req.get('host')}/connect`;
  console.log(`Sending production JSON routing target: ${webSocketEndpoint}`);
  
  res.status(200).json({
    status: "success",
    url: webSocketEndpoint
  });
});

// 2. WebSocket Stream Tunneler
wss.on("connection", (exotelWs, request) => {
  console.log("🚀 Exotel connected to Cloud Run WebSocket bridge.");

  // Route directly to ElevenLabs' regional infrastructure for India
 const elevenLabsUrl = `wss://api.elevenlabs.io/v1/convai/conversation/exotel?agent_id=${AGENT_ID}`;
  const elevenLabsWs = new WebSocket(elevenLabsUrl);

  // Pipe incoming audio data from Exotel straight to ElevenLabs
  exotelWs.on("message", (message) => {
    if (elevenLabsWs.readyState === WebSocket.OPEN) {
      elevenLabsWs.send(message);
    }
  });

  // Pipe incoming voice responses from ElevenLabs back to the Exotel phone line
  elevenLabsWs.on("message", (message) => {
    if (exotelWs.readyState === WebSocket.OPEN) {
      exotelWs.send(message);
    }
  });

  // Handle sudden call disconnections gracefully
  exotelWs.on("close", () => {
    console.log("📴 Exotel hung up the phone line.");
    elevenLabsWs.close();
  });

  elevenLabsWs.on("close", () => {
    console.log("🛑 ElevenLabs closed the audio stream.");
    exotelWs.close();
  });

  exotelWs.on("error", (err) => console.error("Exotel WS Error:", err));
  elevenLabsWs.on("error", (err) => console.error("ElevenLabs WS Error:", err));
});

// Handle the HTTP protocol switch request (Upgrade to wss://)
server.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit("connection", ws, request);
  });
});

server.listen(PORT, () => {
  console.log(`Server running securely on port ${PORT}`);
});
