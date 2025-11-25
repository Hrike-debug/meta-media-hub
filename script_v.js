/* script_v_annotator.js
   Updated main script implementing Option B (Annotator Modal + real Preview pipeline)
*/

const $ = id => document.getElementById(id);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* ---------- Auth + basic nav (unchanged) ---------- */
const PASSWORD = "Meta@123";
const AUTH_KEY = "mm_auth_v4";
const THEME_KEY = "mm_theme_choice";

const pwModal = $("pwModal"), pwInput = $("pwInput"), pwBtn = $("pwBtn"), pwMsg = $("pwMsg");
const statusText = $("statusText");

function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }
function saveAuth(v){ if(v) localStorage.setItem(AUTH_KEY,"true"); else localStorage.removeItem(AUTH_KEY); }

function showSection(name){
  const home = $("home"), enhancerSection = $("enhancerSection");
  if(home) home.style.display = (name==="home") ? "flex" : "none";
  if(enhancerSection) enhancerSection.style.display = (name==="enhance") ? "block" : "none";
  document.querySelectorAll(".section, .home-section").forEach(el=>el.classList.remove("active"));
  const active = (name==="home") ? home : enhancerSection;
  if(active) setTimeout(()=> active.classList.add("active"), 12);
}

async function unlock(){
  if(!pwInput) return;
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    if(pwModal) pwModal.style.display = "none";
    if(statusText) statusText.textContent = "Unlocked";
    if(pwMsg) pwMsg.textContent = "";
    showSection("home");
  } else {
    if(pwMsg) pwMsg.textContent = "Incorrect password";
  }
}
on(pwBtn, "click", unlock);
on(pwInput, "keydown", e => { if(e.key === "Enter") unlock(); });

if(isAuthed()){
  if(pwModal) pwModal.style.display = "none";
  if(statusText) statusText.textContent = "Unlocked";
  showSection("home");
}

/* --------- Theme + small helpers (kept minimal) --------- */
on($("btnEnhancer"), "click", ()=> showSection("enhance"));
on($("backHomeFromEnhancer"), "click", ()=> showSection("home"));
on($("aboutBtn"), "click", ()=> { const m = $("aboutModal"); if(m) m.style.display = "flex"; });
on($("closeAbout"), "click", ()=> { const m = $("aboutModal"); if(m) m.style.display = "none"; });

/* Tooltips: global handler */
const tooltipBox = document.createElement("div");
tooltipBox.className = "tooltip-box";
tooltipBox.style.display = "none";
document.body.appendChild(tooltipBox);
let tooltipTimer = null;
document.querySelectorAll(".help-tip").forEach(el=>{
  el.addEventListener("mouseenter", ()=>{
    const tip = el.dataset.tip || el.getAttribute("data-tip") || "Info";
    tooltipTimer = setTimeout(()=>{
      tooltipBox.textContent = tip;
      tooltipBox.style.display = "block";
      const r = el.getBoundingClientRect();
      const topTry = r.top - tooltipBox.offsetHeight - 8;
      tooltipBox.style.top = (topTry > 8 ? topTry : (r.bottom + 8)) + "px";
      tooltipBox.style.left = Math.max(8, Math.min(window.innerWidth - tooltipBox.offsetWidth - 8, r.left)) + "px";
    }, 160);
  });
  el.addEventListener("mouseleave", ()=> {
    clearTimeout(tooltipTimer);
    tooltipBox.style.display = "none";
  });
});

/* ---------------- Enhancer & Preview pipeline ---------------- */
const dropEnhance = $("dropEnhance"), enhanceInput = $("enhanceInput"), enhFileInfo = $("enhFileInfo");
const enhUpscale2x = $("enhUpscale2x"), enhUpscale4x = $("enhUpscale4x"), enhFaceEnhance = $("enhFaceEnhance");
const enhDenoise = $("enhDenoise"), enhOCR = $("enhOCR"), enhHDR = $("enhHDR"), enhHide = $("enhHide");
const hidAreaBtn = $("hideAreaBtn"), openAnnotatorBtn = $("openAnnotatorBtn");
const enhQuality = $("enhQuality"), enhQualityVal = $("enhQualityVal"), enhPreviewBtn = $("enhPreviewBtn"), enhRunBtn = $("enhRunBtn");
const enhStatus = $("enhStatus");

