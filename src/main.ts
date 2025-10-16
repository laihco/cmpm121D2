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
document.body.appendChild(canvas);

const ctx = canvas.getContext("2d")!;
ctx.lineWidth = 4;
ctx.lineCap = "round";
ctx.strokeStyle = "#ff0000";

// Fill initial white background
ctx.fillStyle = "#ffffffff";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// ─── Cursor State ────────────────────────────────────────────────
const cursor = { active: false, x: 0, y: 0 };

// ─── Drawing Event Handlers ─────────────────────────────────────
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;
});

canvas.addEventListener("mouseup", () => {
  cursor.active = false;
});

canvas.addEventListener("mousemove", (e) => {
  if (!cursor.active) return;
  ctx.beginPath();
  ctx.moveTo(cursor.x, cursor.y);
  ctx.lineTo(e.offsetX, e.offsetY);
  ctx.stroke();
  cursor.x = e.offsetX;
  cursor.y = e.offsetY;
});

// ─── Clear Canvas Function ──────────────────────────────────────
function clearCanvas() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// ─── Clear Button Setup ─────────────────────────────────────────
const clearBtn = document.createElement("button");
clearBtn.id = "clear-canvas-button";
clearBtn.textContent = "Clear Canvas";
clearBtn.addEventListener("click", () => {
  clearCanvas();
  cursor.active = false;
});
container.appendChild(clearBtn);
