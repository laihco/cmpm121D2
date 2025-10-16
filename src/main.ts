import "./style.css";

// ─── Document Setup ───────────────────────────────────────────────
document.title = "रंगोली";

const container = document.createElement("div");
container.id = "canvas-container";
document.body.appendChild(container);

// ─── Canvas Setup ────────────────────────────────────────────────
const canvas = document.createElement("canvas");
canvas.id = "main-canvas";
canvas.width = 256;
canvas.height = 256;
container.appendChild(canvas);

const ctx = canvas.getContext("2d")!;
ctx.lineWidth = 4;
ctx.lineCap = "round";
ctx.strokeStyle = "#ff0000";

// ─── Drawing Data ────────────────────────────────────────────────
type Point = { x: number; y: number };
let strokes: Point[][] = [];
let redoStack: Point[][] = [];
let currentStroke: Point[] | null = null;

// ─── Redraw + Event System ───────────────────────────────────────
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    ctx.moveTo(stroke[0].x, stroke[0].y);
    for (let i = 1; i < stroke.length; i++) {
      ctx.lineTo(stroke[i].x, stroke[i].y);
    }
  }
  ctx.stroke();
}

canvas.addEventListener("drawing-changed", redraw);

function notifyChange() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

// ─── Input Handling ──────────────────────────────────────────────
canvas.addEventListener("mousedown", (e) => {
  currentStroke = [];
  strokes.push(currentStroke);
  redoStack = []; // clear redo on new stroke
  currentStroke.push({ x: e.offsetX, y: e.offsetY });
  notifyChange();
});

canvas.addEventListener("mousemove", (e) => {
  if (!currentStroke) return;
  currentStroke.push({ x: e.offsetX, y: e.offsetY });
  notifyChange();
});

canvas.addEventListener("mouseup", () => {
  currentStroke = null;
});

canvas.addEventListener("mouseleave", () => {
  currentStroke = null;
});

// ─── Clear / Undo / Redo Buttons ─────────────────────────────────
const clearBtn = document.createElement("button");
clearBtn.textContent = "Clear Canvas";
clearBtn.addEventListener("click", () => {
  strokes = [];
  redoStack = [];
  currentStroke = null;
  notifyChange();
});
container.appendChild(clearBtn);

const undoBtn = document.createElement("button");
undoBtn.textContent = "Undo";
undoBtn.addEventListener("click", () => {
  if (strokes.length === 0) return;
  const stroke = strokes.pop()!;
  redoStack.push(stroke);
  notifyChange();
});
container.appendChild(undoBtn);

const redoBtn = document.createElement("button");
redoBtn.textContent = "Redo";
redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) return;
  const stroke = redoStack.pop()!;
  strokes.push(stroke);
  notifyChange();
});
container.appendChild(redoBtn);

// ─── Initial Draw ────────────────────────────────────────────────
notifyChange();
