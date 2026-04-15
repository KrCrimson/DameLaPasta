import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import handleSockets from './src/socket/index.js';
import gameRoutes from './src/routes/gameRoutes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Permitir conexión desde cualquier React frontend
    methods: ['GET', 'POST']
  }
});

// Initialize WebSockets
handleSockets(io);

// Routes
app.use('/api', gameRoutes);

// Basic Route for testing
app.get('/', (req, res) => {
  res.send('Dame la Pasta API is running');
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
