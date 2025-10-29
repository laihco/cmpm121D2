import "./style.css";

// ─── Document Setup ───────────────────────────────────────────────
document.title = "रंगोली";

const container = document.createElement("div");
container.id = "canvas-container";
container.classList.add("app"); // ← retro app grid
document.body.appendChild(container);

// Create left sidebar + right stage regions
const sidebar = document.createElement("aside");
sidebar.id = "sidebar";
const stage = document.createElement("div");
stage.id = "stage";
container.appendChild(sidebar);
container.appendChild(stage);

// Helper to make retro "group" panels
function makeGroup(title: string) {
  const group = document.createElement("div");
  group.className = "group";
  const t = document.createElement("div");
  t.className = "group-title";
  t.textContent = title;
  group.appendChild(t);
  return { group, body: group };
}

// ─── Tool Buttons (Thin / Thick) ─────────────────────────────────
const toolbar = document.createElement("div");
toolbar.id = "toolbar";

const thinBtn = document.createElement("button");
thinBtn.className = "tool-button selectedTool";
thinBtn.textContent = "Thin";

const thickBtn = document.createElement("button");
thickBtn.className = "tool-button";
thickBtn.textContent = "Thick";

toolbar.appendChild(thinBtn);
toolbar.appendChild(thickBtn);

// Wrap Tools in a sidebar group
const toolsPanel = makeGroup("Tools");
toolsPanel.body.appendChild(toolbar);
sidebar.appendChild(toolsPanel.group);

// ─── Sticker Bar (Data-driven) ───────────────────────────────────
const stickerbar = document.createElement("div");
stickerbar.id = "stickerbar";

let stickers: string[] = ["🌸", "⭐", "🪄", "🌿", "💠", "🎈"]; // retro-ish starter set
let stickerBtns: HTMLButtonElement[] = [];

function renderStickerbar() {
  stickerbar.innerHTML = "";

  // Build sticker buttons from data
  stickerBtns = stickers.map((emoji) => {
    const b = document.createElement("button");
    b.className = "tool-button";
    b.textContent = emoji;
    b.addEventListener("click", () => selectSticker(emoji, b));
    stickerbar.appendChild(b);
    return b;
  });

  // "+ Add" custom sticker button
  const addBtn = document.createElement("button");
  addBtn.className = "tool-button";
  addBtn.textContent = "+ Add";
  addBtn.title = "Create a custom sticker";
  addBtn.addEventListener("click", () => {
    const text = prompt("Custom sticker text", "🧽");
    if (text == null) return; // user cancelled
    const value = text.trim();
    if (!value) return; // ignore empty/whitespace
    // Add to data and rebuild UI
    stickers = [...stickers, value];
    renderStickerbar();
    // Auto-select the newly added sticker
    const lastBtn = stickerBtns[stickerBtns.length - 1];
    selectSticker(value, lastBtn);
  });

  stickerbar.appendChild(addBtn);
}
renderStickerbar();

// Wrap Stickers in a sidebar group
const stickersPanel = makeGroup("Stickers");
stickersPanel.body.appendChild(stickerbar);
sidebar.appendChild(stickersPanel.group);

// ─── Tool State ──────────────────────────────────────────────────
type Tool =
  | { kind: "marker"; thickness: number }
  | { kind: "sticker"; emoji: string };

let tool: Tool = { kind: "marker", thickness: 2 };

function clearStickerSelections() {
  stickerBtns.forEach((b) => b.classList.remove("selectedTool"));
}

function selectMarker(thickness: number, btn: HTMLButtonElement) {
  tool = { kind: "marker", thickness };
  thinBtn.classList.toggle("selectedTool", btn === thinBtn);
  thickBtn.classList.toggle("selectedTool", btn === thickBtn);
  clearStickerSelections();
  preview = null;
  notifyToolMoved();
}

function selectSticker(emoji: string, btn: HTMLButtonElement) {
  tool = { kind: "sticker", emoji };
  thinBtn.classList.remove("selectedTool");
  thickBtn.classList.remove("selectedTool");
  clearStickerSelections();
  btn.classList.add("selectedTool");
  // allow preview to show on next move
  notifyToolMoved();
}

