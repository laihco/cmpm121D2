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

// Selected tool state (line thickness in px)
let selectedThickness = 2;

// Button interactions
function selectTool(thickness: number, btn: HTMLButtonElement) {
  selectedThickness = thickness;
  thinBtn.classList.toggle("selectedTool", btn === thinBtn);
  thickBtn.classList.toggle("selectedTool", btn === thickBtn);
}

thinBtn.addEventListener("click", () => selectTool(2, thinBtn));
thickBtn.addEventListener("click", () => selectTool(8, thickBtn));

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

// Display list + redo
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
  currentStroke = new Stroke(selectedThickness, { x: e.offsetX, y: e.offsetY });
  displayList.push(currentStroke);
  redoStack = []; // clear redo on new stroke
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
const actions = document.createElement("div");
actions.id = "actions";

const clearBtn = document.createElement("button");
clearBtn.textContent = "Clear";
clearBtn.addEventListener("click", () => {
  displayList = [];
  redoStack = [];
  currentStroke = null;
  notifyChange();
});

const undoBtn = document.createElement("button");
undoBtn.textContent = "Undo";
undoBtn.addEventListener("click", () => {
  if (displayList.length === 0) return;
  const cmd = displayList.pop()!;
  redoStack.push(cmd);
  notifyChange();
});

const redoBtn = document.createElement("button");
redoBtn.textContent = "Redo";
redoBtn.addEventListener("click", () => {
  if (redoStack.length === 0) return;
  const cmd = redoStack.pop()!;
  displayList.push(cmd);
  notifyChange();
});

actions.appendChild(clearBtn);
actions.appendChild(undoBtn);
actions.appendChild(redoBtn);
container.appendChild(actions);

// ─── Initial Draw ────────────────────────────────────────────────
notifyChange();