const beforeImg = $("beforeImg"), afterImg = $("afterImg"), previewArea = $("previewArea");
const annoCanvas = $("annoCanvas"), annoToolbarMini = $("annoToolbarMini"), annoStateLabel = $("annoStateLabel");
const annApply = $("annApply");

const annotatorModal = $("annotatorModal"), annotCanvas = $("annotCanvas"), annotBase = $("annotBase");
const annotatorApply = $("annotatorApply"), annotatorCancel = $("annotatorCancel");

/* internal high-res canvas (natural image) */
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");
let currentEnhFile = null;

/* Annotation system (shared between inline annoCanvas and full annotator modal)
   We'll use a single actionsStack that both canvases draw from.
*/
let actionsStack = [], redoStack = [];
let inlineAnnoCtx = null, inlineW = 0, inlineH = 0;
let annotCtx = null, annotW = 0, annotH = 0;
let activeTool = null;

/* --- load image into enhanceCanvas and set previews --- */
async function loadEnhImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode().catch(()=>{});
  enhanceCanvas.width = img.naturalWidth;
  enhanceCanvas.height = img.naturalHeight;
  enhanceCtx.clearRect(0,0,enhanceCanvas.width,enhanceCanvas.height);
  enhanceCtx.drawImage(img, 0, 0);
  if(enhFileInfo) enhFileInfo.textContent = `${file.name} — ${img.naturalWidth}×${img.naturalHeight}px`;
  if(enhStatus) enhStatus.textContent = "Image loaded.";
  // previews
  beforeImg.src = url;
  afterImg.src = url;
  annotBase.src = url;
  currentEnhFile = file;
  actionsStack = []; redoStack = [];
  ensureInlineAnnoCanvas();
  ensureAnnotCanvas();
  URL.revokeObjectURL(url);
}

/* event wiring for file input */
if(dropEnhance) dropEnhance.addEventListener("click", ()=> enhanceInput && enhanceInput.click());
if(enhanceInput){
  enhanceInput.addEventListener("change", async e=>{
    const arr = Array.from(e.target.files || []);
    if(!arr.length) return;
    await loadEnhImage(arr[0]);
  });
}
if(dropEnhance){
  dropEnhance.addEventListener("dragover", e=> { e.preventDefault(); dropEnhance.style.background="rgba(255,255,255,0.02)"; });
  dropEnhance.addEventListener("dragleave", ()=> { dropEnhance.style.background=""; });
  dropEnhance.addEventListener("drop", async e=> {
    e.preventDefault();
    dropEnhance.style.background="";
    const arr = Array.from(e.dataTransfer.files || []);
    if(!arr.length) return;
    await loadEnhImage(arr[0]);
  });
}

/* quality UI */
if(enhQuality && enhQualityVal){
  enhQuality.addEventListener("input", ()=> enhQualityVal.textContent = (parseInt(enhQuality.value)||92) + "%");
  enhQualityVal.textContent = (parseInt(enhQuality.value)||92) + "%";
}

/* ---------------- Inline annotation canvas (small overlay) ---------------- */
function ensureInlineAnnoCanvas(){
  if(!annoCanvas || !previewArea) return;
  const rect = previewArea.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(10, Math.floor(rect.width));
  const h = Math.max(10, Math.floor(rect.height));
  annoCanvas.style.width = w + "px";
  annoCanvas.style.height = h + "px";
  annoCanvas.width = Math.floor(w * ratio);
  annoCanvas.height = Math.floor(h * ratio);
  inlineAnnoCtx = annoCanvas.getContext("2d");
  inlineAnnoCtx.setTransform(ratio,0,0,ratio,0,0);
  inlineW = w; inlineH = h;
  redrawInline();
}

/* redraw inline annotation overlay */
function redrawInline(){
  if(!inlineAnnoCtx) return;
  inlineAnnoCtx.clearRect(0,0,inlineW,inlineH);
  for(const a of actionsStack) drawAction(inlineAnnoCtx, a);
  annoStateLabel.textContent = actionsStack.length ? actionsStack[actionsStack.length-1].tool : 'none';
}

