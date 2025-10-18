import "./style.css";

// ─── Document Setup ───────────────────────────────────────────────
document.title = "रंगोली";

const container = document.createElement("div");
container.id = "canvas-container";
document.body.appendChild(container);

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
container.appendChild(toolbar);

// ─── Sticker Buttons ─────────────────────────────────────────────
const stickerbar = document.createElement("div");
stickerbar.id = "stickerbar";

const stickers = ["⭐", "🌸", "🎈"];
const stickerBtns: HTMLButtonElement[] = stickers.map((emoji) => {
  const b = document.createElement("button");
  b.className = "tool-button";
  b.textContent = emoji;
  stickerbar.appendChild(b);
  return b;
});

toolbar.appendChild(stickerbar);

// ─── Tool State ──────────────────────────────────────────────────
type Tool =
  | { kind: "marker"; thickness: number }
  | { kind: "sticker"; emoji: string };

let tool: Tool = { kind: "marker", thickness: 2 };

function selectMarker(thickness: number, btn: HTMLButtonElement) {
  tool = { kind: "marker", thickness };
  thinBtn.classList.toggle("selectedTool", btn === thinBtn);
  thickBtn.classList.toggle("selectedTool", btn === thickBtn);
  stickerBtns.forEach((b) => b.classList.remove("selectedTool"));
  preview = null;
  notifyToolMoved();
}

thinBtn.addEventListener("click", () => selectMarker(2, thinBtn));
thickBtn.addEventListener("click", () => selectMarker(8, thickBtn));

stickerBtns.forEach((btn, i) => {
  btn.addEventListener("click", () => {
    tool = { kind: "sticker", emoji: stickers[i] };
    thinBtn.classList.remove("selectedTool");
    thickBtn.classList.remove("selectedTool");
    stickerBtns.forEach((b) => b.classList.toggle("selectedTool", b === btn));
    // fire tool-moved per spec (and allow a preview to appear on next move)
    notifyToolMoved();
  });
});

// ─── Canvas Setup ────────────────────────────────────────────────
const canvas = document.createElement("canvas");
canvas.id = "main-canvas";
canvas.width = 256;
canvas.height = 256;
container.appendChild(canvas);

const ctx = canvas.getContext("2d")!;
ctx.lineCap = "round";
ctx.strokeStyle = "#ff0000";

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
    public size = 32,
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
    ctx.strokeStyle = "#666"; // subtle ring
    ctx.stroke();
    ctx.restore();
  }
}

class StickerPreview implements Preview {
  constructor(
    public x: number,
    public y: number,
    public emoji: string,
    public size = 32,
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
    currentSticker = new Sticker(e.offsetX, e.offsetY, tool.emoji, 32);
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
      preview = new StickerPreview(e.offsetX, e.offsetY, tool.emoji, 32);
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

// ─── Clear / Undo / Redo Buttons ─────────────────────────────────
const actions = document.createElement("div");
actions.id = "actions";

const clearBtn = document.createElement("button");
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
undoBtn.textContent = "Undo";
undoBtn.addEventListener("click", () => {
  if (displayList.length === 0) return;
  const cmd = displayList.pop()!;
  redoStack.push(cmd);
  notifyChange();
});
actions.appendChild(undoBtn);

const redoBtn = document.createElement("button");
redoBtn.textContent = "Redo";
redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) return;
  const cmd = redoStack.pop()!;
  displayList.push(cmd);
  notifyChange();
});
actions.appendChild(redoBtn);

container.appendChild(actions);

// ─── Initial Draw ────────────────────────────────────────────────
notifyChange();
