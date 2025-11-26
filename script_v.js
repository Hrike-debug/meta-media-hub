/* ---------------------------------------------------------
   Meta Media Hub — Option B (Draggable Split Slider + Annotator)
   Fixed & Stabilised Version (keeps your original design)
--------------------------------------------------------- */

const $ = id => document.getElementById(id);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------------------------------------------------------
   AUTH
--------------------------------------------------------- */
const PASSWORD = "Meta@123";
const AUTH_KEY = "mm_auth";

const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwClose = $("pwClose");
const pwMsg = $("pwMsg");
const statusText = $("statusText");

function isAuthed() {
  return localStorage.getItem(AUTH_KEY) === "true";
}
function saveAuth() {
  localStorage.setItem(AUTH_KEY, "true");
}

function showSection(sec) {
  const home = $("home");
  const enh = $("enhancerSection");
  if (!home || !enh) return;
  home.style.display = sec === "home" ? "flex" : "none";
  enh.style.display = sec === "enhance" ? "block" : "none";
}

function unlock() {
  if (!pwInput) return;
  if (pwInput.value === PASSWORD) {
    saveAuth();
    if (pwModal) pwModal.style.display = "none";
    if (statusText) statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    if (pwMsg) pwMsg.textContent = "Incorrect password";
  }
}

on(pwBtn, "click", unlock);
on(pwInput, "keydown", e => { if (e.key === "Enter") unlock(); });
on(pwClose, "click", ()=> { if (pwModal) pwModal.style.display = "none"; });

// initial state
if (isAuthed()) {
  if (pwModal) pwModal.style.display = "none";
  if (statusText) statusText.textContent = "Unlocked";
  showSection("home");
} else {
  if (pwModal) pwModal.style.display = "flex";
  if (statusText) statusText.textContent = "Locked";
}

/* ---------------------------------------------------------
   NAVIGATION
--------------------------------------------------------- */
on($("btnImage"), "click", ()=>{
  alert("Image Tools module coming next.");
});
on($("btnEnhancer"), "click", ()=> showSection("enhance"));
on($("backHomeFromEnhancer"), "click", ()=> showSection("home"));

on($("aboutBtn"), "click", ()=> {
  const m = $("aboutModal");
  if (m) m.style.display = "flex";
});
on($("closeAbout"), "click", ()=> {
  const m = $("aboutModal");
  if (m) m.style.display = "none";
});

/* ---------------------------------------------------------
   TOOLTIP SYSTEM (safe even if no data-tip elements)
--------------------------------------------------------- */
const tooltip = document.createElement("div");
tooltip.className = "tooltip-box";
tooltip.style.display = "none";
document.body.appendChild(tooltip);

function attachTips() {
  document.querySelectorAll("[data-tip]").forEach(el=>{
    el.addEventListener("mouseenter", ()=>{
      tooltip.textContent = el.dataset.tip;
      tooltip.style.display = "block";
      const r = el.getBoundingClientRect();
      tooltip.style.top = (r.bottom + 8) + "px";
      tooltip.style.left = r.left + "px";
    });
    el.addEventListener("mouseleave", ()=> tooltip.style.display = "none");
  });
}
attachTips();

/* ---------------------------------------------------------
   IMAGE LOADING
--------------------------------------------------------- */
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");

const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const enhFileInfo = $("enhFileInfo");

const beforeImg = $("beforeImg");
const afterImg  = $("afterImg");

let currentImageFile = null;

async function loadEnhImage(file) {
  if (!file) return;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode().catch(()=>{}); // safety

  enhanceCanvas.width  = img.naturalWidth  || img.width  || 0;
  enhanceCanvas.height = img.naturalHeight || img.height || 0;

  if (enhanceCanvas.width && enhanceCanvas.height) {
    enhanceCtx.clearRect(0,0,enhanceCanvas.width,enhanceCanvas.height);
    enhanceCtx.drawImage(img,0,0);
  }

  if (beforeImg) beforeImg.src = url;
  if (afterImg)  afterImg.src  = url;

  currentImageFile = file;
  if (enhFileInfo) {
    enhFileInfo.textContent = `${file.name} — ${enhanceCanvas.width}×${enhanceCanvas.height}px`;
  }

  resetActions();
  refreshSplit();
}

if (dropEnhance) {
  dropEnhance.onclick = ()=> { if (enhanceInput) enhanceInput.click(); };
  dropEnhance.addEventListener("dragover", e=>{ e.preventDefault(); });
  dropEnhance.addEventListener("drop", e=>{
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) loadEnhImage(f);
  });
}

