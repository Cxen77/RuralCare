const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.IO server on top of HTTP server
 * @param {import('http').Server} server 
 */
function initSocket(server) {
  if (io) return io;

  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      credentials: true,
    },
    pingInterval: 15000,
    pingTimeout: 20000,
    path: '/socket.io',
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Allow client to join role or user specific rooms
    socket.on('join', ({ role, userId, hospitalId }) => {
      if (role) {
        socket.join(`role:${role}`);
        console.log(`[Socket.IO] ${socket.id} joined role:${role}`);
      }
      if (userId) {
        socket.join(`user:${userId}`);
        console.log(`[Socket.IO] ${socket.id} joined user:${userId}`);
      }
      if (hospitalId) {
        socket.join(`hospital:${hospitalId}`);
        console.log(`[Socket.IO] ${socket.id} joined hospital:${hospitalId}`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (${reason})`);
    });
  });

  console.log('[Socket.IO] Real-time emergency server initialized on /socket.io');
  return io;
}

/**
 * Get active Socket.IO instance
 */
function getIO() {
  return io;
}

/**
 * Broadcast new emergency incident
 * @param {object} emergency 
 */
function emitEmergencyCreated(emergency) {
  if (!io) return;
  // Community broadcast
  io.emit('emergency:created', emergency);

  // Dedicated alert to emergency responders (doctors and hospitals)
  io.to('role:doctor').to('role:hospital').emit('emergency:alert', {
    type: 'EMERGENCY_DISPATCH',
    emergency,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast status update for an emergency incident
 * @param {object} emergency 
 */
function emitEmergencyUpdated(emergency) {
  if (!io) return;
  io.emit('emergency:updated', emergency);

  if (emergency.status === 'resolved') {
    io.emit('emergency:resolved', {
      emergencyId: emergency._id,
      emergency,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = {
  initSocket,
  getIO,
  emitEmergencyCreated,
  emitEmergencyUpdated,
};
