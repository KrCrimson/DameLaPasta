const rooms = new Map();

const generateRoomCode = () => {
  return Math.floor(Math.random() * 16777215).toString(16).toUpperCase().padStart(6, '0');
};

export const createNewRoom = (hostSessionId) => {
  let code;
  do {
    code = generateRoomCode();
  } while (rooms.has(code));

  const newRoom = {
    id: code,
    hostId: hostSessionId,
    players: [], // { sessionId, id (socketId), name, score, online }
    state: 'lobby', // 'lobby', 'playing', 'finished'
    currentQuestion: null,
    buzzedPlayer: null, // this will now store sessionId
    buzzerLocked: true,
    board: [],
    lastActive: Date.now() // For cleanup
  };
  
  rooms.set(code, newRoom);
  return newRoom;
};

export const getRoom = (code) => {
  const room = rooms.get(code);
  if (room) room.lastActive = Date.now();
  return room;
};

export const addPlayerToRoom = (code, player) => {
  // player is { sessionId, id: socket.id, name }
  const room = rooms.get(code);
  if (!room) return { error: 'Sala no encontrada' };
  
  if (room.players.length >= 10 && !room.players.find(p => p.sessionId === player.sessionId)) {
    return { error: 'La sala está llena (máximo 10 jugadores)' };
  }
  
  const existingBySession = room.players.find(p => p.sessionId === player.sessionId);
  if (existingBySession) {
      // Reconnecting
      existingBySession.id = player.id;
      existingBySession.name = player.name;
      existingBySession.online = true;
      return { room, newPlayer: existingBySession, reconnected: true };
  }

  const existingByName = room.players.find(p => p.name === player.name);
  if (existingByName && existingByName.online) {
     return { error: 'El nombre ya está en uso en esta sala' };
  }

  const newPlayer = { ...player, score: 0, online: true };
  room.players.push(newPlayer);
  return { room, newPlayer, reconnected: false };
};

export const markPlayerOffline = (socketId) => {
  for (const [code, room] of rooms.entries()) {
    const playerIndex = room.players.findIndex(p => p.id === socketId);
    if (playerIndex !== -1) {
      const player = room.players[playerIndex];
      player.online = false;
      return { code, player, roomDeleted: false, remainingPlayers: room.players };
    }
  }
  return null;
};

export const updatePlayerScore = (code, playerSessionId, pointsToAdd) => {
    const room = rooms.get(code);
    if (!room) return null;

    const player = room.players.find(p => p.sessionId === playerSessionId);
    if (player) {
        // Aseguramos que sea número (antes concatenaba por ser texto)
        player.score += Number(pointsToAdd);
    }
    return room;
};

// Cleanup old rooms
setInterval(() => {
   const now = Date.now();
   for (const [code, room] of rooms.entries()) {
      // 1 hour timeout (3600000 ms)
      if (now - room.lastActive > 3600000) {
          rooms.delete(code);
      }
   }
}, 60000); // Check every minute


export const resetBuzzers = (code) => {
    const room = rooms.get(code);
    if (room) {
        room.buzzedPlayer = null;
        room.buzzerLocked = false;
    }
    return room;
};
