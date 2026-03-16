/**
 * server.js – Backend utama Block Blast Pro
 * Node.js + Express + Socket.io + SQLite
 *
 * Cara menjalankan:
 *   cd backend
 *   npm install
 *   node server.js
 *
 * Server berjalan di: http://localhost:3001
 * WebSocket di:       ws://localhost:3001
 */

const express   = require('express');
const http      = require('http');
const path      = require('path');
const cors      = require('cors');
const { Server } = require('socket.io');
const Database  = require('./database');
const SocketHandler = require('./socket');
const Matchmaking   = require('./matchmaking');

// ── Inisialisasi ─────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET','POST'],
  },
  transports: ['websocket','polling'],
});

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Database Init ─────────────────────────────────────────────
const db = new Database();
db.init();

// ── REST API ──────────────────────────────────────────────────

/**
 * GET /api/leaderboard?type=score&limit=20
 * Ambil data leaderboard
 */
app.get('/api/leaderboard', (req, res) => {
  const type  = req.query.type  || 'score';
  const limit = parseInt(req.query.limit) || 20;
  try {
    const data = db.getLeaderboard(type, limit);
    res.json({ success: true, data });
  } catch(e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

/**
 * POST /api/register
 * Daftar akun baru
 */
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ success: false, error: 'Username dan password wajib' });
  if (username.length < 3 || username.length > 20) return res.status(400).json({ success: false, error: 'Username 3-20 karakter' });

  const result = db.createUser(username, password);
  if (!result.success) return res.status(409).json(result);
  res.json(result);
});

/**
 * POST /api/login
 * Login akun
 */
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const result = db.loginUser(username, password);
  if (!result.success) return res.status(401).json(result);
  res.json(result);
});

/**
 * GET /api/profile/:username
 * Ambil profil pemain
 */
app.get('/api/profile/:username', (req, res) => {
  const user = db.getUser(req.params.username);
  if (!user) return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
  res.json({ success: true, profile: user });
});

/**
 * PUT /api/profile/:username
 * Update profil
 */
app.put('/api/profile/:username', (req, res) => {
  const { avatar, totalScore, wins, games, coins, rankId } = req.body;
  db.updateUser(req.params.username, { avatar, totalScore, wins, games, coins, rankId });
  res.json({ success: true });
});

/**
 * POST /api/score
 * Submit skor setelah game
 */
app.post('/api/score', (req, res) => {
  const { username, score, mode } = req.body;
  db.submitScore(username, score, mode || 'solo');
  res.json({ success: true });
});

// ── Health check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));

// ── Socket.io Setup ───────────────────────────────────────────
const matchmaking = new Matchmaking(io);
const socketHandler = new SocketHandler(io, db, matchmaking);
socketHandler.init();

// ── Start Server ──────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🎮 Block Blast Pro Server berjalan!`);
  console.log(`   HTTP:  http://localhost:${PORT}`);
  console.log(`   WS:    ws://localhost:${PORT}`);
  console.log(`   Frontend: buka http://localhost:${PORT} di browser\n`);
});

module.exports = { app, server, io };
