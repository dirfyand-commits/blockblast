/**
 * shop.js – Sistem toko in-game
 * Block Blast Pro – Puzzle Arena
 */

// ── Item Catalog ─────────────────────────────────────────────
const SHOP_ITEMS = {
  skin: [
    { id: 'skin_default', name: 'Classic',     preview: '🟦', price: 0,    category: 'skin', boardClass: 'skin-default'  },
    { id: 'skin_neon',    name: 'Neon Glow',   preview: '🟣', price: 200,  category: 'skin', boardClass: 'skin-neon'     },
    { id: 'skin_pastel',  name: 'Pastel Dream', preview: '🩷', price: 300,  category: 'skin', boardClass: 'skin-pastel'   },
    { id: 'skin_dark',    name: 'Dark Matter',  preview: '⬛', price: 250,  category: 'skin', boardClass: 'skin-dark'     },
    { id: 'skin_rainbow', name: 'Rainbow',      preview: '🌈', price: 500,  category: 'skin', boardClass: 'skin-rainbow'  },
    { id: 'skin_gold',    name: 'Gold Rush',    preview: '🟡', price: 800,  category: 'skin', boardClass: 'skin-gold'     },
  ],
  board: [
    { id: 'board_default', name: 'Default',    preview: '🌑', price: 0,    category: 'board', theme: 'default' },
    { id: 'board_forest',  name: 'Forest',     preview: '🌿', price: 150,  category: 'board', theme: 'forest'  },
    { id: 'board_sunset',  name: 'Sunset',     preview: '🌅', price: 200,  category: 'board', theme: 'sunset'  },
    { id: 'board_ocean',   name: 'Ocean',      preview: '🌊', price: 250,  category: 'board', theme: 'ocean'   },
    { id: 'board_galaxy',  name: 'Galaxy',     preview: '🌌', price: 400,  category: 'board', theme: 'galaxy'  },
  ],
  effect: [
    { id: 'fx_default',   name: 'Normal',      preview: '✨', price: 0,    category: 'effect' },
    { id: 'fx_sparkle',   name: 'Sparkle',     preview: '💫', price: 180,  category: 'effect' },
    { id: 'fx_explosion', name: 'Explosion',   preview: '💥', price: 300,  category: 'effect' },
    { id: 'fx_rainbow',   name: 'Rainbow Burst',preview: '🌈', price: 450,  category: 'effect' },
    { id: 'fx_laser',     name: 'Laser',       preview: '🔴', price: 350,  category: 'effect' },
  ],
  avatar: [
    { id: 'avatar_default', name: 'Guest',     preview: '👾', price: 0,    category: 'avatar', emoji: '👾' },
    { id: 'avatar_dragon',  name: 'Dragon',    preview: '🐉', price: 200,  category: 'avatar', emoji: '🐉' },
    { id: 'avatar_crown',   name: 'Crown',     preview: '👑', price: 400,  category: 'avatar', emoji: '👑' },
    { id: 'avatar_robot',   name: 'Robot',     preview: '🤖', price: 150,  category: 'avatar', emoji: '🤖' },
    { id: 'avatar_unicorn', name: 'Unicorn',   preview: '🦄', price: 500,  category: 'avatar', emoji: '🦄' },
    { id: 'avatar_alien',   name: 'Alien',     preview: '👽', price: 300,  category: 'avatar', emoji: '👽' },
    { id: 'avatar_fire',    name: 'Fire',      preview: '🔥', price: 350,  category: 'avatar', emoji: '🔥' },
    { id: 'avatar_diamond', name: 'Diamond',   preview: '💎', price: 600,  category: 'avatar', emoji: '💎' },
    { id: 'avatar_rocket',  name: 'Rocket',    preview: '🚀', price: 250,  category: 'avatar', emoji: '🚀' },
  ],
};

class ShopManager {
  constructor() {
    this.currentCategory = 'skin';
  }

