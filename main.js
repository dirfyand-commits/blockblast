/**
 * main.js – Controller utama aplikasi
 * Menghubungkan semua modul: game, UI, profil, multiplayer, shop, leaderboard
 * Block Blast Pro – Puzzle Arena
 */

// ────────────────────────────────────────────────────────────────
// LOADING SCREEN
// ────────────────────────────────────────────────────────────────
(function initLoading() {
  const bar  = document.getElementById('loading-bar');
  const tips = [
    'Memuat engine game…','Menyiapkan blok-blok…',
    'Menghubungkan server…','Menyiapkan musik…',
    'Hampir siap…','Selamat datang!',
  ];
  let pct = 0, tipIdx = 0;
  const interval = setInterval(() => {
    pct += Math.random() * 18 + 8;
    if (pct > 100) pct = 100;
    bar.style.width = pct + '%';
    document.getElementById('loading-tip').textContent = tips[tipIdx++ % tips.length];
    if (pct >= 100) {
      clearInterval(interval);
      setTimeout(startApp, 400);
    }
  }, 250);
})();

// ────────────────────────────────────────────────────────────────
// APP INIT
// ────────────────────────────────────────────────────────────────
function startApp() {
  UI.showScreen('menu');
  UI.initMenuParticles();
  Profile.refresh();

  // Cek daily reward
  const dailyData = Profile.claimDailyReward();
  if (dailyData) {
    setTimeout(() => UI.showDailyReward(dailyData), 600);
  }

  // Leaderboard init
  Leaderboard.render('score');
}

// ────────────────────────────────────────────────────────────────
// DAILY REWARD CLAIM
// ────────────────────────────────────────────────────────────────
document.getElementById('btn-claim-daily')?.addEventListener('click', () => {
  Sound.playClick();
  UI.hideDailyReward();
  Profile.refresh();
  UI.showToast('🎁 Reward login harian diklaim!', 'success');
});

// ────────────────────────────────────────────────────────────────
// AUDIO BUTTONS
// ────────────────────────────────────────────────────────────────
document.getElementById('btn-toggle-music')?.addEventListener('click', () => {
  const enabled = Sound.toggleMusic();
  document.getElementById('btn-toggle-music').textContent = enabled ? '🎵' : '🔇';
  document.getElementById('btn-toggle-music').classList.toggle('muted', !enabled);
});

document.getElementById('btn-toggle-sfx')?.addEventListener('click', () => {
  const enabled = Sound.toggleSFX();
  document.getElementById('btn-toggle-sfx').textContent = enabled ? '🔊' : '🔕';
  document.getElementById('btn-toggle-sfx').classList.toggle('muted', !enabled);
});

// Sync audio btn states
function syncAudioBtns() {
  const mb = document.getElementById('btn-toggle-music');
  const sb = document.getElementById('btn-toggle-sfx');
  if (mb) { mb.textContent = Sound.musicEnabled ? '🎵' : '🔇'; mb.classList.toggle('muted', !Sound.musicEnabled); }
  if (sb) { sb.textContent = Sound.sfxEnabled   ? '🔊' : '🔕'; sb.classList.toggle('muted', !Sound.sfxEnabled);   }
}
syncAudioBtns();

// ────────────────────────────────────────────────────────────────
// MENU BUTTONS
// ────────────────────────────────────────────────────────────────
document.getElementById('btn-play-solo')?.addEventListener('click', () => {
  Sound.init();
  Sound.playClick();
  startSoloGame();
});

document.getElementById('btn-play-duel')?.addEventListener('click', () => {
  Sound.init();
  Sound.playClick();
  openLobby('duel');
});

document.getElementById('btn-play-br')?.addEventListener('click', () => {
  Sound.init();
  Sound.playClick();
  openLobby('br');
});

document.getElementById('btn-leaderboard')?.addEventListener('click', () => {
  Sound.playClick();
  Leaderboard.open();
});

