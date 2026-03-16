/**
 * matchmaking.js – Sistem matchmaking untuk Quick Match
 * Block Blast Pro – Puzzle Arena
 */

class Matchmaking {
  constructor(io) {
    this.io     = io;
    this.queues = {
      duel: [], // array of { player, callback }
      br:   [],
    };
    this.rooms  = new Map();
  }

  addToQueue(player, mode, callback) {
    const queue = this.queues[mode] || this.queues.duel;
    queue.push({ player, callback });

    const maxPlayers = mode === 'br' ? 10 : 2;

    if (queue.length >= maxPlayers) {
      // Cukup pemain – buat room
      const matched = queue.splice(0, maxPlayers);
      const code    = this._generateCode();
      const room    = {
        code,
        mode,
        players:    matched.map(m => m.player),
        started:    false,
        maxPlayers,
      };
      this.rooms.set(code, room);
      matched.forEach(m => {
        m.player.roomCode = code;
        m.callback(room);
      });
    }
  }

  removeFromQueue(socketId) {
    for (const mode of ['duel','br']) {
      this.queues[mode] = (this.queues[mode] || []).filter(q => q.player.id !== socketId);
    }
  }

  _generateCode() {
    return Math.random().toString(36).slice(2,8).toUpperCase();
  }
}

module.exports = Matchmaking;
