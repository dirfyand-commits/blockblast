/**
 * socket.js – Socket.io handler untuk multiplayer realtime
 * Block Blast Pro – Puzzle Arena
 */

class SocketHandler {
  constructor(io, db, matchmaking) {
    this.io          = io;
    this.db          = db;
    this.matchmaking = matchmaking;
    this.rooms       = new Map(); // roomCode -> room data
    this.players     = new Map(); // socketId -> player data
  }

  init() {
    this.io.on('connection', (socket) => {
      console.log(`[+] Pemain terhubung: ${socket.id}`);

      // ── Registrasi pemain ───────────────────────────────────
      socket.on('register', (data) => {
        this.players.set(socket.id, {
          id:       socket.id,
          username: data.username || 'Guest',
          avatar:   data.avatar   || '👾',
          roomCode: null,
          score:    0,
        });
        socket.emit('registered', { playerId: socket.id });
      });

      // ── Buat Room ───────────────────────────────────────────
      socket.on('create_room', (data) => {
        const code = this._generateRoomCode();
        const player = this.players.get(socket.id) || { id: socket.id, username: data.username || 'Guest', avatar: data.avatar || '👾' };

        const room = {
          code,
          mode:    data.mode || 'duel',
          host:    socket.id,
          players: [player],
          started: false,
          maxPlayers: data.mode === 'br' ? 10 : 2,
        };

        this.rooms.set(code, room);
        player.roomCode = code;
        socket.join(code);

        socket.emit('room_created', { code, room });
        console.log(`[Room] Dibuat: ${code} mode=${room.mode}`);
      });

      // ── Gabung Room ─────────────────────────────────────────
      socket.on('join_room', (data) => {
        const code   = (data.code || '').toUpperCase();
        const room   = this.rooms.get(code);

        if (!room)         return socket.emit('error', { message: 'Room tidak ditemukan' });
        if (room.started)  return socket.emit('error', { message: 'Game sudah dimulai' });
        if (room.players.length >= room.maxPlayers) return socket.emit('error', { message: 'Room penuh' });

        const player = this.players.get(socket.id) || {
          id:       socket.id,
          username: data.username || 'Guest',
          avatar:   data.avatar   || '👾',
        };
        player.roomCode = code;
        room.players.push(player);
        socket.join(code);

        // Beritahu semua di room
        this.io.to(code).emit('player_joined', { player, room });

        // Auto-start jika penuh
        if (room.players.length >= room.maxPlayers) {
          setTimeout(() => this._startGame(code), 1500);
        }

        console.log(`[Room] ${player.username} gabung ${code}`);
      });

      // ── Quick Match ─────────────────────────────────────────
      socket.on('quick_match', (data) => {
        const player = this.players.get(socket.id) || {
          id:       socket.id,
          username: data.username || 'Guest',
          avatar:   data.avatar   || '👾',
        };
        this.matchmaking.addToQueue(player, data.mode || 'duel', (matchedRoom) => {
          socket.join(matchedRoom.code);
          player.roomCode = matchedRoom.code;
          socket.emit('room_joined', { room: matchedRoom });
          if (matchedRoom.players.length >= matchedRoom.maxPlayers) {
            setTimeout(() => this._startGame(matchedRoom.code), 1500);
          }
        });
        socket.emit('queuing', { message: 'Mencari lawan…' });
      });

      // ── Board Update (sync multiplayer) ─────────────────────
      socket.on('board_update', (data) => {
        const player = this.players.get(socket.id);
        if (!player?.roomCode) return;
        // Kirim ke semua player lain di room
        socket.to(player.roomCode).emit('opp_state', {
          playerId: socket.id,
          state:    data.state,
        });
      });

      // ── Clear event (untuk battle bar duel) ─────────────────
      socket.on('clear', (data) => {
        const player = this.players.get(socket.id);
        if (!player?.roomCode) return;
        socket.to(player.roomCode).emit('opp_clear', {
          playerId: socket.id,
          combo:    data.combo,
          lines:    data.lines,
        });
      });

      // ── Penalty ke lawan ────────────────────────────────────
      socket.on('send_penalty', (data) => {
        const player = this.players.get(socket.id);
        if (!player?.roomCode) return;
        socket.to(player.roomCode).emit('penalty', {
          fromPlayer: socket.id,
          count:      data.count || 1,
        });
      });

      // ── Game Over (player kalah) ─────────────────────────────
      socket.on('game_over', (data) => {
        const player = this.players.get(socket.id);
        if (!player?.roomCode) return;
        const room = this.rooms.get(player.roomCode);
        if (!room) return;

        player.score = data.score || 0;

        if (room.mode === 'duel') {
          // Beritahu lawan bahwa mereka menang
          socket.to(player.roomCode).emit('game_end', {
            winner: socket.id,
            reason: 'opponent_gameover',
          });
        } else if (room.mode === 'br') {
          // Eliminasi dari BR
          this.io.to(player.roomCode).emit('player_elim', { id: socket.id });
          const alive = room.players.filter(p => !p.eliminated);
          if (alive.length <= 1) {
            const winner = alive[0];
            if (winner) {
              this.io.to(player.roomCode).emit('game_end', {
                winner:    winner.id,
                placement: 1,
              });
            }
          }
          player.eliminated = true;
        }
      });

      // ── Chat (opsional) ─────────────────────────────────────
      socket.on('chat', (data) => {
        const player = this.players.get(socket.id);
        if (!player?.roomCode) return;
        this.io.to(player.roomCode).emit('chat_msg', {
          from: player.username,
          msg:  (data.msg || '').slice(0, 100),
        });
      });

      // ── Disconnect ──────────────────────────────────────────
      socket.on('disconnect', () => {
        const player = this.players.get(socket.id);
        if (player?.roomCode) {
          const room = this.rooms.get(player.roomCode);
          if (room) {
            socket.to(player.roomCode).emit('player_left', { id: socket.id, username: player.username });
            room.players = room.players.filter(p => p.id !== socket.id);
            if (room.players.length === 0) this.rooms.delete(player.roomCode);
          }
        }
        this.players.delete(socket.id);
        this.matchmaking.removeFromQueue(socket.id);
        console.log(`[-] Pemain disconnect: ${socket.id}`);
      });
    });
  }

  _startGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.started) return;
    room.started = true;

    this.io.to(roomCode).emit('game_start', {
      mode:    room.mode,
      players: room.players.map(p => ({ id: p.id, username: p.username, avatar: p.avatar })),
    });
    console.log(`[Game] Dimulai di room ${roomCode}`);
  }

  _generateRoomCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    } while (this.rooms.has(code));
    return code;
  }
}

module.exports = SocketHandler;