if (enhanceInput) {
  enhanceInput.onchange = e => {
    const f = e.target.files && e.target.files[0];
    if (f) loadEnhImage(f);
  };
}

/* ---------------------------------------------------------
   SPLIT SLIDER
--------------------------------------------------------- */
const splitAfter     = $("splitAfter");      // fixed to match HTML
const splitHandle    = $("splitHandle");
const splitContainer = $("splitContainer");

let splitPos = 0.5;

function refreshSplit() {
  if (!splitContainer || !splitAfter || !splitHandle) return;
  const W = splitContainer.offsetWidth || 1;
  const handleX = splitPos * W;

  splitAfter.style.width = handleX + "px";
  splitHandle.style.left = (handleX - splitHandle.offsetWidth/2) + "px";
}

refreshSplit();

let sliding = false;

if (splitHandle) {
  splitHandle.addEventListener("mousedown", ()=> sliding = true);
}
document.addEventListener("mouseup", ()=> sliding = false);
document.addEventListener("mousemove", e=>{
  if (!sliding || !splitContainer) return;
  const r = splitContainer.getBoundingClientRect();
  splitPos = (e.clientX - r.left) / (r.width || 1);
  splitPos = Math.max(0.05, Math.min(0.95, splitPos));
  refreshSplit();
});

/* ---------------------------------------------------------
   ANNOTATOR (INLINE + MODAL)
--------------------------------------------------------- */
let actions    = [];
let activeTool = null;

const inlineCanvas = $("annoCanvas"); // id fixed in HTML
const inlineCtx    = inlineCanvas ? inlineCanvas.getContext("2d") : null;

function resetActions() {
  actions = [];
  redrawInline();
}

/* TOOL BUTTONS */
document.querySelectorAll(".annot-btn").forEach(btn=>{
  btn.onclick = ()=>{
    document.querySelectorAll(".annot-btn").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");
    activeTool = btn.dataset.tool;
  };
});

/* INLINE DRAW */
let drawing = false;
let sx = 0, sy = 0;

if (inlineCanvas) {
  inlineCanvas.addEventListener("mousedown", e=>{
    if (!activeTool || !inlineCanvas) return;
    drawing = true;
    const r = inlineCanvas.getBoundingClientRect();
    sx = e.clientX - r.left;
    sy = e.clientY - r.top;

    if (activeTool === "text") {
      const txt = prompt("Enter text:");
      if (txt) {
        actions.push({ tool:"text", x:sx, y:sy, text:txt });
        redrawInline();
      }
      drawing = false;
    } else if (activeTool === "free") {
      actions.push({ tool:"free", pts:[{x:sx,y:sy}] });
    } else {
      actions.push({ tool:activeTool, x:sx, y:sy, x2:sx, y2:sy });
    }
  });

  inlineCanvas.addEventListener("mousemove", e=>{
    if (!drawing || !inlineCanvas) return;
    const r = inlineCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    const a = actions[actions.length-1];
    if (!a) return;

    if (a.tool === "free") {
      a.pts.push({x,y});
    } else {
      a.x2 = x;
      a.y2 = y;
    }
    redrawInline();
  });
}

document.addEventListener("mouseup", ()=> drawing = false);

/* DRAW INLINE */
function redrawInline() {
  if (!inlineCanvas || !inlineCtx) return;
  inlineCtx.clearRect(0,0,inlineCanvas.width,inlineCanvas.height);
  actions.forEach(a=> drawAction(inlineCtx,a));
}

function drawAction(ctx, a) {
  if (!ctx || !a) return;
  ctx.save();
  ctx.strokeStyle = "#ff7a3c";
  ctx.fillStyle   = "#ff7a3c";
  ctx.lineWidth   = 3;
  ctx.lineJoin    = "round";
  ctx.lineCap     = "round";

  if (a.tool === "rect") {
    ctx.strokeRect(a.x, a.y, a.x2-a.x, a.y2-a.y);
  }
  if (a.tool === "highlight") {
    ctx.globalAlpha = 0.25;
    ctx.fillRect(a.x, a.y, a.x2-a.x, a.y2-a.y);
  }
  if (a.tool === "blur") {
    ctx.globalAlpha = 0.5;
    ctx.fillRect(a.x, a.y, a.x2-a.x, a.y2-a.y);
  }
  if (a.tool === "arrow") {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x2, a.y2);
    ctx.stroke();
  }
  if (a.tool === "text") {
    ctx.font = "20px Inter, system-ui, sans-serif";
    ctx.fillText(a.text, a.x, a.y);
  }
  if (a.tool === "free" && a.pts && a.pts.length) {
    ctx.beginPath();
    ctx.moveTo(a.pts[0].x, a.pts[0].y);
    for (let i=1;i<a.pts.length;i++) ctx.lineTo(a.pts[i].x, a.pts[i].y);
    ctx.stroke();
  }

  ctx.restore();
}