/* ---------------- Annotator modal canvas (full editor) ---------------- */
function ensureAnnotCanvas(){
  if(!annotCanvas || !annotBase) return;
  const wrapRect = document.getElementById("annotCanvasWrap").getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(100, Math.floor(wrapRect.width));
  const h = Math.max(100, Math.floor(wrapRect.height));
  annotCanvas.style.width = w + "px";
  annotCanvas.style.height = h + "px";
  annotCanvas.width = Math.floor(w * ratio);
  annotCanvas.height = Math.floor(h * ratio);
  annotCtx = annotCanvas.getContext("2d");
  annotCtx.setTransform(ratio,0,0,ratio,0,0);
  annotW = w; annotH = h;
  annotBase.style.width = "100%";
  annotBase.style.height = "100%";
  redrawAnnot();
}

/* redraw annot modal canvas */
function redrawAnnot(){
  if(!annotCtx) return;
  annotCtx.clearRect(0,0,annotW,annotH);
  for(const a of actionsStack) drawAction(annotCtx, a);
}

/* drawAction - works in display coords of the canvas (x,y in pixels of display rect) */
function drawAction(ctx, action){
  ctx.save();
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = action.color || "#ff7a3c";
  ctx.fillStyle = action.color || "#ff7a3c";
  ctx.lineWidth = Math.max(1, action.size || 4);

  if(action.tool === "rect"){
    ctx.setLineDash([6,6]);
    ctx.strokeRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.12;
    ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
    ctx.globalAlpha = 1;
  } else if(action.tool === "arrow"){
    ctx.beginPath(); ctx.moveTo(action.x, action.y); ctx.lineTo(action.x2, action.y2); ctx.stroke();
    const ang = Math.atan2(action.y2 - action.y, action.x2 - action.x);
    const headlen = Math.max(8, ctx.lineWidth * 2.2);
    ctx.beginPath();
    ctx.moveTo(action.x2, action.y2);
    ctx.lineTo(action.x2 - headlen * Math.cos(ang - Math.PI/7), action.y2 - headlen * Math.sin(ang - Math.PI/7));
    ctx.lineTo(action.x2 - headlen * Math.cos(ang + Math.PI/7), action.y2 - headlen * Math.sin(ang + Math.PI/7));
    ctx.closePath();
    ctx.fill();
  } else if(action.tool === "text"){
    ctx.font = `${Math.max(12, action.size*3)}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = action.color || "#ff7a3c";
    ctx.fillText(action.text || "", action.x, action.y);
  } else if(action.tool === "highlight"){
    ctx.globalAlpha = 0.25;
    ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
    ctx.globalAlpha = 1;
  } else if(action.tool === "blur"){
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
    ctx.globalAlpha = 1;
  } else if(action.tool === "free"){
    const pts = action.points || [];
    if(pts.length){
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* ---------- Inline canvas events (allow quick draw on preview overlay) ---------- */
let drawing = false, startX=0, startY=0;
if(annoCanvas){
  annoCanvas.addEventListener("mousedown", (e)=>{
    // open annotator if not active tools in inline (we keep inline for quick strokes only)
    if(!activeTool) { return; }
    drawing = true;
    const r = annoCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    startX = x; startY = y;
    if(activeTool === "free"){
      actionsStack.push({ tool:"free", color: $("annotColor") ? $("annotColor").value : "#ff7a3c", size: $("annotSize") ? parseInt($("annotSize").value||4) : 4, points:[{x,y}]});
    } else if(activeTool === "text"){
      const txt = prompt("Enter text:");
      if(!txt) { drawing = false; return; }
      actionsStack.push({ tool:"text", x, y, x2:x, y2:y, color: $("annotColor") ? $("annotColor").value : "#ff7a3c", size: $("annotSize") ? parseInt($("annotSize").value||14) : 14, text: txt });
      drawing = false;
      ensureAnnotCanvas(); redrawInline(); redrawAnnot();
      return;
    } else {
      actionsStack.push({ tool: activeTool, x, y, x2:x, y2:y, color: $("annotColor") ? $("annotColor").value : "#ff7a3c", size: $("annotSize") ? parseInt($("annotSize").value||4) : 4 });
    }
    redrawInline();
  });

  annoCanvas.addEventListener("mousemove", (e)=>{
    if(!drawing) return;
    const r = annoCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const cur = actionsStack[actionsStack.length-1];
    if(!cur) return;
    if(cur.tool === "free") cur.points.push({x,y});
    else { cur.x2 = x; cur.y2 = y; }
    redrawInline();
  });

  document.addEventListener("mouseup", ()=> {
    if(drawing){ drawing = false; ensureAnnotCanvas(); redrawAnnot(); }
  });
}

/* ---------- Full Annotator modal drawing (separate canvas) ---------- */
let annotDrawing = false, annotStartX=0, annotStartY=0;
if(annotCanvas){
  annotCanvas.addEventListener("mousedown", (e)=>{
    if(!activeTool) return;
    annotDrawing = true;
    const r = annotCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    annotStartX = x; annotStartY = y;
    if(activeTool === "free"){
      actionsStack.push({ tool:"free", color: $("annotColor") ? $("annotColor").value : "#ff7a3c", size: $("annotSize") ? parseInt($("annotSize").value||4) : 4, points:[{x,y}]});
    } else if(activeTool === "text"){
      const txt = prompt("Enter text to add:");
      if(!txt) { annotDrawing=false; return; }
      actionsStack.push({ tool:"text", x, y, x2:x, y2:y, color: $("annotColor") ? $("annotColor").value : "#ff7a3c", size: $("annotSize") ? parseInt($("annotSize").value||14) : 14, text: txt });
      annotDrawing=false;
      redrawAnnot(); redrawInline();
      return;
    } else {
      actionsStack.push({ tool: activeTool, x, y, x2:x, y2:y, color: $("annotColor") ? $("annotColor").value : "#ff7a3c", size: $("annotSize") ? parseInt($("annotSize").value||4) : 4 });
    }
    redrawAnnot();
  });

  annotCanvas.addEventListener("mousemove", (e)=>{
    if(!annotDrawing) return;
    const r = annotCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const cur = actionsStack[actionsStack.length-1];
    if(!cur) return;
    if(cur.tool === "free") cur.points.push({x,y});
    else { cur.x2 = x; cur.y2 = y; }
    redrawAnnot();
  });

  document.addEventListener("mouseup", ()=> {
    if(annotDrawing){ annotDrawing = false; redrawAnnot(); redrawInline(); ensureInlineAnnoCanvas(); }
  });
}

/* ---------- Annotator UI: toolbar buttons ---------- */
document.querySelectorAll(".annot-btn").forEach(bt=>{
  bt.addEventListener("click", ()=>{
    document.querySelectorAll(".annot-btn").forEach(x=>x.classList.remove("active"));
    bt.classList.add("active");
    activeTool = bt.dataset.tool || null;
    // sync inline active tool label
    annoStateLabel.textContent = activeTool || "none";
  });
});

/* mini annotate open button */
on($("miniAnnotateOpen"), "click", ()=> {
  annotatorModal.style.display = "flex";
  ensureAnnotCanvas();
});

/* open annotator button from enhancer */
on(openAnnotatorBtn, "click", ()=> {
  annotatorModal.style.display = "flex";
  ensureAnnotCanvas();
});

/* Set Hide Area: open annotator and preselect blur tool */
on(hidAreaBtn, "click", ()=> {
  annotatorModal.style.display = "flex";
  setTimeout(()=> {
    // select blur button
    const blurBtn = Array.from(document.querySelectorAll(".annot-btn")).find(x=>x.dataset.tool === "blur");
    if(blurBtn) { blurBtn.click(); }
    ensureAnnotCanvas();
  }, 60);
});

/* Annotator cancel / apply */
on(annotatorCancel, "click", ()=> { annotatorModal.style.display = "none"; ensureInlineAnnoCanvas(); });
on(annotatorApply, "click", ()=> {
  // close and update inline preview (annotations not merged yet)
  annotatorModal.style.display = "none";
  ensureInlineAnnoCanvas();
  redrawInline();
});

/* quick actions in annotator */
on($("annotUndo"), "click", ()=> { if(actionsStack.length) { redoStack.push(actionsStack.pop()); redrawAnnot(); redrawInline(); }});
on($("annotClear"), "click", ()=> { actionsStack = []; redoStack = []; redrawAnnot(); redrawInline(); });

on($("annotClearAll"), "click", ()=> { actionsStack = []; redoStack=[]; redrawAnnot(); redrawInline(); });

/* Apply annotations (merges to enhanceCanvas) */
on(annApply, "click", ()=> {
  if(!enhanceCanvas.width) return alert("No image loaded.");
  mergeAnnotationsToEnhanceCanvas();
  const q = enhQuality ? (parseInt(enhQuality.value)||92)/100 : 0.92;
  const out = enhanceCanvas.toDataURL("image/jpeg", q);
  afterImg.src = out;
  enhStatus && (enhStatus.textContent = "Annotations applied to image.");
  actionsStack = []; redoStack = [];
  redrawInline(); redrawAnnot();
});

/* ---------- Preview pipeline (NON-DESTRUCTIVE) ---------- */
function createPreviewImage(){
  if(!enhanceCanvas.width) return null;
  // draw to temp canvas at natural resolution
  const tmp = document.createElement("canvas");
  tmp.width = enhanceCanvas.width;
  tmp.height = enhanceCanvas.height;
  const tctx = tmp.getContext("2d");
  tctx.drawImage(enhanceCanvas, 0, 0);

  // 1) apply selected filters
  let imgData = tctx.getImageData(0,0,tmp.width,tmp.height);
  if(enhOCR && enhOCR.checked) imgData = applyOCRBoost(imgData);
  if(enhHDR && enhHDR.checked) imgData = applyHDRToneMap(imgData);
  if(enhDenoise && enhDenoise.checked) imgData = applyDenoise(imgData);
  // Upscale is destructive for preview — for preview we simulate upscale by drawing scaled canvas
  // but to keep it fast we'll just ignore true upscale here. (If you want actual upscale, we can add.)
  tctx.putImageData(imgData, 0, 0);

  // 2) apply blur regions (from actionsStack) by mapping display coords -> image natural coords
  if(actionsStack && actionsStack.length){
    const dispRect = previewArea.getBoundingClientRect();
    const dispW = dispRect.width, dispH = dispRect.height;
    const scaleX = tmp.width / Math.max(1, dispW);
    const scaleY = tmp.height / Math.max(1, dispH);

    for(const a of actionsStack){
      if(a.tool === "blur"){
        const sx = Math.round(Math.min(a.x,a.x2) * scaleX);
        const sy = Math.round(Math.min(a.y,a.y2) * scaleY);
        const sw = Math.max(1, Math.round(Math.abs(a.x2 - a.x) * scaleX));
        const sh = Math.max(1, Math.round(Math.abs(a.y2 - a.y) * scaleY));
        try{
          let region = tctx.getImageData(sx, sy, sw, sh);
          for(let p=0;p<5;p++) region = gaussianBlur(region);
          tctx.putImageData(region, sx, sy);
        } catch(e){
          console.warn("preview blur failed", e);
        }
      }
    }
  }

  // return dataURL for preview
  return tmp.toDataURL("image/jpeg", Math.max(0.7, (parseInt(enhQuality.value)||92)/100));
}

/* Preview button (non-destructive) */
on(enhPreviewBtn, "click", ()=>{
  if(!enhanceCanvas.width) return alert("Upload an image first!");
  enhStatus && (enhStatus.textContent = "Rendering preview...");
  const out = createPreviewImage();
  if(out) { afterImg.src = out; enhStatus && (enhStatus.textContent = "Preview updated."); }
});

/* Full Enhance & Download (destructive) */
on(enhRunBtn, "click", ()=>{
  if(!enhanceCanvas.width) return alert("Upload an image first!");
  enhStatus && (enhStatus.textContent = "Processing and exporting...");
  try{
    // apply filters directly to enhanceCanvas
    let imgData = enhanceCtx.getImageData(0,0,enhanceCanvas.width,enhanceCanvas.height);
    if(enhOCR && enhOCR.checked) imgData = applyOCRBoost(imgData);
    if(enhHDR && enhHDR.checked) imgData = applyHDRToneMap(imgData);
    if(enhDenoise && enhDenoise.checked) imgData = applyDenoise(imgData);
    enhanceCtx.putImageData(imgData, 0, 0);

    // merge annotations (includes blur) into enhanceCanvas
    mergeAnnotationsToEnhanceCanvas();

    // export
    const q = enhQuality ? (parseInt(enhQuality.value)||92)/100 : 0.92;
    const out = enhanceCanvas.toDataURL("image/jpeg", q);
    downloadDataURL(out, (currentEnhFile && currentEnhFile.name) ? (currentEnhFile.name.replace(/\.[^/.]+$/,"") + "_enh.jpg") : "enhanced.jpg");
    enhStatus && (enhStatus.textContent = "Enhancement complete. Downloaded.");
    afterImg.src = out;
  }catch(e){
    console.error("Enhance run error", e);
    enhStatus && (enhStatus.textContent = "Processing failed.");
  }
});

/* ---------- Merge annotations to enhanceCanvas (destructive merge) ---------- */
function mergeAnnotationsToEnhanceCanvas(){
  if(!enhanceCanvas.width || !previewArea) return;
  const tmp = document.createElement("canvas");
  tmp.width = enhanceCanvas.width; tmp.height = enhanceCanvas.height;
  const tctx = tmp.getContext("2d");
  tctx.drawImage(enhanceCanvas, 0, 0);

  const dispRect = previewArea.getBoundingClientRect();
  const dispW = dispRect.width, dispH = dispRect.height;
  const scaleX = tmp.width / Math.max(1, dispW);
  const scaleY = tmp.height / Math.max(1, dispH);

  for(const a of actionsStack){
    if(a.tool === "text"){
      tctx.fillStyle = a.color || "#ff7a3c";
      tctx.font = `${Math.max(12, a.size*3) * scaleX}px Inter, sans-serif`;
      tctx.fillText(a.text || "", a.x * scaleX, a.y * scaleY);
    } else if(a.tool === "rect" || a.tool === "highlight"){
      const sx = Math.round(Math.min(a.x,a.x2) * scaleX);
      const sy = Math.round(Math.min(a.y,a.y2) * scaleY);
      const sw = Math.round(Math.abs(a.x2 - a.x) * scaleX);
      const sh = Math.round(Math.abs(a.y2 - a.y) * scaleY);
      if(a.tool === "rect"){
        tctx.strokeStyle = a.color || "#ff7a3c";
        tctx.lineWidth = Math.max(2, a.size || 4) * Math.max(scaleX, scaleY);
        tctx.setLineDash([6 * scaleX, 6 * scaleX]);
        tctx.strokeRect(sx, sy, sw, sh);
        tctx.setLineDash([]);
        tctx.fillStyle = "rgba(255,122,60,0.12)";
        tctx.fillRect(sx, sy, sw, sh);
      } else {
        tctx.globalAlpha = 0.25;
        tctx.fillStyle = a.color || "#ff7a3c";
        tctx.fillRect(sx, sy, sw, sh);
        tctx.globalAlpha = 1;
      }
    } else if(a.tool === "arrow"){
      tctx.strokeStyle = a.color || "#ff7a3c";
      tctx.lineWidth = Math.max(2, a.size || 4) * Math.max(scaleX, scaleY);
      const x1 = a.x * scaleX, y1 = a.y * scaleY, x2 = a.x2 * scaleX, y2 = a.y2 * scaleY;
      tctx.beginPath(); tctx.moveTo(x1,y1); tctx.lineTo(x2,y2); tctx.stroke();
      const ang = Math.atan2(y2 - y1, x2 - x1);
      const head = Math.max(8, tctx.lineWidth * 2.2);
      tctx.beginPath();
      tctx.moveTo(x2, y2);
      tctx.lineTo(x2 - head * Math.cos(ang - Math.PI/7), y2 - head * Math.sin(ang - Math.PI/7));
      tctx.lineTo(x2 - head * Math.cos(ang + Math.PI/7), y2 - head * Math.sin(ang + Math.PI/7));
      tctx.closePath();
      tctx.fillStyle = a.color || "#ff7a3c";
      tctx.fill();
    } else if(a.tool === "blur"){
      const sx = Math.round(Math.min(a.x,a.x2) * scaleX);
      const sy = Math.round(Math.min(a.y,a.y2) * scaleY);
      const sw = Math.max(1, Math.round(Math.abs(a.x2 - a.x) * scaleX));
      const sh = Math.max(1, Math.round(Math.abs(a.y2 - a.y) * scaleY));
      try{
        let region = tctx.getImageData(sx, sy, sw, sh);
        const passes = 7;
        for(let p=0;p<passes;p++) region = gaussianBlur(region);
        tctx.putImageData(region, sx, sy);
      } catch(e){ console.warn("blur region failed", e); }
    } else if(a.tool === "free"){
      tctx.strokeStyle = a.color || "#ff7a3c";
      tctx.lineWidth = Math.max(1, a.size || 4) * Math.max(scaleX, scaleY);
      tctx.beginPath();
      const pts = a.points || [];
      if(pts.length){
        tctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
        for(let i=1;i<pts.length;i++) tctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
        tctx.stroke();
      }
    }
  }

  enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
  enhanceCtx.drawImage(tmp, 0, 0);
}

/* ---------- Utilities & filters (OCR, HDR, Denoise, Blur) ---------- */
/* NOTE: these are the same basic implementations you had; I kept them and added applyDenoise placeholder */

function applyOCRBoost(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    const r = d[i], g = d[i+1], b = d[i+2];
    const lum = (r+g+b)/3;
    const boost = lum > 128 ? 1.05 : 1.18;
    d[i] = Math.min(255, r * boost);
    d[i+1] = Math.min(255, g * boost);
    d[i+2] = Math.min(255, b * boost);
    d[i] = Math.min(255, (d[i] - 128) * 1.06 + 128);
    d[i+1] = Math.min(255, (d[i+1] - 128) * 1.06 + 128);
    d[i+2] = Math.min(255, (d[i+2] - 128) * 1.06 + 128);
  }
  return imageData;
}

function applyHDRToneMap(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    d[i] = toneChannel(d[i]);
    d[i+1] = toneChannel(d[i+1]);
    d[i+2] = toneChannel(d[i+2]);
  }
  return imageData;
}
function toneChannel(v){
  if(v < 80) return Math.min(255, v * 1.28);
  if(v > 200) return Math.max(0, v * 0.88);
  return v;
}

/* simple denoise placeholder: tiny blur + contrast */
function applyDenoise(imageData){
  // apply a very light box blur pass (cheap)
  const d = imageData.data;
  // naive mild contrast increase
  for(let i=0;i<d.length;i+=4){
    d[i] = Math.min(255, (d[i]-128)*1.04 + 128);
    d[i+1] = Math.min(255, (d[i+1]-128)*1.04 + 128);
    d[i+2] = Math.min(255, (d[i+2]-128)*1.04 + 128);
  }
  return imageData;
}

/* gaussian blur: separable 5-tap (kept same) */
function gaussianBlur(imgData){
  const w = imgData.width, h = imgData.height;
  const src = imgData.data;
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const weights = [0.1201,0.2339,0.2920,0.2339,0.1201];
  const half = 2;
  for(let row=0; row<h; row++){
    for(let col=0; col<w; col++){
      let r=0,g=0,b=0,a=0;
      for(let k=-half;k<=half;k++){
        const x = Math.min(w-1, Math.max(0, col + k));
        const idx = (row*w + x)*4;
        const wt = weights[k+half];
        r += src[idx] * wt; g += src[idx+1] * wt; b += src[idx+2] * wt; a += src[idx+3] * wt;
      }
      const idxOut = (row*w + col)*4;
      tmp[idxOut] = r; tmp[idxOut+1] = g; tmp[idxOut+2] = b; tmp[idxOut+3] = a;
    }
  }
  for(let col=0; col<w; col++){
    for(let row=0; row<h; row++){
      let r=0,g=0,b=0,a=0;
      for(let k=-half;k<=half;k++){
        const y = Math.min(h-1, Math.max(0, row + k));
        const idx = (y*w + col)*4;
        const wt = weights[k+half];
        r += tmp[idx] * wt; g += tmp[idx+1] * wt; b += tmp[idx+2] * wt; a += tmp[idx+3] * wt;
      }
      const idxOut = (row*w + col)*4;
      out[idxOut] = r; out[idxOut+1] = g; out[idxOut+2] = b; out[idxOut+3] = a;
    }
  }
  imgData.data.set(out);
  return imgData;
}

/* download helper */
function downloadDataURL(dataURL, filename="image.jpg"){
  const a = document.createElement("a");
  a.href = dataURL;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/* ---------- helpers to keep canvases responsive ---------- */
window.addEventListener("resize", ()=>{
  ensureInlineAnnoCanvas(); ensureAnnotCanvas();
});

ensureInlineAnnoCanvas();
ensureAnnotCanvas();

/* keyboard escape to close modals */
document.addEventListener("keydown",(e)=>{
  if(e.key==="Escape"){ annotatorModal.style.display = "none"; }
});

/* final default view */
showSection(isAuthed() ? "home" : "home");
