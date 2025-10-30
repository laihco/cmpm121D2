import "./style.css";

// ─── Document Setup ───────────────────────────────────────────────
document.title = "रंगोली";

const container = document.createElement("div");
container.id = "canvas-container";
container.classList.add("app");
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

let stickers: string[] = ["🌸", "⭐", "🪄", "🌿", "💠", "🎈"];
let stickerBtns: HTMLButtonElement[] = [];

function renderStickerbar() {
  stickerbar.innerHTML = "";

  // Build sticker buttons from data
  stickerBtns = stickers.map((emoji) => {
    const b = document.createElement("button");
    b.className = "tool-button";
    b.textContent = emoji;
    b.addEventListener(
      "click",
      () => selectSticker(emoji, b, /*randomize=*/ true),
    );
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
    if (text == null) return;
    const value = text.trim();
    if (!value) return;
    stickers = [...stickers, value];
    renderStickerbar();
    const lastBtn = stickerBtns[stickerBtns.length - 1];
    selectSticker(value, lastBtn, /*randomize=*/ true);
  });

  stickerbar.appendChild(addBtn);
}
renderStickerbar();

const stickersPanel = makeGroup("Stickers");
stickersPanel.body.appendChild(stickerbar);
sidebar.appendChild(stickersPanel.group);

// ─── Canvas Setup (goes into the stage on the right) ─────────────
const canvas = document.createElement("canvas");
canvas.id = "main-canvas";
canvas.width = 512;
canvas.height = 512;
stage.appendChild(canvas);

const ctx = canvas.getContext("2d")!;
ctx.lineCap = "round";

// ─── Color Palette (square swatches) ─────────────────────────────
const colorbar = document.createElement("div");
colorbar.id = "colorbar";

