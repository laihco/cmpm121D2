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

interface Drawable {
  display(ctx: CanvasRenderingContext2D): void;
}

class Stroke implements Drawable {
  private points: Point[] = [];

  constructor(initial?: Point) {
    if (initial) this.points.push(initial);
  }

  drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  display(ctx: CanvasRenderingContext2D) {
    if (this.points.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
  }
}

// Now the display list + redo stack hold Drawable, not raw geometry.
let displayList: Drawable[] = [];
let redoStack: Drawable[] = [];
let currentStroke: Stroke | null = null;

// ─── Redraw + Event System ───────────────────────────────────────
function redraw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const item of displayList) item.display(ctx);
}

canvas.addEventListener("drawing-changed", redraw);
function notifyChange() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

// ─── Input Handling ──────────────────────────────────────────────
canvas.addEventListener("mousedown", (e) => {
  currentStroke = new Stroke({ x: e.offsetX, y: e.offsetY });
  displayList.push(currentStroke);
  redoStack = []; // clear redo on new action
  notifyChange();
});

canvas.addEventListener("mousemove", (e) => {
  if (!currentStroke) return;
  currentStroke.drag(e.offsetX, e.offsetY);
  notifyChange();
});

canvas.addEventListener("mouseup", () => (currentStroke = null));
canvas.addEventListener("mouseleave", () => (currentStroke = null));

// ─── Clear / Undo / Redo Buttons ─────────────────────────────────
const clearBtn = document.createElement("button");
clearBtn.textContent = "Clear Canvas";
clearBtn.addEventListener("click", () => {
  displayList = [];
  redoStack = [];
  currentStroke = null;
  notifyChange();
});
container.appendChild(clearBtn);

const undoBtn = document.createElement("button");
undoBtn.textContent = "Undo";
undoBtn.addEventListener("click", () => {
  if (displayList.length === 0) return;
  const cmd = displayList.pop()!;
  redoStack.push(cmd);
  notifyChange();
});
container.appendChild(undoBtn);

const redoBtn = document.createElement("button");
redoBtn.textContent = "Redo";
redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) return;
  const cmd = redoStack.pop()!;
  displayList.push(cmd);
  notifyChange();
});
container.appendChild(redoBtn);

// ─── Initial Draw ────────────────────────────────────────────────
notifyChange();