document.getElementById('btn-shop')?.addEventListener('click', () => {
  Sound.playClick();
  Shop.open();
});

// ── Player card click = open profile ──────────────────────────
document.getElementById('player-card')?.addEventListener('click', () => {
  openProfileModal();
});
document.getElementById('btn-edit-profile')?.addEventListener('click', (e) => {
  e.stopPropagation();
  openProfileModal();
});

// ────────────────────────────────────────────────────────────────
// SOLO GAME
// ────────────────────────────────────────────────────────────────
let soloGame = null;

function startSoloGame() {
  UI.showScreen('game');

  const canvas = document.getElementById('game-canvas');
  // Responsive canvas size
  const vw = Math.min(window.innerWidth, 440);
  const size = Math.min(vw - 32, 420);
  canvas.width = canvas.height = size;

  // Get equipped board theme
  const boardTheme = Shop.getEquippedBoardTheme();

  if (soloGame) soloGame.destroy();

  soloGame = new GameEngine(canvas, {
    boardTheme,
    onScoreUpdate: (score) => {
      UI.updateScore(score, 'hud-score');
      const best = Math.max(score, parseInt(localStorage.getItem('bb_best') || 0));
      localStorage.setItem('bb_best', best);
      UI.updateScore(best, 'hud-best');
    },
    onCombo: (combo, score) => {
      UI.updateComboDisplay(combo);
      UI.showComboEffect(combo, score);
    },
    onClear: ({ rows, cols, combo }) => {
      if (combo < 2) UI.updateComboDisplay(0);
    },
    onGameOver: ({ score, linesCleared }) => {
      const result = Profile.recordGame(score);
      showGameOver(score, result);
    },
  });

  // Setup tray slots
  const slots = [0,1,2].map(i => document.getElementById(`tray-${i}`));
  soloGame.setupTray(slots);
  soloGame.startNewGame();

  window._activeGame = soloGame;

  // HUD best score
  const best = parseInt(localStorage.getItem('bb_best') || 0);
  UI.updateScore(best, 'hud-best');

  Profile.refresh();
}

function showGameOver(score, result) {
  document.getElementById('go-score').textContent  = score.toLocaleString();
  document.getElementById('go-best').textContent   = Math.max(score, parseInt(localStorage.getItem('bb_best') || 0)).toLocaleString();
  document.getElementById('go-xp').textContent     = '+' + result.xpGained;
  document.getElementById('go-coins').textContent  = '+' + result.coinGained;

  if (result.rankChanged) {
    UI.showRankUp(result.newRank);
  } else {
    document.getElementById('rank-up-banner')?.classList.add('hidden');
  }

  document.getElementById('game-over-panel').classList.remove('hidden');
  Profile.refresh();
}

document.getElementById('btn-play-again')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('game-over-panel').classList.add('hidden');
  soloGame.startNewGame();
});

document.getElementById('btn-go-menu')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('game-over-panel').classList.add('hidden');
  soloGame?.destroy();
  UI.showScreen('menu');
  Profile.refresh();
});

document.getElementById('btn-game-menu')?.addEventListener('click', () => {
  Sound.playClick();
  if (confirm('Keluar ke menu utama? Skor akan disimpan.')) {
    if (soloGame && !soloGame.isGameOver) {
      const result = Profile.recordGame(soloGame.score);
      showGameOver(soloGame.score, result);
    } else {
      soloGame?.destroy();
      UI.showScreen('menu');
    }
  }
});

// ────────────────────────────────────────────────────────────────
// LOBBY / MULTIPLAYER
// ────────────────────────────────────────────────────────────────
let lobbyMode = 'duel';

function openLobby(mode) {
  lobbyMode = mode;
  UI.resetLobby();
  document.getElementById('lobby-title').textContent = mode === 'duel' ? '⚔️ Mode Duel' : '🔥 Battle Royale';
  document.getElementById('modal-lobby').classList.remove('hidden');
}

document.getElementById('btn-close-lobby')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('modal-lobby').classList.add('hidden');
  UI.resetLobby();
  MP.reset();
});

