/**
 * multiplayer.js – Sistem multiplayer (WebSocket / simulasi offline)
 * Block Blast Pro – Puzzle Arena
 *
 * Jika server tidak tersedia, mode simulasi otomatis aktif
 * dengan AI opponent untuk testing & demo.
 */

class MultiplayerManager {
  constructor() {
    this.ws          = null;
    this.roomCode    = null;
    this.mode        = null;  // 'duel' | 'br'
    this.playerId    = this._getOrCreateId();
    this.players     = {};
    this.isConnected = false;
    this.simMode     = true;  // Mode simulasi (tanpa server)

    // Callback hooks
    this.onRoomCreated   = () => {};
    this.onPlayerJoined  = () => {};
    this.onGameStart     = () => {};
    this.onOpponentState = () => {};
    this.onPenalty       = () => {};
    this.onPlayerElim    = () => {};
    this.onGameEnd       = () => {};
    this.onError         = () => {};

    // Duel state
    this.battleBarValue  = 0;   // -100..100, negatif = lawan menang
    this.duelEngine      = null;

    // BR state
    this.brPlayers       = [];
    this.brAlive         = 10;
    this.brMyRank        = 1;
    this.brSimInterval   = null;
  }

  _getOrCreateId() {
    let id = localStorage.getItem('bb_pid');
    if (!id) { id = 'p_' + Math.random().toString(36).slice(2,10); localStorage.setItem('bb_pid', id); }
    return id;
  }

  // ── Koneksi ke server WebSocket ───────────────────────────────
  connect(serverUrl) {
    if (this.isConnected) return;
    try {
      this.ws = new WebSocket(serverUrl);
      this.ws.onopen    = () => { this.isConnected = true; this.simMode = false; console.log('WS connected'); };
      this.ws.onmessage = (e) => this._handleMessage(JSON.parse(e.data));
      this.ws.onclose   = () => { this.isConnected = false; this.simMode = true; };
      this.ws.onerror   = ()  => { this.simMode = true; };
    } catch(e) {
      this.simMode = true;
    }
  }

