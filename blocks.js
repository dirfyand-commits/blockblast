/**
 * blocks.js – Definisi semua bentuk block, warna, dan logika rendering
 * Block Blast Pro – Puzzle Arena
 */

// ── Konstanta Board ──────────────────────────────────────────
const BOARD_COLS = 9;
const BOARD_ROWS = 9;
const CELL_COLORS = [null]; // indeks 0 = kosong

// ── Palet Warna Block ────────────────────────────────────────
const BLOCK_COLORS = [
  null,                    // 0 = empty
  '#4f8eff',               // 1 = biru
  '#00e5ff',               // 2 = cyan
  '#39ff8c',               // 3 = hijau
  '#ffe600',               // 4 = kuning
  '#ff8c00',               // 5 = oranye
  '#ff4fa3',               // 6 = pink
  '#b44fff',               // 7 = ungu
  '#ff3a3a',               // 8 = merah
  '#ffffff',               // 9 = putih
];

const BLOCK_GLOW = {
  1: 'rgba(79,142,255,0.6)',
  2: 'rgba(0,229,255,0.6)',
  3: 'rgba(57,255,140,0.6)',
  4: 'rgba(255,230,0,0.6)',
  5: 'rgba(255,140,0,0.6)',
  6: 'rgba(255,79,163,0.6)',
  7: 'rgba(180,79,255,0.6)',
  8: 'rgba(255,58,58,0.6)',
  9: 'rgba(255,255,255,0.5)',
};

// ── Definisi Semua Bentuk Block ───────────────────────────────
// Setiap block = array of [row, col] relative positions
const BLOCK_SHAPES = [
  // 1×1
  { id: 'single', cells: [[0,0]], size: 1 },

  // 1×2
  { id: 'h2',    cells: [[0,0],[0,1]], size: 2 },
  { id: 'v2',    cells: [[0,0],[1,0]], size: 2 },

  // 1×3
  { id: 'h3',    cells: [[0,0],[0,1],[0,2]], size: 3 },
  { id: 'v3',    cells: [[0,0],[1,0],[2,0]], size: 3 },

  // 1×4
  { id: 'h4',    cells: [[0,0],[0,1],[0,2],[0,3]], size: 4 },
  { id: 'v4',    cells: [[0,0],[1,0],[2,0],[3,0]], size: 4 },

  // 1×5
  { id: 'h5',    cells: [[0,0],[0,1],[0,2],[0,3],[0,4]], size: 5 },
  { id: 'v5',    cells: [[0,0],[1,0],[2,0],[3,0],[4,0]], size: 5 },

  // 2×2 kotak
  { id: 'sq2',   cells: [[0,0],[0,1],[1,0],[1,1]], size: 4 },

  // 3×3 kotak
  { id: 'sq3',   cells: [
    [0,0],[0,1],[0,2],
    [1,0],[1,1],[1,2],
    [2,0],[2,1],[2,2]
  ], size: 9 },

  // L-shapes
  { id: 'L1',    cells: [[0,0],[1,0],[2,0],[2,1]], size: 4 },
  { id: 'L2',    cells: [[0,1],[1,1],[2,0],[2,1]], size: 4 },
  { id: 'L3',    cells: [[0,0],[0,1],[1,0],[2,0]], size: 4 },
  { id: 'L4',    cells: [[0,0],[0,1],[1,1],[2,1]], size: 4 },

  // T-shapes
  { id: 'T1',    cells: [[0,0],[0,1],[0,2],[1,1]], size: 4 },
  { id: 'T2',    cells: [[0,1],[1,0],[1,1],[2,1]], size: 4 },
  { id: 'T3',    cells: [[1,0],[1,1],[1,2],[0,1]], size: 4 },

  // S/Z shapes
  { id: 'S1',    cells: [[0,1],[0,2],[1,0],[1,1]], size: 4 },
  { id: 'Z1',    cells: [[0,0],[0,1],[1,1],[1,2]], size: 4 },

  // Sudut / corner
  { id: 'CRN',   cells: [[0,0],[1,0],[1,1]], size: 3 },
  { id: 'CRN2',  cells: [[0,0],[0,1],[1,0]], size: 3 },

  // Plus / cross
  { id: 'PLUS',  cells: [[0,1],[1,0],[1,1],[1,2],[2,1]], size: 5 },

  // Diagonal-like
  { id: 'DIA',   cells: [[0,0],[1,1],[2,2]], size: 3 },
];