  /** Render item grid sesuai kategori */
  renderShopGrid(category) {
    this.currentCategory = category;
    const grid = document.getElementById('shop-grid');
    if (!grid) return;

    const items = SHOP_ITEMS[category] || [];
    const p     = Profile.get();

    grid.innerHTML = '';
    items.forEach(item => {
      const owned    = Profile.ownsItem(item.id);
      const equipped = p.equipped && p.equipped[category] === item.id;

      const div = document.createElement('div');
      div.className = `shop-item ${owned ? 'owned' : ''} ${equipped ? 'equipped' : ''}`;
      div.innerHTML = `
        <div class="shop-item-preview">${item.preview}</div>
        <div class="shop-item-name">${item.name}</div>
        <div class="shop-item-price">
          ${owned ? (equipped ? '✅ Dipakai' : '✔ Dimiliki') : `💰 ${item.price}`}
        </div>
        ${equipped ? `<span class="shop-item-badge badge-equipped">EQUIPPED</span>` : ''}
        ${owned && !equipped ? `<span class="shop-item-badge badge-owned">OWNED</span>` : ''}
      `;
      div.addEventListener('click', () => this._handleItemClick(item));
      grid.appendChild(div);
    });
  }

  _handleItemClick(item) {
    Sound.playClick();
    const p = Profile.get();

    if (Profile.ownsItem(item.id)) {
      // Equip item
      const categoryKey = item.category === 'board' ? 'board' :
                          item.category === 'skin'  ? 'skin'  : item.category;
      Profile.equipItem(item.id, categoryKey);

      // Apply equip
      this._applyEquip(item);
      UI.showToast(`✅ ${item.name} dipakai!`, 'success');
      this.renderShopGrid(this.currentCategory);
      return;
    }

    // Beli item
    if (item.price === 0) {
      Profile.profile.owned.push(item.id);
      Profile.save();
      UI.showToast(`🎁 ${item.name} didapat!`, 'success');
      this.renderShopGrid(this.currentCategory);
      return;
    }

    const result = Profile.buyItem(item.id, item.price);
    if (result.success) {
      Sound.playCoin();
      UI.showToast(`🛍️ Berhasil membeli ${item.name}!`, 'success');
      // Auto equip setelah beli
      Profile.equipItem(item.id, item.category);
      this._applyEquip(item);
      this.renderShopGrid(this.currentCategory);
      document.getElementById('shop-coins').textContent = Profile.get().coins.toLocaleString();
    } else {
      Sound.playInvalid();
      UI.showToast(`❌ ${result.reason}`, 'error');
    }
  }

  _applyEquip(item) {
    // Apply board theme ke game engine aktif jika ada
    if (item.category === 'board' && window._activeGame) {
      window._activeGame.setBoardTheme(item.theme || 'default');
    }
  }

  /** Open shop modal */
  open() {
    document.getElementById('modal-shop').classList.remove('hidden');
    document.getElementById('shop-coins').textContent = Profile.get().coins.toLocaleString();
    this.renderShopGrid('skin');
  }

  /** Close */
  close() {
    document.getElementById('modal-shop').classList.add('hidden');
  }

  /** Get equipped board theme */
  getEquippedBoardTheme() {
    const p      = Profile.get();
    const itemId = p.equipped?.board || 'board_default';
    const item   = (SHOP_ITEMS.board || []).find(i => i.id === itemId);
    return item?.theme || 'default';
  }

  /** Get equipped skin class */
  getEquippedSkinClass() {
    const p      = Profile.get();
    const itemId = p.equipped?.skin || 'skin_default';
    const item   = (SHOP_ITEMS.skin || []).find(i => i.id === itemId);
    return item?.boardClass || 'skin-default';
  }
}

// Ekspor global
window.ShopManager = ShopManager;
window.SHOP_ITEMS  = SHOP_ITEMS;
window.Shop        = new ShopManager();