document.getElementById('btn-create-room')?.addEventListener('click', () => {
  Sound.playClick();
  const p = Profile.get();
  MP.onRoomCreated = (code) => {
    UI.showLobbyWaiting(code, [{ username: p.username, avatar: p.avatar }]);
  };
  MP.onPlayerJoined = (player) => {
    MP._lastOppName   = player.username;
    MP._lastOppAvatar = player.avatar;
    const p2 = Profile.get();
    UI.showLobbyWaiting(MP.roomCode, [
      { username: p2.username, avatar: p2.avatar },
      { username: player.username, avatar: player.avatar },
    ]);
    setTimeout(() => startMultiplayerGame(lobbyMode, player), 1200);
  };
  MP.createRoom(lobbyMode);
});

document.getElementById('btn-join-room')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('lobby-options').classList.add('hidden');
  document.getElementById('lobby-room-join').classList.remove('hidden');
});

document.getElementById('btn-join-submit')?.addEventListener('click', () => {
  Sound.playClick();
  const code = document.getElementById('room-code-input').value.trim();
  if (code.length < 4) { document.getElementById('lobby-msg').textContent = 'Kode tidak valid'; return; }
  setupMPCallbacks();
  MP.joinRoom(code, lobbyMode);
  document.getElementById('lobby-room-join').classList.add('hidden');
  document.getElementById('lobby-waiting').classList.remove('hidden');
  document.getElementById('display-room-code').textContent = code.toUpperCase();
});

document.getElementById('btn-quick-match')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('lobby-options').classList.add('hidden');
  const waitEl = document.getElementById('lobby-waiting');
  waitEl.classList.remove('hidden');
  document.getElementById('display-room-code').textContent = '⏳...';
  setupMPCallbacks();
  MP.quickMatch(lobbyMode);
});

function setupMPCallbacks() {
  MP.onRoomCreated = (code) => {
    document.getElementById('display-room-code').textContent = code;
  };
  MP.onPlayerJoined = (player) => {
    MP._lastOppName   = player.username;
    MP._lastOppAvatar = player.avatar;
    UI.showToast(`${player.avatar} ${player.username} bergabung!`, 'info');
  };
  MP.onGameStart = (data) => {
    document.getElementById('modal-lobby').classList.add('hidden');
    UI.resetLobby();
    if (data.mode === 'duel') startDuelGame(data);
    else if (data.mode === 'br') startBRGame(data);
  };
}

// ────────────────────────────────────────────────────────────────
// DUEL GAME
// ────────────────────────────────────────────────────────────────
let duelGameMe = null;

function startMultiplayerGame(mode, opponent) {
  document.getElementById('modal-lobby').classList.add('hidden');
  UI.resetLobby();
  if (mode === 'duel') {
    startDuelGame({ opponent });
  } else {
    MP.quickMatch('br');
  }
}