/* ---------------------------------------------------------
   ANNOTATOR MODAL (ids fixed)
--------------------------------------------------------- */
const annotModal  = $("annotatorModal");
const modalCanvas = $("annotCanvasFull");
const modalCtx    = modalCanvas ? modalCanvas.getContext("2d") : null;

on($("openAnnotatorBtn"), "click", openAnnotator);
on($("annotClose"), "click", ()=> { if (annotModal) annotModal.style.display = "none"; });

function openAnnotator() {
  if (!annotModal) return;
  annotModal.style.display = "flex";
  redrawModalCanvas();
}

/* FULL MODAL DRAWING */
let modalDrawing = false;
let mx = 0, my = 0;

if (modalCanvas) {
  modalCanvas.addEventListener("mousedown", e=>{
    if (!activeTool || !modalCanvas) return;
    modalDrawing = true;
    const r = modalCanvas.getBoundingClientRect();
    mx = e.clientX - r.left;
    my = e.clientY - r.top;

    if (activeTool === "text") {
      const txt = prompt("Enter text:");
      if (txt) actions.push({ tool:"text", x:mx, y:my, text:txt });
      modalDrawing = false;
      redrawModalCanvas();
      return;
    }

    if (activeTool === "free") {
      actions.push({ tool:"free", pts:[{x:mx,y:my}] });
    } else {
      actions.push({ tool:activeTool, x:mx, y:my, x2:mx, y2:my });
    }
    redrawModalCanvas();
  });

  modalCanvas.addEventListener("mousemove", e=>{
    if (!modalDrawing || !modalCanvas) return;
    const r = modalCanvas.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    const a = actions[actions.length-1];
    if (!a) return;
    if (a.tool === "free") a.pts.push({x,y});
    else { a.x2 = x; a.y2 = y; }

    redrawModalCanvas();
  });
}

document.addEventListener("mouseup", ()=> modalDrawing = false);

function redrawModalCanvas() {
  if (!modalCanvas || !modalCtx) return;
  modalCtx.clearRect(0,0,modalCanvas.width,modalCanvas.height);
  actions.forEach(a=> drawAction(modalCtx,a));
}

/* ---------------------------------------------------------
   MERGE ANNOTATIONS INTO FINAL IMAGE
--------------------------------------------------------- */
on($("annotApply"), "click", ()=>{
  if (annotModal) annotModal.style.display = "none";
  redrawInline();
});

on($("miniApply"), "click", ()=>{
  mergeAnnotations();
  if (afterImg) afterImg.src = enhanceCanvas.toDataURL("image/jpeg", 0.92);
  resetActions();
});

function mergeAnnotations() {
  const W = enhanceCanvas.width;
  const H = enhanceCanvas.height;
  if (!W || !H) return;

  const tmp  = document.createElement("canvas");
  tmp.width  = W;
  tmp.height = H;
  const tctx = tmp.getContext("2d");

  tctx.drawImage(enhanceCanvas,0,0);

  if (!inlineCanvas) return;
  const disp   = inlineCanvas.getBoundingClientRect();
  const scaleX = W / (disp.width  || 1);
  const scaleY = H / (disp.height || 1);

  actions.forEach(a=>{
    tctx.save();
    tctx.strokeStyle = "#ff7a3c";
    tctx.fillStyle   = "#ff7a3c";
    tctx.lineWidth   = 4;

    if (a.tool === "rect") {
      tctx.strokeRect(a.x*scaleX, a.y*scaleY,
                      (a.x2-a.x)*scaleX, (a.y2-a.y)*scaleY);
    }

    if (a.tool === "highlight") {
      tctx.globalAlpha = 0.25;
      tctx.fillRect(a.x*scaleX, a.y*scaleY,
                    (a.x2-a.x)*scaleX, (a.y2-a.y)*scaleY);
      tctx.globalAlpha = 1;
    }

    if (a.tool === "text") {
      tctx.font = (28*scaleX) + "px Inter, system-ui, sans-serif";
      tctx.fillText(a.text, a.x*scaleX, a.y*scaleY);
    }

    if (a.tool === "arrow") {
      tctx.beginPath();
      tctx.moveTo(a.x*scaleX, a.y*scaleY);
      tctx.lineTo(a.x2*scaleX, a.y2*scaleY);
      tctx.stroke();
    }

    if (a.tool === "free" && a.pts && a.pts.length) {
      tctx.beginPath();
      tctx.moveTo(a.pts[0].x*scaleX, a.pts[0].y*scaleY);
      for (let i=1;i<a.pts.length;i++) {
        tctx.lineTo(a.pts[i].x*scaleX, a.pts[i].y*scaleY);
      }
      tctx.stroke();
    }

    if (a.tool === "blur") {
      const rx = Math.round(Math.min(a.x,a.x2)*scaleX);
      const ry = Math.round(Math.min(a.y,a.y2)*scaleY);
      const rw = Math.max(1, Math.round(Math.abs(a.x2-a.x)*scaleX));
      const rh = Math.max(1, Math.round(Math.abs(a.y2-a.y)*scaleY));

      try {
        let region = tctx.getImageData(rx,ry,rw,rh);
        for (let i=0;i<6;i++) region = gaussianBlur(region);
        tctx.putImageData(region,rx,ry);
      } catch(e) {
        console.warn("Blur region failed", e);
      }
    }
    tctx.restore();
  });

  enhanceCtx.clearRect(0,0,W,H);
  enhanceCtx.drawImage(tmp,0,0);
}

