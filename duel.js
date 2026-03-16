/**
 * duel.js – Manajemen state duel 1v1
 * Block Blast Pro – Puzzle Arena
 */

class DuelRoom {
  constructor(roomCode, player1, player2, io) {
    this.code    = roomCode;
    this.io      = io;
    this.players = {
      [player1.id]: { ...player1, battleBar: 0, score: 0, alive: true },
      [player2.id]: { ...player2, battleBar: 0, score: 0, alive: true },
    };
    this.battleBar = 0; // -100 (p1 menang) .. +100 (p2 menang)
    this.ended     = false;
    this.startTime = Date.now();
  }

  /** Pemain melakukan clear, push battle bar */
  handleClear(playerId, combo, lines) {
    if (this.ended) return;
    const push  = (combo * 15) + (lines * 10);
    const ids   = Object.keys(this.players);
    const isP1  = playerId === ids[0];

    this.battleBar = Math.max(-100, Math.min(100, this.battleBar + (isP1 ? -push : push)));

    this.io.to(this.code).emit('battle_bar_update', { value: this.battleBar });

    // Cek threshold penalti
    if (Math.abs(this.battleBar) >= 60) {
      const penaltyPlayer = this.battleBar < 0 ? ids[1] : ids[0];
      const count         = Math.ceil(Math.abs(this.battleBar) / 25);
      this.io.to(penaltyPlayer).emit('penalty', { count });

      // Reset bar setelah penalti
      this.battleBar = this.battleBar > 0 ? 20 : -20;
      this.io.to(this.code).emit('battle_bar_update', { value: this.battleBar });
    }

    // Cek menang
    if (Math.abs(this.battleBar) >= 100) {
      const winner = this.battleBar < 0 ? ids[0] : ids[1];
      this._endGame(winner, 'battle_bar');
    }
  }

  handleGameOver(loserId) {
    if (this.ended) return;
    const ids    = Object.keys(this.players);
    const winner = ids.find(id => id !== loserId);
    this._endGame(winner, 'gameover');
  }

  _endGame(winnerId, reason) {
    if (this.ended) return;
    this.ended = true;
    const duration = Math.floor((Date.now() - this.startTime) / 1000);

    this.io.to(this.code).emit('game_end', {
      winner:   winnerId,
      reason,
      duration,
      scores:   Object.fromEntries(
        Object.entries(this.players).map(([id, p]) => [id, p.score])
      ),
    });
  }

  updateScore(playerId, score) {
    if (this.players[playerId]) this.players[playerId].score = score;
  }
}

module.exports = DuelRoom;
