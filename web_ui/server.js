const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static('public')); // Tarjoilee HTML-sivut tästä kansiosta

// 1. Rajapinta, johon Python lähettää tietoa (POST)
app.post('/api/update', (req, res) => {
    const data = req.body;
    console.log("📩 Tieto Pythonilta:", data);

    // Lähetetään tieto heti eteenpäin selaimelle (Socket.io)
    io.emit('status_update', data);

    res.json({ status: 'ok' });
});

// 2. Kun selain yhdistää
io.on('connection', (socket) => {
    console.log('👀 Käyttäjä avasi selaimen');
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`🚀 Web-palvelin käynnissä: http://localhost:${PORT}`);
});