thinBtn.addEventListener("click", () => selectMarker(4, thinBtn));   // tuned default
thickBtn.addEventListener("click", () => selectMarker(14, thickBtn)); // tuned default

// ─── Canvas Setup (goes into the stage on the right) ─────────────
const canvas = document.createElement("canvas");
canvas.id = "main-canvas";
canvas.width = 512; // bigger drawing area
canvas.height = 512;
stage.appendChild(canvas);

const ctx = canvas.getContext("2d")!;
ctx.lineCap = "round";

// ─── Color Palette (square swatches) ─────────────────────────────
const colorbar = document.createElement("div");
colorbar.id = "colorbar";

// A retro-leaning palette
const colors = [
  "#000000", "#7f7f7f", "#ffffff",
  "#ff0000", "#800000",
  "#ffff00", "#808000",
  "#00ff00", "#008000",
  "#00ffff", "#008080",
  "#0000ff", "#000080",
  "#ff00ff", "#800080",
  "#ffa500", "#804000",
  "#a52a2a"
];
let currentColor = colors[0];

colors.forEach((c) => {
  const swatch = document.createElement("button");
  swatch.className = "color-swatch";
  swatch.style.backgroundColor = c;
  if (c === currentColor) swatch.classList.add("selectedColor");
  swatch.addEventListener("click", () => {
    currentColor = c;
    ctx.strokeStyle = c; // global style (old strokes recolor — same as your current behavior)
    document
      .querySelectorAll(".color-swatch")
      .forEach((b) => b.classList.remove("selectedColor"));
    swatch.classList.add("selectedColor");
  });
  colorbar.appendChild(swatch);
});

// Wrap Colors in a sidebar group
const colorsPanel = makeGroup("Colors");
colorsPanel.body.appendChild(colorbar);
sidebar.appendChild(colorsPanel.group);

ctx.strokeStyle = currentColor;

// ─── Drawing Commands ────────────────────────────────────────────
type Point = { x: number; y: number };

interface Drawable {
  display(ctx: CanvasRenderingContext2D): void;
}

