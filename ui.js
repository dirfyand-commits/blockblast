/**
 * ui.js – Sistem UI, navigasi, modal, toast, animasi
 * Block Blast Pro – Puzzle Arena
 */

class UIManager {
  constructor() {
    this.currentScreen = 'loading';
  }

  // ── Screen Navigation ────────────────────────────────────────
  showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => {
      s.classList.remove('active');
      s.classList.add('hidden');
    });
    const screen = document.getElementById(id + '-screen');
    if (screen) {
      screen.classList.remove('hidden');
      screen.classList.add('active');
      this.currentScreen = id;
    }
  }

  // ── Toast Notifications ──────────────────────────────────────
  showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), duration + 300);
  }

  // ── Combo Overlay ─────────────────────────────────────────────
  showComboEffect(combo, score) {
    const overlay = document.getElementById('combo-overlay');
    const text    = document.getElementById('combo-blast-text');
    if (!overlay || !text) return;

    let msg, color;
    if (combo >= 8)      { msg = '🔥 ULTRA COMBO!';  color = '#ff4fa3'; }
    else if (combo >= 5) { msg = '⚡ MEGA COMBO!';   color = '#b44fff'; }
    else if (combo >= 3) { msg = '💥 COMBO x' + combo; color = '#ff8c00'; }
    else                 { msg = '✨ COMBO x' + combo; color = '#ffe600'; }

    text.textContent   = msg;
    text.style.color   = color;
    overlay.classList.remove('hidden');

    // Tutup setelah animasi
    clearTimeout(this._comboTimeout);
    this._comboTimeout = setTimeout(() => {
      overlay.classList.add('hidden');
    }, 800);
  }

  // ── Battle Bar ────────────────────────────────────────────────
  updateBattleBar(value) {
    // value: -100 (kita menang) .. 0 (seimbang) .. +100 (lawan menang)
    const fill = document.getElementById('battle-bar-fill');
    if (!fill) return;

    const pct = (value + 100) / 200 * 100; // 0..100%
    const halfPoint = 50; // titik tengah bar

    if (value < 0) {
      // Kita unggul: fill dari tengah ke kiri (warna hijau/biru)
      fill.style.left   = `${pct}%`;
      fill.style.width  = `${halfPoint - pct}%`;
      fill.style.background = 'linear-gradient(90deg, #39ff8c, #00e5ff)';
      fill.style.boxShadow  = '0 0 12px rgba(57,255,140,0.6)';
    } else {
      // Lawan unggul: fill dari tengah ke kanan (merah/oranye)
      fill.style.left   = '50%';
      fill.style.width  = `${(value / 100) * 50}%`;
      fill.style.background = 'linear-gradient(90deg, #ff8c00, #ff3a3a)';
      fill.style.boxShadow  = '0 0 12px rgba(255,58,58,0.6)';
    }
  }

  // ── Penalty Flash ─────────────────────────────────────────────
  showPenaltyEffect(count) {
    const overlay = document.getElementById('penalty-overlay');
    const sub     = document.getElementById('penalty-sub');
    if (!overlay) return;
    if (sub) sub.textContent = `+${count} Baris Sampah!`;
    overlay.classList.remove('hidden');
    setTimeout(() => overlay.classList.add('hidden'), 1500);
  }

  // ── HUD Score Update ──────────────────────────────────────────
  updateScore(score, elId = 'hud-score') {
    const el = document.getElementById(elId);
    if (!el) return;

    // Animasi counter naik
    const current  = parseInt(el.textContent.replace(/,/g, '')) || 0;
    const diff     = score - current;
    if (diff <= 0) { el.textContent = score.toLocaleString(); return; }

    const steps    = Math.min(20, diff);
    const step     = diff / steps;
    let   val      = current;
    let   i        = 0;
    const interval = setInterval(() => {
      val += step;
      el.textContent = Math.floor(val).toLocaleString();
      if (++i >= steps) {
        el.textContent = score.toLocaleString();
        clearInterval(interval);
      }
    }, 30);
  }

  updateComboDisplay(combo) {
    const display  = document.getElementById('hud-combo-display');
    const numEl    = document.getElementById('hud-combo-num');
    if (!display) return;
    if (combo >= 2) {
      display.style.display = 'flex';
      numEl.textContent     = 'x' + combo;
    } else {
      display.style.display = 'none';
    }
  }

  // ── Menu Particles ────────────────────────────────────────────
  initMenuParticles() {
    const container = document.getElementById('menu-particles');
    if (!container) return;
    container.innerHTML = '';
    const colors = ['#4f8eff','#00e5ff','#b44fff','#ff4fa3','#39ff8c','#ffe600'];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.cssText = `
        left: ${Math.random()*100}%;
        bottom: ${Math.random()*20}%;
        width:  ${Math.random()*4+2}px;
        height: ${Math.random()*4+2}px;
        background: ${colors[Math.floor(Math.random()*colors.length)]};
        animation-duration:  ${Math.random()*8+5}s;
        animation-delay:    -${Math.random()*8}s;
        opacity: ${Math.random()*0.4+0.1};
      `;
      container.appendChild(p);
    }
  }

  // ── Avatar Picker ─────────────────────────────────────────────
  renderAvatarPicker(selectedAvatar) {
    const grid = document.getElementById('avatar-picker-grid');
    if (!grid) return;
    grid.innerHTML = '';
    AVATARS.forEach(av => {
      const div = document.createElement('div');
      div.className = `avatar-option${av === selectedAvatar ? ' selected' : ''}`;
      div.textContent = av;
      div.addEventListener('click', () => {
        grid.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
        div.classList.add('selected');
        Sound.playClick();
      });
      grid.appendChild(div);
    });
  }

  getSelectedAvatar() {
    const sel = document.querySelector('#avatar-picker-grid .avatar-option.selected');
    return sel ? sel.textContent : null;
  }

  // ── Daily Reward ──────────────────────────────────────────────
  showDailyReward(data) {
    const popup = document.getElementById('daily-reward-popup');
    if (!popup) return;

    document.getElementById('daily-streak').textContent = data.streak;

    const row = document.getElementById('daily-rewards-row');
    if (row) {
      row.innerHTML = `
        <div class="daily-reward-item">
          <div class="dr-icon">💰</div>
          <div class="dr-label">Koin</div>
          <div class="dr-value">+${data.coins}</div>
        </div>
        <div class="daily-reward-item">
          <div class="dr-icon">⭐</div>
          <div class="dr-label">XP</div>
          <div class="dr-value">+${data.xp}</div>
        </div>
        ${data.streak >= 7 ? `<div class="daily-reward-item">
          <div class="dr-icon">🎁</div>
          <div class="dr-label">Bonus</div>
          <div class="dr-value">+500</div>
        </div>` : ''}
      `;
    }
    popup.classList.remove('hidden');
  }

  hideDailyReward() {
    document.getElementById('daily-reward-popup')?.classList.add('hidden');
  }

  // ── Rank Up Banner ────────────────────────────────────────────
  showRankUp(rankId) {
    const rank   = RANKS.find(r => r.id === rankId);
    if (!rank) return;
    const banner = document.getElementById('rank-up-banner');
    const name   = document.getElementById('rank-up-name');
    if (!banner || !name) return;
    name.textContent = `${rank.icon} ${rank.label}`;
    banner.classList.remove('hidden');
    Sound.playRankUp();
    this.showToast(`🎉 Naik Rank ke ${rank.label}!`, 'success', 4000);
  }

  // ── BR Player List ────────────────────────────────────────────
  renderBRPlayerList(players) {
    const list = document.getElementById('br-player-list');
    if (!list) return;
    list.innerHTML = '';
    players.forEach(pl => {
      const chip = document.createElement('div');
      chip.className = 'br-player-chip';
      chip.id        = 'br-chip-' + pl.id;
      chip.innerHTML = `
        <div class="chip-av">${pl.avatar}</div>
        <div class="chip-name">${pl.username}</div>
      `;
      list.appendChild(chip);
    });
  }

  eliminateBRPlayer(playerId) {
    const chip = document.getElementById('br-chip-' + playerId);
    if (chip) chip.classList.add('eliminated');
  }

  updateBRAlive(count) {
    const el = document.getElementById('br-alive-count');
    if (el) el.textContent = count;
  }

  // ── Duel HUD ──────────────────────────────────────────────────
  updateDuelHUD(myScore, oppScore, oppName, oppAvatar) {
    if (myScore !== undefined)  document.getElementById('d-my-score').textContent = myScore.toLocaleString();
    if (oppScore !== undefined) document.getElementById('d-opp-score').textContent = oppScore.toLocaleString();
    if (oppName)   document.getElementById('d-opp-name').textContent   = oppName;
    if (oppAvatar) document.getElementById('d-opp-avatar').textContent = oppAvatar;
  }

  // ── Duel Opponent Board Attack Flash ─────────────────────────
  flashOppBoard() {
    const overlay = document.getElementById('opp-board-overlay');
    if (!overlay) return;
    overlay.classList.add('attacking');
    setTimeout(() => overlay.classList.remove('attacking'), 600);
  }

  // ── Lobby UI ──────────────────────────────────────────────────
  showLobbyWaiting(roomCode, players) {
    document.getElementById('lobby-options').classList.add('hidden');
    document.getElementById('lobby-room-join').classList.add('hidden');
    document.getElementById('lobby-waiting').classList.remove('hidden');
    document.getElementById('display-room-code').textContent = roomCode;

    const wp = document.getElementById('waiting-players');
    if (wp) {
      wp.innerHTML = '';
      players.forEach(pl => {
        const div = document.createElement('div');
        div.className = 'waiting-player';
        div.innerHTML = `<div class="w-av">${pl.avatar || '👾'}</div><div>${pl.username || 'Menunggu…'}</div>`;
        wp.appendChild(div);
      });
    }
  }

  resetLobby() {
    document.getElementById('lobby-options')?.classList.remove('hidden');
    document.getElementById('lobby-room-join')?.classList.add('hidden');
    document.getElementById('lobby-waiting')?.classList.add('hidden');
    document.getElementById('lobby-msg').textContent = '';
  }
}

// Ekspor global
window.UIManager = UIManager;
window.UI        = new UIManager();
