/**
 * profile.js – Sistem profil pemain, rank, XP, koin
 * Block Blast Pro – Puzzle Arena
 */

// ── Rank System ──────────────────────────────────────────────
const RANKS = [
  { id: 'bronze',   label: 'Bronze',   icon: '🥉', color: '#cd7f32', minWins: 0,   minScore: 0      },
  { id: 'silver',   label: 'Silver',   icon: '🥈', color: '#c0c0c0', minWins: 5,   minScore: 5000   },
  { id: 'gold',     label: 'Gold',     icon: '🥇', color: '#ffd700', minWins: 15,  minScore: 15000  },
  { id: 'platinum', label: 'Platinum', icon: '💎', color: '#00e5ff', minWins: 30,  minScore: 40000  },
  { id: 'diamond',  label: 'Diamond',  icon: '🔷', color: '#4f8eff', minWins: 60,  minScore: 100000 },
  { id: 'master',   label: 'Master',   icon: '👑', color: '#b44fff', minWins: 100, minScore: 250000 },
];

// ── Level XP Table ───────────────────────────────────────────
function xpForLevel(level) {
  return Math.floor(1000 * Math.pow(1.35, level - 1));
}

// ── Profil Default ───────────────────────────────────────────
const DEFAULT_PROFILE = {
  username:    'Guest',
  avatar:      '👾',
  level:       1,
  xp:          0,
  totalScore:  0,
  games:       0,
  wins:        0,
  coins:       500, // starter coins
  rankId:      'bronze',
  dailyStreak: 0,
  lastLogin:   null,
  owned:       ['skin_default', 'board_default', 'avatar_default'],
  equipped:    { skin: 'skin_default', board: 'board_default' },
  isGuest:     true,
};

class ProfileManager {
  constructor() {
    this.profile = null;
    this._load();
  }

  _load() {
    try {
      const saved = localStorage.getItem('bb_profile');
      if (saved) {
        this.profile = { ...DEFAULT_PROFILE, ...JSON.parse(saved) };
      } else {
        this.profile = { ...DEFAULT_PROFILE };
      }
    } catch(e) {
      this.profile = { ...DEFAULT_PROFILE };
    }
  }

  save() {
    localStorage.setItem('bb_profile', JSON.stringify(this.profile));
  }

  get() { return this.profile; }

  /** Update username & avatar */
  updateBasic(username, avatar) {
    if (username && username.trim().length >= 2) {
      this.profile.username = username.trim().slice(0, 20);
    }
    if (avatar) this.profile.avatar = avatar;
    this.save();
    this._refreshUI();
  }

  /** Tambah XP dan cek level up */
  addXP(amount) {
    const p = this.profile;
    p.xp += amount;

    let leveled = false;
    while (p.xp >= xpForLevel(p.level)) {
      p.xp -= xpForLevel(p.level);
      p.level++;
      leveled = true;
    }

    this.save();
    if (leveled) {
      Sound.playLevelUp();
      UI.showToast(`🎉 Level Up! Sekarang Level ${p.level}`, 'success');
    }
    return leveled;
  }

  /** Tambah koin */
  addCoins(amount) {
    this.profile.coins += amount;
    this.save();
    if (amount > 0) Sound.playCoin();
    this._refreshCoinsUI();
  }

  /** Kurangi koin (untuk beli item) */
  spendCoins(amount) {
    if (this.profile.coins < amount) return false;
    this.profile.coins -= amount;
    this.save();
    this._refreshCoinsUI();
    return true;
  }

  /** Selesai satu game solo */
  recordGame(score) {
    const p = this.profile;
    p.games++;
    p.totalScore += score;
    if (score > (p.bestScore || 0)) p.bestScore = score;

    // XP reward
    const xpGained = Math.floor(score / 50) + 10;
    const coinGained = Math.floor(score / 100) + 5;
    this.addXP(xpGained);
    this.addCoins(coinGained);

    const oldRank = p.rankId;
    this._updateRank();
    const rankChanged = p.rankId !== oldRank;

    this.save();
    return { xpGained, coinGained, rankChanged, newRank: p.rankId };
  }

  /** Selesai duel */
  recordDuel(won, score) {
    const p = this.profile;
    p.games++;
    p.totalScore += score;
    if (won) p.wins++;

    const xpGained   = won ? Math.floor(score / 30) + 50 : Math.floor(score / 80) + 10;
    const coinGained  = won ? 80 : 20;
    this.addXP(xpGained);
    this.addCoins(coinGained);

    const oldRank = p.rankId;
    this._updateRank();
    const rankChanged = p.rankId !== oldRank;

    this.save();
    return { xpGained, coinGained, rankChanged, newRank: p.rankId };
  }

  /** Selesai Battle Royale */
  recordBR(placement, score) {
    const p = this.profile;
    p.games++;
    p.totalScore += score;
    const won = placement === 1;
    if (won) p.wins++;

    const base = Math.max(11 - placement, 1);
    const xpGained   = base * 30 + Math.floor(score / 60);
    const coinGained  = base * 15;
    this.addXP(xpGained);
    this.addCoins(coinGained);

    const oldRank = p.rankId;
    this._updateRank();
    const rankChanged = p.rankId !== oldRank;

    this.save();
    return { xpGained, coinGained, rankChanged, newRank: p.rankId };
  }