/* ---------------------------------------------------------
   FILTERS
--------------------------------------------------------- */
function gaussianBlur(imgData){
  const w = imgData.width, h = imgData.height;
  const src = imgData.data;
  const out = new Uint8ClampedArray(src.length);
  const k   = [0.12,0.24,0.28,0.24,0.12];
  const half = 2;

  // Horizontal
  for (let y=0;y<h;y++){
    for (let x=0;x<w;x++){
      let r=0,g=0,b=0,a=255;
      for (let i=-half;i<=half;i++){
        let xx = Math.min(w-1, Math.max(0, x+i));
        let idx = (y*w+xx)*4;
        r += src[idx]   * k[i+half];
        g += src[idx+1] * k[i+half];
        b += src[idx+2] * k[i+half];
      }
      let o = (y*w+x)*4;
      out[o]   = r;
      out[o+1] = g;
      out[o+2] = b;
      out[o+3] = a;
    }
  }

  // Vertical
  const out2 = new Uint8ClampedArray(src.length);
  for (let x=0;x<w;x++){
    for (let y=0;y<h;y++){
      let r=0,g=0,b=0,a=255;
      for (let i=-half;i<=half;i++){
        let yy = Math.min(h-1, Math.max(0, y+i));
        let idx = (yy*w+x)*4;
        r += out[idx]   * k[i+half];
        g += out[idx+1] * k[i+half];
        b += out[idx+2] * k[i+half];
      }
      let o = (y*w+x)*4;
      out2[o]   = r;
      out2[o+1] = g;
      out2[o+2] = b;
      out2[o+3] = a;
    }
  }

  imgData.data.set(out2);
  return imgData;
}

/* ---------------------------------------------------------
   PREVIEW BUTTON
--------------------------------------------------------- */
on($("enhPreviewBtn"), "click", ()=>{
  if (!enhanceCanvas.width) {
    alert("Please upload an image first.");
    return;
  }
  if (afterImg) afterImg.src = enhanceCanvas.toDataURL("image/jpeg",0.92);
  const s = $("enhStatus");
  if (s) s.textContent = "Preview updated.";
});

/* ---------------------------------------------------------
   ENHANCE & DOWNLOAD
--------------------------------------------------------- */
on($("enhRunBtn"), "click", ()=>{
  if (!enhanceCanvas.width) {
    alert("Please upload an image first.");
    return;
  }
  mergeAnnotations();
  const out = enhanceCanvas.toDataURL("image/jpeg",0.92);

  const a = document.createElement("a");
  a.href = out;
  a.download = currentImageFile ?
    currentImageFile.name.replace(/\.[^.]+$/, "_enh.jpg") :
    "enhanced.jpg";
  a.click();

  const s = $("enhStatus");
  if (s) s.textContent = "Downloaded.";
});

/* ---------------------------------------------------------
   EXTRA: Undo / Clear buttons wired safely
--------------------------------------------------------- */
on($("annotUndo"), "click", ()=>{
  actions.pop();
  redrawInline();
  redrawModalCanvas();
});

on($("annotClear"), "click", ()=>{
  actions = [];
  redrawInline();
  redrawModalCanvas();
});