class Stroke implements Drawable {
  private points: Point[] = [];
  constructor(private width: number, initial?: Point) {
    if (initial) this.points.push(initial);
  }
  drag(x: number, y: number) {
    this.points.push({ x, y });
  }
  display(ctx: CanvasRenderingContext2D) {
    if (this.points.length < 2) return;
    ctx.save();
    ctx.lineWidth = this.width;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ─── Sticker Commands ────────────────────────────────────────────
class Sticker implements Drawable {
  constructor(
    public x: number,
    public y: number,
    public emoji: string,
    public size = Math.round(canvas.width * 0.085), // scale with canvas for nicer feel
    public angle = 0,
  ) {}
  drag(x: number, y: number) {
    this.x = x;
    this.y = y; // reposition, not a path
  }
  display(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.angle) ctx.rotate(this.angle);
    ctx.font =
      `${this.size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, 0, 0);
    ctx.restore();
  }
}

// ─── Tool Preview ────────────────────────────────────────────────
interface Preview {
  draw(ctx: CanvasRenderingContext2D): void;
}

class CirclePreview implements Preview {
  constructor(public x: number, public y: number, public radius: number) {}
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#666";
    ctx.stroke();
    ctx.restore();
  }
}

class StickerPreview implements Preview {
  constructor(
    public x: number,
    public y: number,
    public emoji: string,
    public size = Math.round(canvas.width * 0.085),
  ) {}
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.font =
      `${this.size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

let preview: Preview | null = null;

// ─── Display List / Undo-Redo State ──────────────────────────────
let displayList: Drawable[] = [];
let redoStack: Drawable[] = [];
let currentStroke: Stroke | null = null;
let currentSticker: Sticker | null = null;

// ─── Redraw + Event System ───────────────────────────────────────
function renderAll() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const item of displayList) item.display(ctx);
  if (!currentStroke && !currentSticker && preview) preview.draw(ctx);
}

canvas.addEventListener("drawing-changed", renderAll);
canvas.addEventListener("tool-moved", renderAll);

function notifyChange() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}
function notifyToolMoved() {
  canvas.dispatchEvent(new Event("tool-moved"));
}

// ─── Input Handling ──────────────────────────────────────────────
canvas.addEventListener("mousedown", (e) => {
  preview = null; // hide preview while drawing/placing
  if (tool.kind === "marker") {
    currentStroke = new Stroke(tool.thickness, { x: e.offsetX, y: e.offsetY });
    displayList.push(currentStroke);
    redoStack = [];
    notifyChange();
  } else {
    currentSticker = new Sticker(e.offsetX, e.offsetY, tool.emoji);
    displayList.push(currentSticker);
    redoStack = [];
    notifyChange();
  }
});

canvas.addEventListener("mousemove", (e) => {
  if (currentStroke) {
    currentStroke.drag(e.offsetX, e.offsetY);
    notifyChange();
  } else if (currentSticker) {
    currentSticker.drag(e.offsetX, e.offsetY);
    notifyChange();
  } else {
    // Update preview for current tool
    if (tool.kind === "marker") {
      preview = new CirclePreview(e.offsetX, e.offsetY, tool.thickness / 2);
    } else {
      preview = new StickerPreview(e.offsetX, e.offsetY, tool.emoji);
    }
    notifyToolMoved();
  }
});

canvas.addEventListener("mouseup", () => {
  currentStroke = null;
  currentSticker = null;
  // preview resumes on next move
});

canvas.addEventListener("mouseleave", () => {
  currentStroke = null;
  currentSticker = null;
  preview = null; // hide preview when pointer leaves canvas
  notifyToolMoved();
});

// ─── Clear / Undo / Redo / Export Buttons ────────────────────────
const actions = document.createElement("div");
actions.id = "actions";

const clearBtn = document.createElement("button");
clearBtn.className = "action-button";
clearBtn.textContent = "Clear";
clearBtn.addEventListener("click", () => {
  displayList = [];
  redoStack = [];
  currentStroke = null;
  currentSticker = null;
  preview = null;
  notifyChange();
});
actions.appendChild(clearBtn);

const undoBtn = document.createElement("button");
undoBtn.className = "action-button";
undoBtn.textContent = "Undo";
undoBtn.addEventListener("click", () => {
  if (displayList.length === 0) return;
  const cmd = displayList.pop()!;
  redoStack.push(cmd);
  notifyChange();
});
actions.appendChild(undoBtn);

const redoBtn = document.createElement("button");
redoBtn.className = "action-button";
redoBtn.textContent = "Redo";
redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) return;
  const cmd = redoStack.pop()!;
  displayList.push(cmd);
  notifyChange();
});
actions.appendChild(redoBtn);

// High-Res Export (scaled to current canvas)
function exportHiResPNG() {
  const scale = 4;
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = canvas.width * scale;
  exportCanvas.height = canvas.height * scale;

  const ex = exportCanvas.getContext("2d")!;
  ex.lineCap = "round";
  ex.fillStyle = "#ffffffff";
  ex.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  // current global stroke style (since strokes don't store color yet)
  ex.strokeStyle = (ctx.strokeStyle as string) || "#000000";

  ex.scale(scale, scale);

  // Replay only the committed items (no previews)
  for (const item of displayList) item.display(ex);

  // Trigger download
  const anchor = document.createElement("a");
  anchor.href = exportCanvas.toDataURL("image/png");
  anchor.download = "sketchpad.png";
  anchor.click();
}

const exportBtn = document.createElement("button");
exportBtn.className = "action-button";
exportBtn.textContent = "Export PNG";
exportBtn.addEventListener("click", exportHiResPNG);
actions.appendChild(exportBtn);

// Wrap Actions in a sidebar group
const actionsPanel = makeGroup("Actions");
actionsPanel.body.appendChild(actions);
sidebar.appendChild(actionsPanel.group);

// ─── Initial Draw ────────────────────────────────────────────────
notifyChange();
