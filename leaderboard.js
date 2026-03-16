/**
 * leaderboard.js – Sistem leaderboard global (localStorage + simulasi realtime)
 * Block Blast Pro – Puzzle Arena
 */

// ── Data simulasi pemain lain ─────────────────────────────────
const SIMULATED_PLAYERS = [
  { username: 'NeonMaster',  avatar: '🤖', score: 285400, wins: 124, rankId: 'master'   },
  { username: 'DragonSlayer',avatar: '🐉', score: 198200, wins: 87,  rankId: 'diamond'  },
  { username: 'StarBlaster', avatar: '⭐', score: 156800, wins: 72,  rankId: 'diamond'  },
  { username: 'BlockKing',   avatar: '👑', score: 134500, wins: 61,  rankId: 'platinum' },
  { username: 'PurpleRain',  avatar: '🔮', score: 112300, wins: 54,  rankId: 'platinum' },
  { username: 'FireStorm',   avatar: '🔥', score: 98700,  wins: 43,  rankId: 'gold'     },
  { username: 'IceCrusher',  avatar: '❄️', score: 87600,  wins: 38,  rankId: 'gold'     },
  { username: 'CosmicPunk',  avatar: '🚀', score: 76400,  wins: 31,  rankId: 'gold'     },
  { username: 'ThunderBolt', avatar: '⚡', score: 65200,  wins: 25,  rankId: 'silver'   },
  { username: 'MysticFox',   avatar: '🦊', score: 54100,  wins: 18,  rankId: 'silver'   },
  { username: 'NightOwl',    avatar: '🦉', score: 43800,  wins: 13,  rankId: 'silver'   },
  { username: 'CrystalWave', avatar: '💎', score: 34200,  wins: 8,   rankId: 'bronze'   },
  { username: 'ShadowRift',  avatar: '🌑', score: 27600,  wins: 5,   rankId: 'bronze'   },
  { username: 'PixelGhost',  avatar: '👻', score: 21400,  wins: 3,   rankId: 'bronze'   },
];

class LeaderboardManager {
  constructor() {
    this.currentTab = 'score';
  }

  /** Dapatkan semua entri (simulasi + pemain lokal) */
  _getEntries(type) {
    const p       = Profile.get();
    const myEntry = {
      username: p.username,
      avatar:   p.avatar,
      score:    p.totalScore,
      wins:     p.wins,
      rankId:   p.rankId,
      isMe:     true,
    };

    const all = [...SIMULATED_PLAYERS.map(s => ({ ...s, isMe: false })), myEntry];

    switch (type) {
      case 'score':
        return all.sort((a,b) => b.score - a.score);
      case 'wins':
        return all.sort((a,b) => b.wins - a.wins);
      case 'rank': {
        const rankOrder = { master:5, diamond:4, platinum:3, gold:2, silver:1, bronze:0 };
        return all.sort((a,b) =>
          (rankOrder[b.rankId] || 0) - (rankOrder[a.rankId] || 0) ||
          b.score - a.score
        );
      }
      default:
        return all;
    }
  }

  /** Render leaderboard list */
  render(type) {
    this.currentTab = type;
    const list    = document.getElementById('lb-list');
    if (!list) return;

    list.innerHTML = '<div class="lb-loading">Memuat…</div>';

    // Simulasi loading async
    setTimeout(() => {
      const entries = this._getEntries(type);
      list.innerHTML = '';

      entries.forEach((entry, i) => {
        const rank      = RANKS.find(r => r.id === entry.rankId) || RANKS[0];
        const rankClass = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
        const rankIcon  = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}`;

        const val = type === 'score' ? entry.score.toLocaleString()
                  : type === 'wins'  ? `${entry.wins} 🏆`
                  : `${rank.icon} ${rank.label}`;

        const row = document.createElement('div');
        row.className = `lb-row${entry.isMe ? ' me' : ''}`;
        row.innerHTML = `
          <div class="lb-rank ${rankClass}">${rankIcon}</div>
          <div class="lb-av">${entry.avatar}</div>
          <div class="lb-name">${entry.username}${entry.isMe ? ' (Kamu)' : ''}</div>
          <div class="lb-val">${val}</div>
        `;
        list.appendChild(row);
      });
    }, 400);
  }

  /** Open modal */
  open() {
    document.getElementById('modal-leaderboard').classList.remove('hidden');
    this.render('score');
  }

  /** Close */
  close() {
    document.getElementById('modal-leaderboard').classList.add('hidden');
  }
}

// Ekspor global
window.LeaderboardManager = LeaderboardManager;
window.Leaderboard        = new LeaderboardManager();