  _updateRank() {
    const p = this.profile;
    let newRank = RANKS[0];
    for (const rank of RANKS) {
      if (p.wins >= rank.minWins && p.totalScore >= rank.minScore) {
        newRank = rank;
      }
    }
    p.rankId = newRank.id;
  }

  getRankData() {
    const p = this.profile;
    return RANKS.find(r => r.id === p.rankId) || RANKS[0];
  }

  /** Klaim reward login harian */
  claimDailyReward() {
    const p = this.profile;
    const today = new Date().toDateString();
    if (p.lastLogin === today) return null; // sudah klaim

    const yesterday = new Date(Date.now() - 86400000).toDateString();
    if (p.lastLogin === yesterday) {
      p.dailyStreak = (p.dailyStreak || 0) + 1;
    } else if (p.lastLogin !== today) {
      p.dailyStreak = 1;
    }

    p.lastLogin = today;

    // Reward berdasarkan streak
    const streak  = p.dailyStreak;
    const coins   = 50 + Math.min(streak, 7) * 20;
    const xp      = 100 + streak * 25;

    this.addCoins(coins);
    this.addXP(xp);
    this.save();

    return { streak, coins, xp };
  }

  /** Beli item dari shop */
  buyItem(itemId, price) {
    const p = this.profile;
    if (p.owned.includes(itemId)) return { success: false, reason: 'Sudah dimiliki' };
    if (!this.spendCoins(price)) return { success: false, reason: 'Koin tidak cukup' };
    p.owned.push(itemId);
    this.save();
    return { success: true };
  }

  /** Equip item */
  equipItem(itemId, category) {
    const p = this.profile;
    if (!p.owned.includes(itemId)) return false;
    p.equipped[category] = itemId;
    this.save();
    return true;
  }

  ownsItem(itemId) { return this.profile.owned.includes(itemId); }

  /** Refresh semua UI yang menampilkan data profil */
  _refreshUI() {
    const p = this.profile;
    const rank = this.getRankData();

    // Menu
    const elUsername = document.getElementById('menu-username');
    const elAvatar   = document.getElementById('menu-avatar');
    const elLevel    = document.getElementById('menu-level');
    const elScoreT   = document.getElementById('menu-score-total');
    const elWins     = document.getElementById('menu-wins');
    const elRank     = document.getElementById('menu-rank');

    if (elUsername) elUsername.textContent = p.username;
    if (elAvatar)   elAvatar.textContent   = p.avatar;
    if (elLevel)    elLevel.textContent    = p.level;
    if (elScoreT)   elScoreT.textContent   = p.totalScore.toLocaleString();
    if (elWins)     elWins.textContent     = p.wins;
    if (elRank)     elRank.innerHTML = `<span class="rank-badge ${rank.id}">${rank.icon} ${rank.label}</span>`;

    // Profile modal
    const pLevel  = document.getElementById('p-level');
    const pScore  = document.getElementById('p-score');
    const pGames  = document.getElementById('p-games');
    const pWins   = document.getElementById('p-wins');
    const pCoins  = document.getElementById('p-coins');
    const pRankI  = document.getElementById('p-rank-icon');
    const pRankL  = document.getElementById('p-rank-label');
    const pXPBar  = document.getElementById('p-xp-bar');
    const pXPLbl  = document.getElementById('p-xp-label');

    if (pLevel)  pLevel.textContent  = p.level;
    if (pScore)  pScore.textContent  = p.totalScore.toLocaleString();
    if (pGames)  pGames.textContent  = p.games;
    if (pWins)   pWins.textContent   = p.wins;
    if (pCoins)  pCoins.textContent  = p.coins;
    if (pRankI)  pRankI.textContent  = rank.icon;
    if (pRankL)  pRankL.textContent  = rank.label;

    const xpNeeded = xpForLevel(p.level);
    const xpPct    = Math.min((p.xp / xpNeeded) * 100, 100);
    if (pXPBar)  pXPBar.style.width = xpPct + '%';
    if (pXPLbl)  pXPLbl.textContent = `${p.xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP ke Level ${p.level + 1}`;
  }

  _refreshCoinsUI() {
    const el = document.getElementById('shop-coins');
    if (el) el.textContent = this.profile.coins.toLocaleString();
  }

  refresh() { this._refreshUI(); this._refreshCoinsUI(); }
}

// ── Avatar List ──────────────────────────────────────────────
const AVATARS = [
  '👾','🤖','🦊','🐼','🦁','🐯','🐸','🦋',
  '🌟','⚡','🔥','💎','🎯','🏆','🎮','🕹️',
  '🦄','🐉','🌈','🎭','🎪','🎨','🚀','🛸',
  '💫','✨','🌙','☀️','🎲','🎸',
];

// Ekspor global
window.ProfileManager = ProfileManager;
window.RANKS          = RANKS;
window.AVATARS        = AVATARS;
window.xpForLevel     = xpForLevel;
window.Profile        = new ProfileManager();
