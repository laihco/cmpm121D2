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

// ─── Drawing Data ───────────────────────────────────────
type Point = { x: number; y: number };
let strokes: Point[][] = [];
let currentStroke: Point[] | null = null;

// ─── Redraw on demand ──────────────────────────
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

// ─── Emit change event helper ────────────────────────────────────
function notifyChange() {
  canvas.dispatchEvent(new Event("drawing-changed"));
}

// ─── Input Handling (record points; notify after each) ───────────
canvas.addEventListener("mousedown", (e) => {
  currentStroke = [];
  strokes.push(currentStroke);
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

// ─── Clear Button ────────────────────────────────────────────────
const clearBtn = document.createElement("button");
clearBtn.id = "clear-canvas-button";
clearBtn.textContent = "Clear Canvas";
clearBtn.addEventListener("click", () => {
  strokes = [];
  currentStroke = null;
  notifyChange();
});
container.appendChild(clearBtn);

// ─── Initial paint ───────────────────────────────────────────────
notifyChange();
