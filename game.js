/**
 * game.js – Core game engine
 * Board management, drag-drop, clear logic, scoring, animations
 * Block Blast Pro – Puzzle Arena
 */

class GameEngine {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {object} opts
   */
  constructor(canvas, opts = {}) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.cols     = Blocks.BOARD_COLS;
    this.rows     = Blocks.BOARD_ROWS;
    this.cellSize = Math.floor(canvas.width / this.cols);

    // Opsi
    this.onScoreUpdate  = opts.onScoreUpdate  || (() => {});
    this.onCombo        = opts.onCombo        || (() => {});
    this.onClear        = opts.onClear        || (() => {});
    this.onGameOver     = opts.onGameOver     || (() => {});
    this.onBlockPlaced  = opts.onBlockPlaced  || (() => {});
    this.boardTheme     = opts.boardTheme     || 'default';
    this.blockSkin      = opts.blockSkin      || 'default';
    this.isOpponent     = opts.isOpponent     || false; // papan lawan (read-only display)

    // State
    this.board          = this._emptyBoard();
    this.score          = 0;
    this.combo          = 0;
    this.comboTimer     = null;
    this.isGameOver     = false;
    this.animQueue      = [];
    this._animating     = false;

    // Blocks tray (3 blok tersedia)
    this.currentBlocks  = [];
    this.activeBlock    = null;   // { idx, block, x, y } – sedang di-drag
    this.ghostPos       = null;   // { boardRow, boardCol } – posisi preview
    this.traySlots      = [null, null, null]; // DOM canvas per slot

    // Animasi clear
    this.clearingRows   = [];
    this.clearingCols   = [];
    this._flashAlpha    = 0;
    this._flashTimer    = null;

    // Stat
    this.linesCleared   = 0;
    this.blocksPlaced   = 0;

    this._boundPointerDown = this._onPointerDown.bind(this);
    this._boundPointerMove = this._onPointerMove.bind(this);
    this._boundPointerUp   = this._onPointerUp.bind(this);