function startDuelGame(data) {
  UI.showScreen('duel');

  const opp = data.opponent || { username: MP._lastOppName || 'Lawan', avatar: MP._lastOppAvatar || '🤖' };
  const me  = Profile.get();

  // HUD
  document.getElementById('d-my-name').textContent   = me.username;
  document.getElementById('d-my-avatar').textContent = me.avatar;
  UI.updateDuelHUD(0, 0, opp.username, opp.avatar);
  UI.updateBattleBar(0);

  // My board canvas
  const myCanvas  = document.getElementById('duel-canvas-me');
  const oppCanvas = document.getElementById('duel-canvas-opp');
  const vw = Math.min(window.innerWidth / 2 - 20, 300);
  const sz = Math.min(vw, 270);
  myCanvas.width  = myCanvas.height  = sz;
  oppCanvas.width = oppCanvas.height = sz;

  if (duelGameMe) duelGameMe.destroy();

  duelGameMe = new GameEngine(myCanvas, {
    boardTheme: Shop.getEquippedBoardTheme(),
    onScoreUpdate: (score) => {
      document.getElementById('d-my-score').textContent = score.toLocaleString();
    },
    onClear: ({ rows, cols, combo }) => {
      UI.updateComboDisplay(combo);
      if (combo >= 2) UI.showComboEffect(combo, 0);
      // Kirim ke lawan
      MP.reportClear(combo, rows.length + cols.length);
      UI.flashOppBoard();
    },
    onGameOver: ({ score }) => {
      MP.endDuel();
      const result = Profile.recordDuel(false, score);
      showDuelResult(false, score, result);
    },
  });

  const slots = [0,1,2].map(i => document.getElementById(`duel-tray-${i}`));
  duelGameMe.setupTray(slots);
  duelGameMe.startNewGame();
  window._duelEngineMe = duelGameMe;

  // Opponent board engine (display only)
  const oppEngine = new GameEngine(oppCanvas, {
    boardTheme: 'galaxy',
    isOpponent: true,
  });
  oppEngine.startNewGame();
  window._duelEngineOpp = oppEngine;

  // MP callbacks
  MP.onOpponentState = (state) => {
    oppEngine.setStateFromRemote(state);
  };
  MP.onPenalty = (data) => {
    duelGameMe.addTrashRow(data.count || 1);
    UI.showPenaltyEffect(data.count || 1);
    Sound.playPenalty();
  };
  MP.onGameEnd = (data) => {
    const won    = data.winner === 'me';
    const score  = duelGameMe.score;
    const result = Profile.recordDuel(won, score);
    showDuelResult(won, score, result);
  };
}

function showDuelResult(won, score, result) {
  duelGameMe?.destroy();
  document.getElementById('dr-emoji').textContent  = won ? '🏆' : '💔';
  document.getElementById('dr-title').textContent  = won ? 'MENANG!' : 'KALAH!';
  document.getElementById('dr-title').style.color  = won ? 'var(--neon-green)' : 'var(--neon-red)';
  document.getElementById('dr-score').textContent  = score.toLocaleString();
  document.getElementById('dr-xp').textContent     = '+' + result.xpGained;
  document.getElementById('dr-coins').textContent  = '+' + result.coinGained;
  document.getElementById('duel-result').classList.remove('hidden');
  if (won) Sound.playWin(); else Sound.playGameOver();
  if (result.rankChanged) UI.showRankUp(result.newRank);
  Profile.refresh();
}

document.getElementById('btn-duel-again')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('duel-result').classList.add('hidden');
  MP.reset();
  openLobby('duel');
});

document.getElementById('btn-duel-menu')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('duel-result').classList.add('hidden');
  duelGameMe?.destroy();
  MP.reset();
  UI.showScreen('menu');
  Profile.refresh();
});

// ────────────────────────────────────────────────────────────────
// BATTLE ROYALE
// ────────────────────────────────────────────────────────────────
let brGame = null;

function startBRGame(data) {
  UI.showScreen('br');

  if (data.players) {
    UI.renderBRPlayerList(data.players);
  }

  const canvas = document.getElementById('br-canvas');
  const vw = Math.min(window.innerWidth, 440);
  const size = Math.min(vw - 32, 380);
  canvas.width = canvas.height = size;

  if (brGame) brGame.destroy();

  brGame = new GameEngine(canvas, {
    boardTheme: Shop.getEquippedBoardTheme(),
    onScoreUpdate: (score) => {
      document.getElementById('br-score').textContent = score.toLocaleString();
    },
    onClear: ({ combo }) => {
      if (combo >= 2) UI.showComboEffect(combo, 0);
    },
    onGameOver: ({ score }) => {
      // Dieliminasi
      MP.stopBR();
      const placement = MP.brMyRank || 5;
      const result    = Profile.recordBR(placement, score);
      showBRResult(placement, score, result);
    },
  });

  const slots = [0,1,2].map(i => document.getElementById(`br-tray-${i}`));
  brGame.setupTray(slots);
  brGame.startNewGame();

  UI.updateBRAlive(10);

  // MP callbacks
  MP.onPlayerElim = ({ id }) => {
    UI.eliminateBRPlayer(id);
    UI.updateBRAlive(MP.brAlive);
    Sound.playElimination();
    UI.showToast(`💀 Pemain eliminasi! ${MP.brAlive} tersisa`, 'info', 2000);
  };
  MP.onGameEnd = ({ winner, placement }) => {
    const won    = winner === 'me';
    const score  = brGame.score;
    const place  = won ? 1 : (placement || 2);
    const result = Profile.recordBR(place, score);
    showBRResult(place, score, result);
  };
}