// Utility: HSL → HEX for pretty hues
function hslToHex(h: number, s = 72, l = 45) {
  // s,l given in percent
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let [r, g, b] = [0, 0, 0];

  if (0 <= h && h < 60) [r, g, b] = [c, x, 0];
  else if (60 <= h && h < 120) [r, g, b] = [x, c, 0];
  else if (120 <= h && h < 180) [r, g, b] = [0, c, x];
  else if (180 <= h && h < 240) [r, g, b] = [0, x, c];
  else if (240 <= h && h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// A retro-leaning swatch palette (still supported)
const swatchColors = [
  "#000000",
  "#7f7f7f",
  "#ffffff",
  "#ff0000",
  "#800000",
  "#ffff00",
  "#808000",
  "#00ff00",
  "#008000",
  "#00ffff",
  "#008080",
  "#0000ff",
  "#000080",
  "#ff00ff",
  "#800080",
  "#ffa500",
  "#804000",
  "#a52a2a",
];

// Current “queued” variations (used when you start the next action)
let currentColor = swatchColors[0]; // marker color for NEXT stroke
let queuedHueDeg: number | null = null; // precise hue via slider (if set)
let queuedStickerDeg = 0; // precise rotation via slider

// Build swatches (click = override with fixed color)
swatchColors.forEach((c) => {
  const swatch = document.createElement("button");
  swatch.className = "color-swatch";
  swatch.style.backgroundColor = c;
  if (c === currentColor) swatch.classList.add("selectedColor");
  swatch.addEventListener("click", () => {
    currentColor = c; // per-stroke color (does not recolor old strokes)
    queuedHueDeg = null; // swatch overrides slider-chosen hue
    document
      .querySelectorAll(".color-swatch")
      .forEach((b) => b.classList.remove("selectedColor"));
    swatch.classList.add("selectedColor");
    notifyToolMoved();
  });
  colorbar.appendChild(swatch);
});

const colorsPanel = makeGroup("Colors");
colorsPanel.body.appendChild(colorbar);
sidebar.appendChild(colorsPanel.group);

// ─── Tool State ──────────────────────────────────────────────────
type Tool =
  | { kind: "marker"; thickness: number }
  | { kind: "sticker"; emoji: string };

let tool: Tool = { kind: "marker", thickness: 2 };

// ─── “Variation” UI (Randomize + Slider) ─────────────────────────
// One slider that means: Hue (marker) OR Rotation (sticker)
const variationWrap = document.createElement("div");
variationWrap.id = "variation";

const sliderLabel = document.createElement("label");
sliderLabel.textContent = "Hue / Rotation";

const slider = document.createElement("input");
slider.type = "range";
slider.min = "0";
slider.max = "360";
slider.value = "0";
slider.step = "1";
slider.addEventListener("input", () => {
  if (tool.kind === "marker") {
    queuedHueDeg = Number(slider.value);
    currentColor = hslToHex(queuedHueDeg);
    syncSwatchSelectionToCurrentColor();
  } else {
    queuedStickerDeg = Number(slider.value);
  }
  notifyToolMoved(); // updates preview with new hue/angle
});

// Small preview chip for “next” variation
const nextPreview = document.createElement("div");
nextPreview.style.display = "flex";
nextPreview.style.alignItems = "center";
nextPreview.style.gap = "8px";
const chip = document.createElement("div");
chip.style.width = "18px";
chip.style.height = "18px";
chip.style.borderRadius = "50%";
chip.style.border = "1px solid #999";
const chipText = document.createElement("span");
chipText.style.fontSize = "12px";
chipText.style.opacity = "0.8";
nextPreview.appendChild(chip);
nextPreview.appendChild(chipText);

// “Randomize” behavior happens automatically when you click a tool button,
// but we also expose a manual randomize button for convenience.
const randomizeBtn = document.createElement("button");
randomizeBtn.className = "action-button";
randomizeBtn.textContent = "Randomize";
randomizeBtn.addEventListener("click", () => {
  randomizeVariationForCurrentTool();
  notifyToolMoved();
});

variationWrap.appendChild(sliderLabel);
variationWrap.appendChild(slider);
variationWrap.appendChild(nextPreview);
variationWrap.appendChild(randomizeBtn);

const variationPanel = makeGroup("Tool Variations");
variationPanel.body.appendChild(variationWrap);
sidebar.appendChild(variationPanel.group);

// Helpers for randomization
function randomHueDeg() {
  return Math.floor(Math.random() * 360);
}
function randomAngleDeg(range = 25) {
  // small tilt for stickers
  return Math.floor((Math.random() * 2 - 1) * range);
}
function randomizeVariationForCurrentTool() {
  if (tool.kind === "marker") {
    queuedHueDeg = randomHueDeg();
    currentColor = hslToHex(queuedHueDeg);
    slider.value = String(queuedHueDeg);
    syncSwatchSelectionToCurrentColor();
  } else {
    queuedStickerDeg = randomAngleDeg();
    slider.value = String(queuedStickerDeg);
  }
}

// Keep the swatch highlight if the color is in swatches; otherwise clear all
function syncSwatchSelectionToCurrentColor() {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(".color-swatch"),
  );
  let matched = false;
  for (const b of buttons) {
    // Compute the hex string from style; easiest is to compare via a temp element
    const temp = document.createElement("div");
    temp.style.color = currentColor;
    document.body.appendChild(temp);
    const wanted = getComputedStyle(temp).color; // rgb(...)
    document.body.removeChild(temp);
    const isMatch = getComputedStyle(b).backgroundColor === wanted;
    b.classList.toggle("selectedColor", isMatch);
    if (isMatch) matched = true;
  }
  if (!matched) {
    buttons.forEach((b) => b.classList.remove("selectedColor"));
  }
  updateChip();
}

// ─── Drawing Commands ────────────────────────────────────────────
type Point = { x: number; y: number };

interface Drawable {
  display(ctx: CanvasRenderingContext2D): void;
}

class Stroke implements Drawable {
  private points: Point[] = [];
  constructor(
    private width: number,
    private color: string,
    initial?: Point,
  ) {
    if (initial) this.points.push(initial);
  }
  drag(x: number, y: number) {
    this.points.push({ x, y });
  }
  display(ctx: CanvasRenderingContext2D) {
    if (this.points.length < 2) return;
    ctx.save();
    ctx.lineWidth = this.width;
    ctx.strokeStyle = this.color; // ← each stroke remembers its own color
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
    public size = Math.round(canvas.width * 0.085),
    public angleRad = 0,
  ) {}
  drag(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  display(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    if (this.angleRad) ctx.rotate(this.angleRad);
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
  constructor(
    public x: number,
    public y: number,
    public radius: number,
    public color: string,
  ) {}
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = this.color;
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
    public angleRad = 0,
  ) {}
  draw(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.translate(this.x, this.y);
    if (this.angleRad) ctx.rotate(this.angleRad);
    ctx.font =
      `${this.size}px system-ui, Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, 0, 0);
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
  updateChip();
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
    // Use the currently queued color
    currentStroke = new Stroke(
      tool.thickness,
      currentColor,
      { x: e.offsetX, y: e.offsetY },
    );
    displayList.push(currentStroke);
    redoStack = [];
    notifyChange();
  } else {
    // Use the currently queued rotation (deg → rad)
    const rad = (queuedStickerDeg * Math.PI) / 180;
    currentSticker = new Sticker(
      e.offsetX,
      e.offsetY,
      tool.emoji,
      undefined,
      rad,
    );
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
      preview = new CirclePreview(
        e.offsetX,
        e.offsetY,
        tool.thickness / 2,
        currentColor,
      );
    } else {
      const rad = (queuedStickerDeg * Math.PI) / 180;
      preview = new StickerPreview(
        e.offsetX,
        e.offsetY,
        tool.emoji,
        undefined,
        rad,
      );
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
  ex.scale(scale, scale);

  // Replay items; each Stroke/Sticker handles its own style/rotation
  for (const item of displayList) item.display(ex);

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

const actionsPanel = makeGroup("Actions");
actionsPanel.body.appendChild(actions);
sidebar.appendChild(actionsPanel.group);

// ─── Tool Selection (with automatic randomization) ───────────────
function clearStickerSelections() {
  stickerBtns.forEach((b) => b.classList.remove("selectedTool"));
}

function selectMarker(
  thickness: number,
  btn: HTMLButtonElement,
  randomize = false,
) {
  tool = { kind: "marker", thickness };
  thinBtn.classList.toggle("selectedTool", btn === thinBtn);
  thickBtn.classList.toggle("selectedTool", btn === thickBtn);
  clearStickerSelections();

  if (randomize) {
    // Randomize hue for NEXT stroke
    queuedHueDeg = randomHueDeg();
    currentColor = hslToHex(queuedHueDeg);
    slider.value = String(queuedHueDeg);
    syncSwatchSelectionToCurrentColor();
  }
  preview = null;
  notifyToolMoved();
}

function selectSticker(
  emoji: string,
  btn: HTMLButtonElement,
  randomize = false,
) {
  tool = { kind: "sticker", emoji };
  thinBtn.classList.remove("selectedTool");
  thickBtn.classList.remove("selectedTool");
  clearStickerSelections();
  btn.classList.add("selectedTool");

  if (randomize) {
    // Randomize rotation for NEXT placement
    queuedStickerDeg = randomAngleDeg();
    slider.value = String(queuedStickerDeg);
  }
  notifyToolMoved();
}

thinBtn.addEventListener(
  "click",
  () => selectMarker(4, thinBtn, /*randomize=*/ true),
);
thickBtn.addEventListener(
  "click",
  () => selectMarker(14, thickBtn, /*randomize=*/ true),
);

// ─── Initial Draw ────────────────────────────────────────────────
function updateChip() {
  // chip shows next marker color OR next sticker rotation
  if (tool.kind === "marker") {
    chip.style.backgroundColor = currentColor;
    chipText.textContent = `Hue ${
      queuedHueDeg == null ? "—" : Math.round(queuedHueDeg)
    }°`;
  } else {
    chip.style.backgroundColor = "#fff";
    chipText.textContent = `Rotate ${Math.round(queuedStickerDeg)}°`;
  }
}

notifyChange();
