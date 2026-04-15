import { 
  createNewRoom, 
  getRoom, 
  addPlayerToRoom, 
  markPlayerOffline, 
  updatePlayerScore, 
  resetBuzzers 
} from './roomManager.js';

export default function handleSockets(io) {
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Host crea o recupera una sala
    socket.on('createRoom', ({ hostName, sessionId }, callback) => {
      // Buscar si el host ya tenía una sala
      let room = null;
      // ... search inside roomManager? Actually, let's keep it simple: create a new one.
      const newRoom = createNewRoom(sessionId);
      socket.join(newRoom.id);
      
      const hostPlayer = { id: socket.id, sessionId, name: hostName || 'Host', score: 0, online: true };
      newRoom.players.push(hostPlayer);

      console.log(`Sala ${newRoom.id} creada por ${hostPlayer.name} (Sesión: ${sessionId})`);
      callback({ success: true, roomCode: newRoom.id, roomState: newRoom });
    });

    // Reconnect as Host
    socket.on('reconnectHost', ({ roomCode, sessionId }, callback) => {
       const room = getRoom(roomCode);
       if (room && room.hostId === sessionId) {
          socket.join(roomCode);
          // Find host in players and update socket.id
          const hostInfo = room.players.find(p => p.sessionId === sessionId);
          if (hostInfo) {
             hostInfo.id = socket.id;
             hostInfo.online = true;
          }
          callback({ success: true, roomState: room });
       } else {
          callback({ success: false });
       }
    });

    // Jugador se une a la sala (o se reconecta)
    socket.on('joinRoom', ({ roomCode, playerName, sessionId }, callback) => {
      const result = addPlayerToRoom(roomCode, { id: socket.id, sessionId, name: playerName });
      
      if (result.error) {
        return callback({ success: false, message: result.error });
      }

      socket.join(roomCode);
      console.log(`${playerName} se unió/reconectó a la sala ${roomCode}`);
      
      // Notificamos a todos que hay un nuevo jugador / jugador reconectado
      io.to(roomCode).emit('playerJoined', { 
        players: result.room.players,
        newPlayer: result.newPlayer,
        reconnected: result.reconnected 
      });
      
      callback({ success: true, roomState: result.room });
    });

    // Host inicia el juego
    socket.on('startGame', ({ roomCode, sessionId }) => {
      const room = getRoom(roomCode);
      if (room && room.hostId === sessionId) {
        room.state = 'playing';
        io.to(roomCode).emit('gameStarted', { state: room.state });
      }
    });

    // Host o Jugador selecciona una pregunta
    socket.on('selectQuestion', ({ roomCode, category, points, text, answer }) => {
      const room = getRoom(roomCode);
      if (room) {
        room.currentQuestion = { category, points, text, answer };
        room.buzzerLocked = false;
        room.buzzedPlayer = null;
        
        io.to(roomCode).emit('questionSelected', { question: room.currentQuestion });
      }
    });

    // Jugador presiona el botón (Buzzer)
    socket.on('buzz', ({ roomCode, sessionId }) => {
      const room = getRoom(roomCode);
      
      if (room && !room.buzzerLocked && room.currentQuestion) {
        const player = room.players.find(p => p.sessionId === sessionId);
        if (player && player.online) {
           room.buzzerLocked = true;
           room.buzzedPlayer = sessionId; // Guardar sessionId
           io.to(roomCode).emit('playerBuzzed', { playerId: sessionId, playerName: player.name });
        }
      }
    });

    // Host evalúa la respuesta
    socket.on('evaluateAnswer', ({ roomCode, isCorrect, sessionId }) => {
      const room = getRoom(roomCode);
      
      if (room && room.hostId === sessionId && room.buzzedPlayer) {
        const points = room.currentQuestion.points;
        const playerBuzzedSessionId = room.buzzedPlayer;
        
        if (isCorrect) {
          updatePlayerScore(roomCode, playerBuzzedSessionId, points);
          room.currentQuestion = null;
          room.buzzerLocked = true;
          io.to(roomCode).emit('answerResult', { 
            playerId: playerBuzzedSessionId, 
            isCorrect: true, 
            scoreAwarded: points,
            players: room.players 
          });
        } else {
          // Si contestan mal, se quitan los puntos y se cierra la pregunta
          updatePlayerScore(roomCode, playerBuzzedSessionId, -points);
          room.currentQuestion = null;
          room.buzzerLocked = true;
          
          io.to(roomCode).emit('answerResult', { 
            playerId: playerBuzzedSessionId, 
            isCorrect: false, 
            scoreDeducted: points,
            players: room.players 
          });
        }
      }
    });

    // Host resetea el buzzer
    socket.on('resetBuzzer', ({ roomCode, sessionId }) => {
      const room = getRoom(roomCode);
      if (room && room.hostId === sessionId) {
        resetBuzzers(roomCode);
        io.to(roomCode).emit('buzzersReset');
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      const leaveResult = markPlayerOffline(socket.id);
      
      if (leaveResult) {
        io.to(leaveResult.code).emit('playerLeft', { players: leaveResult.remainingPlayers, playerId: leaveResult.player.sessionId });
      }
    });
  });
}