  _send(data) {
    if (this.ws && this.isConnected && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  _handleMessage(msg) {
    switch(msg.type) {
      case 'room_created':  this.roomCode = msg.code; this.onRoomCreated(msg.code); break;
      case 'player_joined': this.onPlayerJoined(msg.player); break;
      case 'game_start':    this.onGameStart(msg); break;
      case 'opp_state':     this.onOpponentState(msg.state); break;
      case 'penalty':       this.onPenalty(msg); break;
      case 'player_elim':   this.onPlayerElim(msg); break;
      case 'game_end':      this.onGameEnd(msg); break;
      case 'error':         this.onError(msg.message); break;
    }
  }

  // ── Room Management ───────────────────────────────────────────
  createRoom(mode) {
    this.mode = mode;
    if (!this.simMode) {
      this._send({ type: 'create_room', mode, playerId: this.playerId, profile: Profile.get() });
      return;
    }
    // Simulasi: buat kode room acak
    this.roomCode = Math.random().toString(36).slice(2,8).toUpperCase();
    setTimeout(() => this.onRoomCreated(this.roomCode), 200);
  }

  joinRoom(code, mode) {
    this.mode = mode;
    this.roomCode = code.toUpperCase();
    if (!this.simMode) {
      this._send({ type: 'join_room', code: this.roomCode, playerId: this.playerId, profile: Profile.get() });
      return;
    }
    // Simulasi: langsung mulai duel dengan AI
    setTimeout(() => {
      this.onPlayerJoined({
        username: this._getAIName(),
        avatar:   this._getAIAvatar(),
        id:       'ai_opponent',
      });
      setTimeout(() => this._simStartDuel(), 1500);
    }, 800);
  }

  quickMatch(mode) {
    this.mode = mode;
    if (!this.simMode) {
      this._send({ type: 'quick_match', mode, playerId: this.playerId, profile: Profile.get() });
      return;
    }
    // Simulasi: langsung temukan lawan
    setTimeout(() => {
      this.onPlayerJoined({
        username: this._getAIName(),
        avatar:   this._getAIAvatar(),
        id:       'ai_' + Math.random().toString(36).slice(2,6),
      });
      setTimeout(() => {
        if (mode === 'duel') this._simStartDuel();
        else if (mode === 'br') this._simStartBR();
      }, 1500);
    }, Math.random() * 1500 + 500);
  }

  // ── Duel Logic ────────────────────────────────────────────────
  _simStartDuel() {
    this.battleBarValue = 0;
    this.onGameStart({
      mode:       'duel',
      opponent: {
        username: this._lastOppName || this._getAIName(),
        avatar:   this._lastOppAvatar || '🤖',
      },
    });
    // Mulai simulasi papan lawan
    this._simOppDuelInterval = setInterval(() => {
      if (!window._duelEngineMe) return;
      // AI lawan bermain otomatis dan mengirim state fiktif
      const fakeBoard = this._generateFakeBoard();
      this.onOpponentState({ board: fakeBoard, score: Math.floor(Math.random() * 100) });
    }, 3000);
  }

  /** Dipanggil saat pemain lokal melakukan clear */
  reportClear(comboCnt, linesCleared) {
    if (!this.simMode) {
      this._send({ type: 'clear', roomCode: this.roomCode, combo: comboCnt, lines: linesCleared });
    }

    // Update battle bar
    const push = comboCnt * 15 + linesCleared * 10;
    this._updateBattleBar(-push); // negatif = dorong ke lawan (kita menang)
  }

  _updateBattleBar(delta) {
    this.battleBarValue = Math.max(-100, Math.min(100, this.battleBarValue + delta));
    UI.updateBattleBar(this.battleBarValue);

    // Cek apakah bar penuh
    if (this.battleBarValue <= -100) {
      // Kita menang – lawan dapat penalti fatal
      clearInterval(this._simOppDuelInterval);
      setTimeout(() => this.onGameEnd({ winner: 'me', reason: 'battle_bar' }), 500);
    } else if (this.battleBarValue >= 100) {
      // Kita kalah
      clearInterval(this._simOppDuelInterval);
      setTimeout(() => this.onGameEnd({ winner: 'opponent', reason: 'battle_bar' }), 500);
    } else if (this.battleBarValue >= 50) {
      // Kita mendapat penalti (simulasi)
      this.onPenalty({ count: Math.ceil(this.battleBarValue / 30) });
      this.battleBarValue = 20; // reset setelah penalti
    }

    // Simulasi: lawan juga push balik secara acak
    if (this.simMode) {
      setTimeout(() => {
        const aiPush = Math.random() * 20 + 5;
        this.battleBarValue = Math.min(100, this.battleBarValue + aiPush);
        UI.updateBattleBar(this.battleBarValue);
      }, Math.random() * 2000 + 1000);
    }
  }

  endDuel() {
    clearInterval(this._simOppDuelInterval);
    this._send({ type: 'end_duel', roomCode: this.roomCode });
  }

  // ── Battle Royale ─────────────────────────────────────────────
  _simStartBR() {
    const aiNames   = Array.from({length: 9}, () => this._getAIName());
    const aiAvatars = Array.from({length: 9}, () => this._getAIAvatar());

    this.brPlayers = [
      { id: 'me', username: Profile.get().username, avatar: Profile.get().avatar, alive: true },
      ...aiNames.map((name, i) => ({
        id:       'ai_' + i,
        username: name,
        avatar:   aiAvatars[i],
        alive:    true,
      })),
    ];
    this.brAlive = 10;
    this.brMyRank = 10;

    this.onGameStart({
      mode:    'br',
      players: this.brPlayers,
    });

    // Simulasi eliminasi pemain lain satu per satu
    let elimIdx = 0;
    const elimOrder = this.brPlayers.filter(p => p.id !== 'me').map(p => p.id);
    // Acak urutan
    for (let i = elimOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [elimOrder[i], elimOrder[j]] = [elimOrder[j], elimOrder[i]];
    }

    this.brSimInterval = setInterval(() => {
      if (elimIdx >= elimOrder.length) {
        clearInterval(this.brSimInterval);
        return;
      }
      const pid = elimOrder[elimIdx++];
      const pl  = this.brPlayers.find(p => p.id === pid);
      if (pl) {
        pl.alive = false;
        this.brAlive--;
        this.brMyRank = this.brAlive;
        this.onPlayerElim({ id: pid });

        if (this.brAlive <= 1) {
          clearInterval(this.brSimInterval);
          setTimeout(() => this.onGameEnd({ winner: 'me', placement: 1 }), 800);
        }
      }
    }, Math.random() * 5000 + 3000);
  }

  stopBR() {
    clearInterval(this.brSimInterval);
    this._send({ type: 'leave_br', roomCode: this.roomCode });
  }

  // ── Helpers ───────────────────────────────────────────────────
  _getAIName() {
    const names = [
      'NeonBot','BlockAI','QuickFox','ShadowPro','GridMaster',
      'PuzzleAce','TurboBlock','CyberPlay','MatrixPro','ZapBlock',
      'DeepGrid','StarBot','FlashPro','NightBot','ZenPuzzle',
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  _getAIAvatar() {
    const avs = ['🤖','👾','🦊','🐼','🦁','🐯','🎮','⚡','🔥','💎','🚀','🌟'];
    const av  = avs[Math.floor(Math.random() * avs.length)];
    this._lastOppName   = this._lastOppName   || this._getAIName();
    this._lastOppAvatar = this._lastOppAvatar || av;
    return av;
  }

  _generateFakeBoard() {
    // Papan acak untuk preview lawan
    const board = Array.from({length: 9}, () => Array(9).fill(0));
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (Math.random() < 0.35) {
          board[r][c] = Math.floor(Math.random() * 8) + 1;
        }
      }
    }
    return board;
  }

  reset() {
    clearInterval(this._simOppDuelInterval);
    clearInterval(this.brSimInterval);
    this.battleBarValue = 0;
    this.brPlayers      = [];
    this.brAlive        = 10;
    this._lastOppName   = null;
    this._lastOppAvatar = null;
  }
}

// Ekspor global
window.MultiplayerManager = MultiplayerManager;
window.MP                 = new MultiplayerManager();
// Coba connect ke server (opsional, fallback ke sim)
// MP.connect('ws://localhost:3001');