// ── Weight untuk probabilitas block ──────────────────────────
// Block kecil lebih sering muncul
const BLOCK_WEIGHTS = BLOCK_SHAPES.map(s => Math.max(1, 10 - s.size));

function getWeightedRandomShape() {
  const totalW = BLOCK_WEIGHTS.reduce((a,b) => a+b, 0);
  let r = Math.random() * totalW;
  for (let i = 0; i < BLOCK_SHAPES.length; i++) {
    r -= BLOCK_WEIGHTS[i];
    if (r <= 0) return BLOCK_SHAPES[i];
  }
  return BLOCK_SHAPES[0];
}

// ── Generate 3 Block Random ───────────────────────────────────
function generateBlockSet() {
  const blocks = [];
  const usedShapes = new Set();
  for (let i = 0; i < 3; i++) {
    let shape;
    let tries = 0;
    do {
      shape = getWeightedRandomShape();
      tries++;
    } while (usedShapes.has(shape.id) && tries < 20);
    usedShapes.add(shape.id);

    const colorIndex = Math.floor(Math.random() * (BLOCK_COLORS.length - 1)) + 1;
    blocks.push({
      shape: shape,
      color: colorIndex,
      cells: shape.cells,
    });
  }
  return blocks;
}

// ── Hitung bounding box block ─────────────────────────────────
function getBlockBounds(cells) {
  let minR = Infinity, maxR = -Infinity, minC = Infinity, maxC = -Infinity;
  cells.forEach(([r,c]) => {
    if (r < minR) minR = r; if (r > maxR) maxR = r;
    if (c < minC) minC = c; if (c > maxC) maxC = c;
  });
  return { minR, maxR, minC, maxC, rows: maxR-minR+1, cols: maxC-minC+1 };
}

// ── Render block ke canvas ────────────────────────────────────
function renderBlockToCanvas(canvas, cells, colorIndex, cellSize, padding = 4, applySkin = null) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const color = BLOCK_COLORS[colorIndex] || '#4f8eff';
  const glow  = BLOCK_GLOW[colorIndex]  || 'rgba(79,142,255,0.5)';

  // Glow effect
  ctx.shadowColor = glow;
  ctx.shadowBlur  = 10;

  cells.forEach(([r,c]) => {
    const x = c * cellSize + padding;
    const y = r * cellSize + padding;
    const s = cellSize - padding * 0.5;

    // Main block
    ctx.fillStyle = color;
    roundRect(ctx, x, y, s, s, 4);
    ctx.fill();

    // Shine
    ctx.shadowBlur = 0;
    const shine = ctx.createLinearGradient(x, y, x + s, y + s);
    shine.addColorStop(0, 'rgba(255,255,255,0.35)');
    shine.addColorStop(0.5, 'rgba(255,255,255,0)');
    ctx.fillStyle = shine;
    roundRect(ctx, x, y, s, s, 4);
    ctx.fill();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.shadowBlur = 0;
    roundRect(ctx, x, y, s, s, 4);
    ctx.stroke();

    ctx.shadowBlur = 8;
    ctx.shadowColor = glow;
  });
}