function showBRResult(placement, score, result) {
  brGame?.destroy();
  const won = placement === 1;
  document.getElementById('br-emoji').textContent       = won ? '🏆' : '💀';
  document.getElementById('br-title').textContent       = won ? 'VICTORY ROYALE!' : `#${placement} Tempat`;
  document.getElementById('br-rank-final').textContent  = '#' + placement;
  document.getElementById('br-score-final').textContent = score.toLocaleString();
  document.getElementById('br-coins-final').textContent = '+' + result.coinGained;
  document.getElementById('br-result').classList.remove('hidden');
  if (won) Sound.playWin();
  if (result.rankChanged) UI.showRankUp(result.newRank);
  Profile.refresh();
}

document.getElementById('btn-br-again')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('br-result').classList.add('hidden');
  MP.reset();
  openLobby('br');
});

document.getElementById('btn-br-main-menu')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('br-result').classList.add('hidden');
  brGame?.destroy();
  MP.reset();
  UI.showScreen('menu');
  Profile.refresh();
});

document.getElementById('btn-br-menu')?.addEventListener('click', () => {
  Sound.playClick();
  if (confirm('Keluar dari Battle Royale?')) {
    brGame?.destroy();
    MP.stopBR();
    UI.showScreen('menu');
  }
});

// ────────────────────────────────────────────────────────────────
// PROFILE MODAL
// ────────────────────────────────────────────────────────────────
function openProfileModal() {
  const p = Profile.get();
  document.getElementById('profile-username-input').value = p.username;
  UI.renderAvatarPicker(p.avatar);
  Profile._refreshUI();
  document.getElementById('modal-profile').classList.remove('hidden');
}

document.getElementById('btn-save-profile')?.addEventListener('click', () => {
  Sound.playClick();
  const username = document.getElementById('profile-username-input').value.trim();
  const avatar   = UI.getSelectedAvatar() || Profile.get().avatar;
  Profile.updateBasic(username, avatar);
  document.getElementById('modal-profile').classList.add('hidden');
  UI.showToast('✅ Profil disimpan!', 'success');
  Profile.refresh();
});

document.getElementById('btn-close-profile')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('modal-profile').classList.add('hidden');
});

// ────────────────────────────────────────────────────────────────
// LOGIN MODAL
// ────────────────────────────────────────────────────────────────
// Tab switch
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    Sound.playClick();
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('tab-login').classList.toggle('active',  tab === 'login');
    document.getElementById('tab-login').classList.toggle('hidden',  tab !== 'login');
    document.getElementById('tab-register').classList.toggle('active',  tab === 'register');
    document.getElementById('tab-register').classList.toggle('hidden',  tab !== 'register');
  });
});

document.getElementById('btn-login-guest')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('modal-login')?.classList.add('hidden');
  Profile.profile.isGuest = true;
  Profile.save();
  Profile.refresh();
});

document.getElementById('btn-login-submit')?.addEventListener('click', () => {
  Sound.playClick();
  const username = document.getElementById('login-username')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  if (!username || !password) { document.getElementById('login-msg').textContent = 'Isi semua kolom'; return; }

  // Simulasi login (localStorage based)
  const saved = localStorage.getItem('bb_account_' + username);
  if (!saved) { document.getElementById('login-msg').textContent = 'Akun tidak ditemukan'; return; }
  const acc = JSON.parse(saved);
  if (acc.password !== btoa(password)) { document.getElementById('login-msg').textContent = 'Password salah'; return; }

  Profile.profile = { ...acc.profile };
  Profile.save();
  Profile.refresh();
  document.getElementById('modal-login').classList.add('hidden');
  UI.showToast(`👋 Selamat datang, ${username}!`, 'success');
});

