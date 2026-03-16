/**
 * database.js – Database handler menggunakan SQLite (better-sqlite3)
 * Block Blast Pro – Puzzle Arena
 */

const crypto = require('crypto');

class Database {
  constructor() {
    this.db = null;
  }

  init() {
    try {
      const BetterSQLite = require('better-sqlite3');
      this.db = new BetterSQLite('blockblast.db');
      this._createTables();
      console.log('✅ Database SQLite terhubung');
    } catch(e) {
      console.warn('⚠️ SQLite tidak tersedia, menggunakan in-memory storage');
      this._useMemory();
    }
  }

  _useMemory() {
    // Fallback ke Map jika SQLite tidak ada
    this._users  = new Map();
    this._scores = [];
    this.db = null;
  }

  _createTables() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        username    TEXT UNIQUE NOT NULL,
        password    TEXT NOT NULL,
        avatar      TEXT DEFAULT '👾',
        level       INTEGER DEFAULT 1,
        xp          INTEGER DEFAULT 0,
        totalScore  INTEGER DEFAULT 0,
        games       INTEGER DEFAULT 0,
        wins        INTEGER DEFAULT 0,
        coins       INTEGER DEFAULT 500,
        rankId      TEXT DEFAULT 'bronze',
        dailyStreak INTEGER DEFAULT 0,
        lastLogin   TEXT,
        owned       TEXT DEFAULT '["skin_default","board_default","avatar_default"]',
        equipped    TEXT DEFAULT '{"skin":"skin_default","board":"board_default"}',
        createdAt   TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS scores (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        username   TEXT NOT NULL,
        score      INTEGER NOT NULL,
        mode       TEXT DEFAULT 'solo',
        createdAt  TEXT DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_scores_username ON scores(username);
      CREATE INDEX IF NOT EXISTS idx_scores_score    ON scores(score DESC);
    `);
  }

  _hashPassword(password) {
    return crypto.createHash('sha256').update(password + 'blockblast_salt').digest('hex');
  }

  // ── User Management ───────────────────────────────────────────
  createUser(username, password) {
    const hashed = this._hashPassword(password);

    if (this.db) {
      try {
        this.db.prepare(`
          INSERT INTO users (username, password) VALUES (?, ?)
        `).run(username, hashed);
        return { success: true, message: 'Akun berhasil dibuat' };
      } catch(e) {
        if (e.message.includes('UNIQUE')) return { success: false, error: 'Username sudah dipakai' };
        return { success: false, error: e.message };
      }
    } else {
      if (this._users.has(username)) return { success: false, error: 'Username sudah dipakai' };
      this._users.set(username, { username, password: hashed, avatar: '👾', level: 1, xp: 0,
        totalScore: 0, games: 0, wins: 0, coins: 500, rankId: 'bronze' });
      return { success: true };
    }
  }

  loginUser(username, password) {
    const hashed = this._hashPassword(password);

    if (this.db) {
      const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user) return { success: false, error: 'User tidak ditemukan' };
      if (user.password !== hashed) return { success: false, error: 'Password salah' };
      const { password: _, ...safeUser } = user;
      return { success: true, profile: safeUser };
    } else {
      const user = this._users.get(username);
      if (!user) return { success: false, error: 'User tidak ditemukan' };
      if (user.password !== hashed) return { success: false, error: 'Password salah' };
      return { success: true, profile: { ...user, password: undefined } };
    }
  }

  getUser(username) {
    if (this.db) {
      const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
      if (!user) return null;
      const { password: _, ...safeUser } = user;
      return safeUser;
    }
    const user = this._users.get(username);
    return user ? { ...user, password: undefined } : null;
  }

  updateUser(username, data) {
    if (this.db) {
      const fields = Object.keys(data).filter(k => data[k] !== undefined);
      if (fields.length === 0) return;
      const setClause = fields.map(f => `${f} = ?`).join(', ');
      const values    = fields.map(f => data[f]);
      this.db.prepare(`UPDATE users SET ${setClause} WHERE username = ?`).run(...values, username);
    } else {
      const user = this._users.get(username);
      if (user) this._users.set(username, { ...user, ...data });
    }
  }

  // ── Score Management ──────────────────────────────────────────
  submitScore(username, score, mode = 'solo') {
    if (this.db) {
      this.db.prepare('INSERT INTO scores (username, score, mode) VALUES (?, ?, ?)').run(username, score, mode);
      // Update best score di users
      this.db.prepare(`
        UPDATE users SET totalScore = totalScore + ? WHERE username = ?
      `).run(score, username);
    } else {
      this._scores.push({ username, score, mode, createdAt: new Date().toISOString() });
    }
  }

  // ── Leaderboard ───────────────────────────────────────────────
  getLeaderboard(type, limit = 20) {
    if (this.db) {
      switch(type) {
        case 'score':
          return this.db.prepare(`
            SELECT username, avatar, totalScore as score, rankId
            FROM users ORDER BY totalScore DESC LIMIT ?
          `).all(limit);
        case 'wins':
          return this.db.prepare(`
            SELECT username, avatar, wins, rankId
            FROM users ORDER BY wins DESC LIMIT ?
          `).all(limit);
        case 'rank': {
          const rankOrder = "CASE rankId WHEN 'master' THEN 6 WHEN 'diamond' THEN 5 WHEN 'platinum' THEN 4 WHEN 'gold' THEN 3 WHEN 'silver' THEN 2 ELSE 1 END";
          return this.db.prepare(`
            SELECT username, avatar, totalScore as score, wins, rankId
            FROM users ORDER BY ${rankOrder} DESC, totalScore DESC LIMIT ?
          `).all(limit);
        }
        default:
          return [];
      }
    } else {
      const users = Array.from(this._users.values());
      if (type === 'wins') return users.sort((a,b) => b.wins - a.wins).slice(0, limit);
      return users.sort((a,b) => b.totalScore - a.totalScore).slice(0, limit);
    }
  }
}

module.exports = Database;