    this._rafId = null;
    this._loop();
  }

  // ── Board Init ───────────────────────────────────────────────
  _emptyBoard() {
    return Array.from({ length: this.rows }, () => Array(this.cols).fill(0));
  }

  /** Set tema papan */
  setBoardTheme(theme) { this.boardTheme = theme; }

  // ── Game Loop (requestAnimationFrame) ────────────────────────
  _loop() {
    this._draw();
    this._rafId = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);
    this._removeListeners();
  }

  // ── Drawing ──────────────────────────────────────────────────
  _draw() {
    const ctx  = this.ctx;
    const cs   = this.cellSize;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Background grid
    Blocks.renderBoardBackground(ctx, this.cols, this.rows, cs, this.boardTheme);

    // Board cells
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const v = this.board[r][c];
        if (v > 0) {
          Blocks.renderCell(ctx, c * cs, r * cs, cs, v);
        } else if (v === -1) {
          // Trash cell (duel penalty)
          Blocks.renderTrashCell(ctx, c * cs, r * cs, cs);
        }
      }
    }

    // Ghost preview
    if (this.ghostPos && this.activeBlock) {
      const { boardRow: gr, boardCol: gc } = this.ghostPos;
      const block = this.activeBlock.block;
      block.cells.forEach(([dr, dc]) => {
        const r2 = gr + dr, c2 = gc + dc;
        if (r2 >= 0 && r2 < this.rows && c2 >= 0 && c2 < this.cols) {
          Blocks.renderGhostCell(ctx, c2 * cs, r2 * cs, cs, block.color);
        }
      });
    }

    // Clearing animation flash
    if (this.clearingRows.length || this.clearingCols.length) {
      this._drawClearAnimation();
    }
  }

  _drawClearAnimation() {
    const ctx = this.ctx;
    const cs  = this.cellSize;
    const alpha = this._flashAlpha;

    // Highlight cleared rows
    this.clearingRows.forEach(r => {
      ctx.save();
      const grd = ctx.createLinearGradient(0, r*cs, this.cols*cs, r*cs);
      grd.addColorStop(0,   `rgba(255,255,255,0)`);
      grd.addColorStop(0.5, `rgba(255,255,255,${alpha})`);
      grd.addColorStop(1,   `rgba(255,255,255,0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(0, r*cs, this.cols*cs, cs);

      // Shimmer particles
      for (let c = 0; c < this.cols; c++) {
        ctx.beginPath();
        ctx.arc(c*cs + cs/2, r*cs + cs/2, (cs/3)*alpha, 0, Math.PI*2);
        ctx.fillStyle = `rgba(255,255,255,${alpha*0.5})`;
        ctx.fill();
      }
      ctx.restore();
    });

    this.clearingCols.forEach(c => {
      ctx.save();
      const grd = ctx.createLinearGradient(c*cs, 0, c*cs, this.rows*cs);
      grd.addColorStop(0,   `rgba(0,229,255,0)`);
      grd.addColorStop(0.5, `rgba(0,229,255,${alpha})`);
      grd.addColorStop(1,   `rgba(0,229,255,0)`);
      ctx.fillStyle = grd;
      ctx.fillRect(c*cs, 0, cs, this.rows*cs);
      ctx.restore();
    });
  }

  // ── Tray Setup ───────────────────────────────────────────────
  setupTray(slotEls) {
    this.traySlots = slotEls.map((el, idx) => {
      el.innerHTML = '';
      return el;
    });
    this._removeListeners();
    this._addListeners();
  }

  _renderTray() {
    if (!this.traySlots.length) return;
    this.currentBlocks.forEach((block, idx) => {
      const slotEl = this.traySlots[idx];
      if (!slotEl) return;
      slotEl.innerHTML = '';
      slotEl.classList.remove('has-block', 'drag-source');

      if (!block) return;
      slotEl.classList.add('has-block');

      const bounds   = Blocks.getBlockBounds(block.cells);
      const maxDim   = Math.max(bounds.rows, bounds.cols);
      const slotSize = slotEl.clientWidth || 100;
      const cs       = Math.min(Math.floor((slotSize - 16) / maxDim), 22);

      const cw = bounds.cols * cs + 8;
      const ch = bounds.rows * cs + 8;

      const cvs = document.createElement('canvas');
      cvs.width  = cw;
      cvs.height = ch;
      cvs.className = 'block-mini-canvas';
      cvs.dataset.idx = idx;

      Blocks.renderBlockToCanvas(cvs, block.cells, block.color, cs, 3);
      slotEl.appendChild(cvs);
    });
  }

  // ── Pointer Events (drag-drop) ───────────────────────────────
  _addListeners() {
    this.canvas.addEventListener('pointerdown',  this._boundPointerDown);
    this.canvas.addEventListener('pointermove',  this._boundPointerMove);
    this.canvas.addEventListener('pointerup',    this._boundPointerUp);
    this.canvas.addEventListener('pointerleave', this._boundPointerUp);

    // Tray listeners
    this.traySlots.forEach((slot, idx) => {
      if (!slot) return;
      slot.addEventListener('pointerdown', (e) => this._onTrayPointerDown(e, idx));
    });
  }

  _removeListeners() {
    this.canvas.removeEventListener('pointerdown',  this._boundPointerDown);
    this.canvas.removeEventListener('pointermove',  this._boundPointerMove);
    this.canvas.removeEventListener('pointerup',    this._boundPointerUp);
    this.canvas.removeEventListener('pointerleave', this._boundPointerUp);
  }

  _getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width  / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top)  * scaleY,
    };
  }

  _onTrayPointerDown(e, idx) {
    e.preventDefault();
    if (this.isGameOver || !this.currentBlocks[idx]) return;
    Sound.init();

    const block = this.currentBlocks[idx];
    this.activeBlock = { idx, block };
    this.traySlots[idx]?.classList.add('drag-source');

    // Pindahkan event ke canvas
    const pos = this._getCanvasPos(e);
    this._updateGhost(pos.x, pos.y);

    this.canvas.setPointerCapture(e.pointerId);
    this.canvas.classList.add('dragging');
  }

  _onPointerDown(e) {
    e.preventDefault();
  }

  _onPointerMove(e) {
    e.preventDefault();
    if (!this.activeBlock) return;
    const pos = this._getCanvasPos(e);
    this._updateGhost(pos.x, pos.y);
  }

  _onPointerUp(e) {
    e.preventDefault();
    if (!this.activeBlock) return;

    const pos = this._getCanvasPos(e);
    const { boardRow, boardCol } = this._getBoardPos(pos.x, pos.y);

    if (this.ghostPos && this._canPlace(this.activeBlock.block, boardRow, boardCol)) {
      this._placeBlock(this.activeBlock.idx, boardRow, boardCol);
    } else {
      Sound.playInvalid();
    }

    // Reset drag state
    const idx = this.activeBlock.idx;
    this.traySlots[idx]?.classList.remove('drag-source');
    this.activeBlock = null;
    this.ghostPos    = null;
    this.canvas.classList.remove('dragging');
  }

  _getBoardPos(x, y) {
    const cs = this.cellSize;
    const block = this.activeBlock?.block;
    if (!block) return { boardRow: -1, boardCol: -1 };

    // Center block pada kursor
    const bounds = Blocks.getBlockBounds(block.cells);
    const offsetC = Math.floor(bounds.cols / 2);
    const offsetR = Math.floor(bounds.rows / 2);

    const boardCol = Math.floor(x / cs) - offsetC;
    const boardRow = Math.floor(y / cs) - offsetR;
    return { boardRow, boardCol };
  }

  _updateGhost(x, y) {
    if (!this.activeBlock) return;
    const { boardRow, boardCol } = this._getBoardPos(x, y);
    if (this._canPlace(this.activeBlock.block, boardRow, boardCol)) {
      this.ghostPos = { boardRow, boardCol };
    } else {
      this.ghostPos = null;
    }
  }

  // ── Placement Logic ──────────────────────────────────────────
  _canPlace(block, boardRow, boardCol) {
    for (const [dr, dc] of block.cells) {
      const r = boardRow + dr;
      const c = boardCol + dc;
      if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
      if (this.board[r][c] !== 0) return false;
    }
    return true;
  }

  async _placeBlock(idx, boardRow, boardCol) {
    const block = this.currentBlocks[idx];
    if (!block) return;

    // Tandai sebagai dipakai
    this.currentBlocks[idx] = null;
    this.blocksPlaced++;

    // Tempatkan ke board
    block.cells.forEach(([dr, dc]) => {
      const r = boardRow + dr;
      const c = boardCol + dc;
      this.board[r][c] = block.color;
    });

    Sound.playPlace();

    // Delay kecil supaya terasa smooth
    await this._sleep(60);

    // Cek clear
    await this._checkAndClear();

    // Cek apakah semua tray habis → generate baru
    if (this.currentBlocks.every(b => b === null)) {
      await this._sleep(200);
      this.currentBlocks = Blocks.generateBlockSet();
      this._renderTray();
    } else {
      this._renderTray();
    }

    // Notify placement
    this.onBlockPlaced({ board: this.board, score: this.score });

    // Cek game over
    if (this._isGameOver()) {
      await this._sleep(300);
      this.isGameOver = true;
      Sound.playGameOver();
      this.onGameOver({ score: this.score, linesCleared: this.linesCleared });
    }
  }

  // ── Clear Logic ──────────────────────────────────────────────
  async _checkAndClear() {
    const fullRows = [];
    const fullCols = [];

    for (let r = 0; r < this.rows; r++) {
      if (this.board[r].every(v => v > 0)) fullRows.push(r);
    }
    for (let c = 0; c < this.cols; c++) {
      if (this.board.every(row => row[c] > 0)) fullCols.push(c);
    }

    if (fullRows.length === 0 && fullCols.length === 0) {
      // Reset combo jika tidak ada clear
      this.combo = 0;
      return;
    }

    // Animasi flash
    this.clearingRows = fullRows;
    this.clearingCols = fullCols;
    await this._flashAnimation();

    // Hapus cells
    fullRows.forEach(r => {
      for (let c = 0; c < this.cols; c++) this.board[r][c] = 0;
    });
    fullCols.forEach(c => {
      for (let r = 0; r < this.rows; r++) this.board[r][c] = 0;
    });

    this.clearingRows = [];
    this.clearingCols = [];

    // Hitung skor
    const totalLines = fullRows.length + fullCols.length;
    this.linesCleared += totalLines;
    this.combo++;

    // Skor dasar: cells cleared
    const cellsCleared = fullRows.length * this.cols + fullCols.length * this.rows
      - fullRows.length * fullCols.length; // tidak double hitung persilangan
    let baseScore = cellsCleared * 10;

    // Bonus multi-line
    if (totalLines >= 2) baseScore += totalLines * totalLines * 15;

    // Combo multiplier
    const comboMult = Math.min(this.combo, 8);
    const comboBonus = baseScore * (comboMult - 1) * 0.5;
    const finalScore = Math.round(baseScore + comboBonus);

    this.score += finalScore;
    this.onScoreUpdate(this.score);

    Sound.playClear();
    if (this.combo >= 2) {
      Sound.playCombo(Math.min(this.combo, 5));
      this.onCombo(this.combo, finalScore);
    }

    this.onClear({ rows: fullRows, cols: fullCols, combo: this.combo, score: finalScore });
  }

  async _flashAnimation() {
    return new Promise(resolve => {
      let start = null;
      const duration = 360;

      const animate = (ts) => {
        if (!start) start = ts;
        const t = Math.min((ts - start) / duration, 1);
        // Sine wave flash
        this._flashAlpha = Math.sin(t * Math.PI * 3) * (1 - t);
        if (t < 1) {
          requestAnimationFrame(animate);
        } else {
          this._flashAlpha = 0;
          resolve();
        }
      };
      requestAnimationFrame(animate);
    });
  }

  // ── Game Over Check ──────────────────────────────────────────
  _isGameOver() {
    const availableBlocks = this.currentBlocks.filter(b => b !== null);
    for (const block of availableBlocks) {
      for (let r = 0; r <= this.rows - 1; r++) {
        for (let c = 0; c <= this.cols - 1; c++) {
          if (this._canPlace(block, r, c)) return false;
        }
      }
    }
    return availableBlocks.length > 0;
  }

  // ── Helpers ──────────────────────────────────────────────────
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ── Public API ───────────────────────────────────────────────
  startNewGame() {
    this.board       = this._emptyBoard();
    this.score       = 0;
    this.combo       = 0;
    this.isGameOver  = false;
    this.linesCleared = 0;
    this.blocksPlaced = 0;
    this.clearingRows = [];
    this.clearingCols = [];
    this.activeBlock  = null;
    this.ghostPos     = null;
    this.currentBlocks = Blocks.generateBlockSet();
    this._renderTray();
    this.onScoreUpdate(0);
  }

  /** Tambah baris trash untuk duel penalty */
  addTrashRow(count = 1) {
    // Geser board ke atas sebanyak count baris
    for (let i = 0; i < count; i++) {
      this.board.shift();
      // Tambah baris trash di bawah
      const trashRow = [];
      for (let c = 0; c < this.cols; c++) {
        trashRow.push(Math.random() > 0.25 ? -1 : 0);
      }
      this.board.push(trashRow);
    }
  }

  /** Serialize board state untuk multiplayer sync */
  getState() {
    return {
      board:  this.board.map(r => [...r]),
      score:  this.score,
      combo:  this.combo,
      blocks: this.currentBlocks.map(b => b ? {
        color: b.color, cells: b.cells, shape: { id: b.shape.id }
      } : null),
    };
  }

  /** Update board dari state multiplayer (untuk papan lawan) */
  setStateFromRemote(state) {
    if (state.board) this.board = state.board;
  }
}

// Ekspor sebagai global
window.GameEngine = GameEngine;