// ── Render single cell di board canvas ───────────────────────
function renderCell(ctx, x, y, size, colorIndex, alpha = 1, glowExtra = 0) {
  if (!colorIndex) return;
  const color = BLOCK_COLORS[colorIndex];
  const glow  = BLOCK_GLOW[colorIndex] || 'rgba(79,142,255,0.5)';

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.shadowColor = glow;
  ctx.shadowBlur  = 8 + glowExtra;

  const pad = 1.5;
  ctx.fillStyle = color;
  roundRect(ctx, x+pad, y+pad, size-pad*2, size-pad*2, 5);
  ctx.fill();

  // Inner shine
  ctx.shadowBlur = 0;
  const shine = ctx.createLinearGradient(x, y, x+size, y+size);
  shine.addColorStop(0,   'rgba(255,255,255,0.3)');
  shine.addColorStop(0.45,'rgba(255,255,255,0)');
  ctx.fillStyle = shine;
  roundRect(ctx, x+pad, y+pad, size-pad*2, size-pad*2, 5);
  ctx.fill();

  // Border highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  roundRect(ctx, x+pad, y+pad, size-pad*2, size-pad*2, 5);
  ctx.stroke();

  ctx.restore();
}

// ── Render "ghost" preview ────────────────────────────────────
function renderGhostCell(ctx, x, y, size, colorIndex) {
  if (!colorIndex) return;
  const color = BLOCK_COLORS[colorIndex];
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = color;
  const pad = 1.5;
  roundRect(ctx, x+pad, y+pad, size-pad*2, size-pad*2, 5);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.globalAlpha = 0.6;
  roundRect(ctx, x+pad, y+pad, size-pad*2, size-pad*2, 5);
  ctx.stroke();
  ctx.restore();
}

// ── Render "trash" block (penalti duel) ──────────────────────
function renderTrashCell(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = '#3a3a4a';
  ctx.shadowColor = 'rgba(100,100,120,0.5)';
  ctx.shadowBlur = 4;
  const pad = 1.5;
  roundRect(ctx, x+pad, y+pad, size-pad*2, size-pad*2, 5);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  roundRect(ctx, x+pad, y+pad, size-pad*2, size-pad*2, 5);
  ctx.stroke();
  ctx.restore();
}

// ── Helper: rounded rect path ────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  if (w < 2*r) r = w/2;
  if (h < 2*r) r = h/2;
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.arcTo(x+w, y,   x+w, y+h, r);
  ctx.arcTo(x+w, y+h, x,   y+h, r);
  ctx.arcTo(x,   y+h, x,   y,   r);
  ctx.arcTo(x,   y,   x+w, y,   r);
  ctx.closePath();
}

// ── Warna untuk board background grid ────────────────────────
function renderBoardBackground(ctx, cols, rows, cellSize, boardTheme = 'default') {
  const themes = {
    default: { bg: '#12141f', line: 'rgba(79,142,255,0.1)', cell: '#1a1d2e' },
    forest:  { bg: '#0f1a0f', line: 'rgba(57,255,140,0.12)', cell: '#141f14' },
    sunset:  { bg: '#1a100a', line: 'rgba(255,140,0,0.12)', cell: '#1f1510' },
    ocean:   { bg: '#0a1020', line: 'rgba(0,229,255,0.12)', cell: '#0f1828' },
    galaxy:  { bg: '#0d0a1a', line: 'rgba(180,79,255,0.12)', cell: '#130f20' },
  };
  const t = themes[boardTheme] || themes.default;

  // Board BG
  ctx.fillStyle = t.bg;
  ctx.fillRect(0, 0, cols * cellSize, rows * cellSize);

  // Grid cells
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cellSize;
      const y = r * cellSize;
      ctx.strokeStyle = t.line;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }
  }
}

// ── Generate "trash" block untuk duel penalty ─────────────────
function generateTrashBlock(count = 1) {
  // Trash block = baris horizontal dengan panjang acak
  const len = Math.min(count + 1, BOARD_COLS);
  const cells = [];
  for (let c = 0; c < len; c++) cells.push([0, c]);
  return { shape: { id: 'trash', cells }, color: 0, cells, isTrash: true };
}

// Ekspor sebagai global
window.Blocks = {
  BOARD_COLS, BOARD_ROWS, BLOCK_COLORS, BLOCK_GLOW, BLOCK_SHAPES,
  generateBlockSet, getBlockBounds, renderBlockToCanvas,
  renderCell, renderGhostCell, renderTrashCell,
  renderBoardBackground, generateTrashBlock, roundRect,
};