document.getElementById('btn-register-submit')?.addEventListener('click', () => {
  Sound.playClick();
  const username = document.getElementById('reg-username')?.value.trim();
  const password = document.getElementById('reg-password')?.value;
  const confirm  = document.getElementById('reg-confirm')?.value;
  const msg      = document.getElementById('login-msg');

  if (!username || username.length < 3) { msg.textContent = 'Username minimal 3 karakter'; return; }
  if (!password || password.length < 4)  { msg.textContent = 'Password minimal 4 karakter'; return; }
  if (password !== confirm)              { msg.textContent = 'Password tidak sama'; return; }
  if (localStorage.getItem('bb_account_' + username)) { msg.textContent = 'Username sudah dipakai'; return; }

  const newProfile = { ...DEFAULT_PROFILE, username, isGuest: false };
  localStorage.setItem('bb_account_' + username, JSON.stringify({
    password: btoa(password),
    profile:  newProfile,
  }));
  Profile.profile = newProfile;
  Profile.save();
  Profile.refresh();
  document.getElementById('modal-login').classList.add('hidden');
  UI.showToast(`🎉 Akun dibuat! Selamat datang, ${username}!`, 'success');
});

document.getElementById('btn-close-login')?.addEventListener('click', () => {
  Sound.playClick();
  document.getElementById('modal-login')?.classList.add('hidden');
});

// ────────────────────────────────────────────────────────────────
// LEADERBOARD MODAL
// ────────────────────────────────────────────────────────────────
document.querySelectorAll('.lb-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    Sound.playClick();
    document.querySelectorAll('.lb-tab').forEach(b => b.classList.toggle('active', b === btn));
    Leaderboard.render(btn.dataset.lb);
  });
});

document.getElementById('btn-close-lb')?.addEventListener('click', () => {
  Sound.playClick();
  Leaderboard.close();
});

// ────────────────────────────────────────────────────────────────
// SHOP MODAL
// ────────────────────────────────────────────────────────────────
document.querySelectorAll('.shop-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    Sound.playClick();
    document.querySelectorAll('.shop-tab').forEach(b => b.classList.toggle('active', b === btn));
    Shop.renderShopGrid(btn.dataset.cat);
  });
});

document.getElementById('btn-close-shop')?.addEventListener('click', () => {
  Sound.playClick();
  Shop.close();
});

// ────────────────────────────────────────────────────────────────
// RESPONSIVE CANVAS RESIZE
// ────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  // Hanya resize jika game sedang aktif
  if (UI.currentScreen === 'game' && soloGame && !soloGame.isGameOver) {
    const canvas = document.getElementById('game-canvas');
    const vw   = Math.min(window.innerWidth, 440);
    const size = Math.min(vw - 32, 420);
    if (canvas.width !== size) {
      canvas.width = canvas.height = size;
      soloGame.cellSize = Math.floor(size / soloGame.cols);
    }
  }
});

// ────────────────────────────────────────────────────────────────
// PREVENT DEFAULT SCROLL ON GAME AREA
// ────────────────────────────────────────────────────────────────
document.addEventListener('touchmove', (e) => {
  if (e.target.tagName === 'CANVAS') e.preventDefault();
}, { passive: false });

// ────────────────────────────────────────────────────────────────
// GLOBAL CLICK SOUND
// ────────────────────────────────────────────────────────────────
document.querySelectorAll('.btn-menu, .btn-primary, .btn-secondary').forEach(btn => {
  btn.addEventListener('click', () => Sound.init());
});

console.log('🎮 Block Blast Pro – Game dimuat!');
