/* ==========================================================
   script_v.js
   Meta Media Hub — Unified client-side script
   - Auth + theme + navigation
   - Image upload + optional coco-ssd person detection
   - Enhancer: OCR boost, HDR
   - Annotation canvas with tools (rect, arrow, text, highlight, blur, free)
   - Preview updates inline (no new window), no ZIP
   - All client-side
   =========================================================*/

/* -------------------------
   Small helpers
--------------------------*/
const $ = id => document.getElementById(id);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

/* -------------------------
   AUTH + SECTIONS
--------------------------*/
const PASSWORD = "Meta@123";
const AUTH_KEY = "mm_auth_v4";
const THEME_KEY = "mm_theme_choice";

const pwModal = $("pwModal"), pwInput = $("pwInput"), pwBtn = $("pwBtn"), pwMsg = $("pwMsg");
const statusText = $("statusText");

function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }
function saveAuth(v){ if(v) localStorage.setItem(AUTH_KEY,"true"); else localStorage.removeItem(AUTH_KEY); }

function showSection(name){
  const home = $("home"), imageSection = $("imageSection"), enhancerSection = $("enhancerSection");
  if(home) home.style.display = (name==="home") ? "flex" : "none";
  if(imageSection) imageSection.style.display = (name==="resize") ? "block" : "none";
  if(enhancerSection) enhancerSection.style.display = (name==="enhance") ? "block" : "none";

  // small animation class toggle
  document.querySelectorAll(".section, .home-section").forEach(el=>el.classList.remove("active"));
  const active = (name==="home") ? home : (name==="resize") ? imageSection : enhancerSection;
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
} else {
  // modal is shown by HTML initially
}

/* -------------------------
   NAV + ABOUT + THEME
--------------------------*/
on($("btnImage"), "click", ()=> showSection("resize"));
on($("btnEnhancer"), "click", ()=> showSection("enhance"));
on($("backHomeFromImage"), "click", ()=> showSection("home"));
on($("backHomeFromEnhancer"), "click", ()=> showSection("home"));

on($("aboutBtn"), "click", ()=> { const m = $("aboutModal"); if(m) m.style.display = "flex"; });
on($("closeAbout"), "click", ()=> { const m = $("aboutModal"); if(m) m.style.display = "none"; });

const themeToggle = $("themeToggle");
const themeBtn = $("themeBtn");
const themeModal = $("themeModal");
const closeTheme = $("closeTheme");

function applyThemeValue(key){
  // remove previously applied theme-* classes but keep other classes
  const classes = Array.from(document.documentElement.classList).filter(c=>!c.startsWith("theme-"));
  document.documentElement.className = classes.join(" ");
  if(key) document.documentElement.classList.add("theme-" + key);
  localStorage.setItem(THEME_KEY, key || "");
  // update icon
  if(themeToggle) themeToggle.textContent = (key && key === "retro-beige") ? "☀️" : (document.documentElement.classList.contains("theme-light") ? "☀️" : "🌙");
}

on(themeToggle, "click", ()=>{
  if(document.documentElement.classList.contains("theme-light")){
    document.documentElement.classList.remove("theme-light");
    localStorage.setItem(THEME_KEY,"");
  } else {
    document.documentElement.classList.add("theme-light");
    localStorage.setItem(THEME_KEY,"theme-light");
  }
});

on(themeBtn, "click", ()=> { if(themeModal) themeModal.style.display = "flex"; });
on(closeTheme, "click", ()=> { if(themeModal) themeModal.style.display = "none"; });

document.querySelectorAll(".theme-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    const t = card.dataset.theme;
    if(t) applyThemeValue(t);
    if(themeModal) themeModal.style.display = "none";
  });
});
applyThemeValue(localStorage.getItem(THEME_KEY) || "");

/* -------------------------
   Tooltips
--------------------------*/
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

/* ==========================================================
   IMAGE RESIZER — (scan only, no zip) - uses coco-ssd if available
==========================================================*/
let imageFiles = [], imageDetectionMap = {}, cocoModel = null;
const dropImage = $("dropImage"), imageInput = $("imageInput"), imageFileList = $("imageFileList");
const smartBanner = $("smartBanner"), bannerIcon = $("bannerIcon"), bannerText = $("bannerText");
const imgStatus = $("imgStatus"), imgAiToggle = $("imgAiToggle");

if(dropImage) dropImage.addEventListener("click", ()=> imageInput && imageInput.click());
if(imageInput){
  imageInput.addEventListener("change", async e=>{
    imageFiles = Array.from(e.target.files || []);
    await handleNewImages();
  });
}
if(dropImage){
  dropImage.addEventListener("dragover", e=> { e.preventDefault(); dropImage.style.background = "rgba(255,255,255,0.02)"; });
  dropImage.addEventListener("dragleave", ()=> { dropImage.style.background = ""; });
  dropImage.addEventListener("drop", async e=>{
    e.preventDefault();
    dropImage.style.background = "";
    imageFiles = Array.from(e.dataTransfer.files || []);
    await handleNewImages();
  });
}

function refreshImageList(){
  if(!imageFileList) return;
  if(!imageFiles.length){
    imageFileList.innerHTML = "No files uploaded.";
    if(smartBanner) smartBanner.style.display = "none";
    return;
  }
  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    const st = imageDetectionMap[f.name] || "unknown";
    let icon="⏳", text="Scanning…";
    if(st === "person"){ icon = "👤"; text = "Human found"; }
    if(st === "none"){ icon = "❌"; text = "No person"; }
    return `<div class="file-row"><span style="margin-right:10px">${icon}</span><div><b>${i+1}. ${f.name}</b><br><small>${text} — ${Math.round(f.size/1024)} KB</small></div></div>`;
  }).join("");
}

async function loadCoco(){
  if(cocoModel) return cocoModel;
  try{
    if(imgStatus) imgStatus.textContent = "Loading detection model…";
    cocoModel = await cocoSsd.load();
    if(imgStatus) imgStatus.textContent = "Model ready";
    return cocoModel;
  }catch(e){
    console.warn("coco load fail", e);
    if(imgStatus) imgStatus.textContent = "Model load failed";
    return null;
  }
}
async function detectPerson(imgEl){
  try{
    await loadCoco();
    if(!cocoModel) return false;
    const preds = await cocoModel.detect(imgEl);
    return preds.some(p => p.class === "person");
  }catch(e){
    console.warn("detectPerson error", e);
    return false;
  }
}

async function handleNewImages(){
  imageDetectionMap = {};
  imageFiles.forEach(f => imageDetectionMap[f.name] = "unknown");
  refreshImageList();
  if(smartBanner) smartBanner.style.display = "flex";
  if(bannerText) bannerText.textContent = "Scanning images…";
  if(imgStatus) imgStatus.textContent = "Scanning images…";

  let found = 0;
  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode().catch(()=>{});
    const has = await detectPerson(img);
    imageDetectionMap[file.name] = has ? "person" : "none";
    if(has) found++;
    refreshImageList();
    URL.revokeObjectURL(url);
  }
  if(bannerIcon) bannerIcon.textContent = found ? "🟢" : "⚪";
  if(bannerText) bannerText.innerHTML = found ? `Smart Human Detection: found people in <b>${found}</b> of ${imageFiles.length} image(s).` : `Smart Human Detection: no people found.`;
  if(imgStatus) imgStatus.textContent = "Scan complete.";
  if(imgAiToggle) imgAiToggle.classList.toggle("active", found>0);
}

/* ==========================================================
   ENHANCER + ANNOTATION
   - use one inline preview area (beforeImg & afterImg)
   - annotation overlays on annoCanvas
   - annApply merges into enhanceCanvas
==========================================================*/

/* DOM refs */
const dropEnhance = $("dropEnhance"), enhanceInput = $("enhanceInput"), enhFileInfo = $("enhFileInfo");
const enhQuality = $("enhQuality"), enhQualityVal = $("enhQualityVal");
const enhRunBtn = $("enhRunBtn"), enhPreviewBtn = $("enhPreviewBtn");
const enhOCR = $("enhOCR"), enhHDR = $("enhHDR"), enhHide = $("enhHide");
const hideAreaBtn = $("hideAreaBtn");
const enhStatus = $("enhStatus");

const beforeImg = $("beforeImg"), afterImg = $("afterImg"), previewArea = $("previewArea"), afterLayer = $("afterLayer");
const annoCanvas = $("annoCanvas"), annoToolbar = $("annoToolbar");
const annoButtons = document.querySelectorAll(".anno-btn");
const annUndo = $("annUndo"), annClear = $("annClear"), annApply = $("annApply");
const annColor = $("annColor"), annSize = $("annSize");

/* internal canvas (natural image resolution) */
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");
let currentEnhFile = null;

/* annotation state */
let annoCtx = null;
let annoWidth = 0, annoHeight = 0;
let annoActiveTool = null;
let drawing = false;
let startX = 0, startY = 0;
let actionsStack = [];
let redoStack = [];

/* load image into internal canvas and update before/after preview */
async function loadEnhImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode().catch(()=>{});
  enhanceCanvas.width = img.naturalWidth;
  enhanceCanvas.height = img.naturalHeight;
  enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
  enhanceCtx.drawImage(img, 0, 0);
  if(enhFileInfo) enhFileInfo.textContent = `${file.name} — ${img.naturalWidth}×${img.naturalHeight}px`;
  if(enhStatus) enhStatus.textContent = "Image loaded.";
  // set preview images (before and after show same for now)
  beforeImg.src = url;
  afterImg.src = url;
  // reset annotation & stacks
  actionsStack = []; redoStack = [];
  ensureAnnoCanvas();
  URL.revokeObjectURL(url);
}

if(dropEnhance) dropEnhance.addEventListener("click", ()=> enhanceInput && enhanceInput.click());
if(enhanceInput){
  enhanceInput.addEventListener("change", async e=>{
    const arr = Array.from(e.target.files || []);
    if(!arr.length) return;
    currentEnhFile = arr[0];
    await loadEnhImage(currentEnhFile);
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
    currentEnhFile = arr[0];
    await loadEnhImage(currentEnhFile);
  });
}

/* quality UI */
if(enhQuality && enhQualityVal){
  enhQuality.addEventListener("input", ()=> {
    enhQualityVal.textContent = (parseInt(enhQuality.value)||92) + "%";
  });
  // init text
  enhQualityVal.textContent = (parseInt(enhQuality.value)||92) + "%";
}

/* Preview button (inline) */
on(enhPreviewBtn, "click", ()=>{
  if(!enhanceCanvas.width) return alert("Upload an image first!");
  // show processed image as afterImg (no download)
  // if filters were applied previously they are in enhanceCanvas; show current state
  const q = enhQuality ? (parseInt(enhQuality.value)||92)/100 : 0.92;
  const out = enhanceCanvas.toDataURL("image/jpeg", q);
  afterImg.src = out;
  if(enhStatus) enhStatus.textContent = "Preview updated.";
});

/* Apply enhancement pipeline (OCR/HDR) + merge annotations then download */
on(enhRunBtn, "click", ()=>{
  if(!enhanceCanvas.width) return alert("Upload an image first!");
  enhStatus && (enhStatus.textContent = "Processing...");
  try{
    // 1) get pixels and apply filters
    let imgData = enhanceCtx.getImageData(0,0,enhanceCanvas.width, enhanceCanvas.height);
    if(enhOCR && enhOCR.checked) imgData = applyOCRBoost(imgData);
    if(enhHDR && enhHDR.checked) imgData = applyHDRToneMap(imgData);
    enhanceCtx.putImageData(imgData, 0, 0);

    // 2) merge annotation actions (including blur actions) onto the image
    mergeAnnotationsToEnhanceCanvas();

    // 3) export
    const q = enhQuality ? (parseInt(enhQuality.value)||92)/100 : 0.92;
    const out = enhanceCanvas.toDataURL("image/jpeg", q);
    downloadDataURL(out, (currentEnhFile && currentEnhFile.name) ? (currentEnhFile.name.replace(/\.[^/.]+$/,"") + "_enh.jpg") : "enhanced.jpg");
    enhStatus && (enhStatus.textContent = "Enhancement complete. File downloaded.");
    // update inline preview
    afterImg.src = out;
  }catch(e){
    console.error("Enhance run error", e);
    enhStatus && (enhStatus.textContent = "Processing failed.");
  }
});

/* -------------------------
   FILTERS (OCR, HDR)
--------------------------*/
function applyOCRBoost(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    const r = d[i], g = d[i+1], b = d[i+2];
    const lum = (r+g+b)/3;
    const boost = lum > 128 ? 1.05 : 1.18;
    d[i] = Math.min(255, r * boost);
    d[i+1] = Math.min(255, g * boost);
    d[i+2] = Math.min(255, b * boost);
    // slight contrast
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

/* ============================
   Annotation system
   - draw shapes on annoCanvas (display coords)
   - actionsStack stores shapes to apply/merge later
=============================*/
function ensureAnnoCanvas(){
  if(!annoCanvas || !previewArea) return false;
  const rect = previewArea.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(10, Math.floor(rect.width));
  const h = Math.max(10, Math.floor(rect.height));
  annoCanvas.style.width = w + "px";
  annoCanvas.style.height = h + "px";
  annoCanvas.width = Math.floor(w * ratio);
  annoCanvas.height = Math.floor(h * ratio);
  annoCanvas.getContext("2d").setTransform(ratio,0,0,ratio,0,0);
  annoCtx = annoCanvas.getContext("2d");
  annoWidth = w; annoHeight = h;
  annoCanvas.style.pointerEvents = "auto";
  redrawAll();
  return true;
}

function clearAnno(){
  if(!annoCtx) return;
  annoCtx.clearRect(0,0,annoWidth,annoHeight);
  actionsStack = [];
  redoStack = [];
}

function redrawAll(){
  if(!annoCtx) return;
  annoCtx.clearRect(0,0,annoWidth,annoHeight);
  for(const a of actionsStack) drawAction(annoCtx, a);
}

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
    ctx.fillStyle = action.color || "#ff7a3c";
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
    ctx.fillStyle = action.color || "#ff7a3c";
    ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
    ctx.globalAlpha = 1;
  } else if(action.tool === "blur"){
    // visual indicator; actual blur happens on merge
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

/* toolbar buttons */
annoButtons.forEach(b=>{
  b.addEventListener("click", ()=>{
    annoButtons.forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    annoActiveTool = b.dataset.tool;
    if(annoToolbar) annoToolbar.style.display = "flex";
    ensureAnnoCanvas();
  });
});

/* undo/clear/apply */
if(annClear) annClear.addEventListener("click", ()=> { clearAnno(); redrawAll(); });
if(annUndo) annUndo.addEventListener("click", ()=> {
  if(actionsStack.length) { redoStack.push(actionsStack.pop()); redrawAll(); }
});
if(annApply) annApply.addEventListener("click", () => {
  if(!enhanceCanvas.width) return alert("No image to apply annotations to.");
  mergeAnnotationsToEnhanceCanvas();
  // update preview
  const q = enhQuality ? (parseInt(enhQuality.value)||92)/100 : 0.92;
  const out = enhanceCanvas.toDataURL("image/jpeg", q);
  afterImg.src = out;
  if(enhStatus) enhStatus.textContent = "Annotations applied to image.";
  // clear overlays
  clearAnno();
  redrawAll();
});

/* annotation drawing events */
if(annoCanvas){
  // mousedown
  annoCanvas.addEventListener("mousedown", e=>{
    if(!annoActiveTool) return;
    drawing = true;
    const r = annoCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    startX = x; startY = y;

    if(annoActiveTool === "free"){
      const action = { tool:"free", color: annColor ? annColor.value : "#ff7a3c", size: annSize ? parseInt(annSize.value||4) : 4, points:[{x,y}] };
      actionsStack.push(action);
    } else if(annoActiveTool === "text"){
      const txt = prompt("Enter text to add:");
      if(!txt) { drawing = false; return; }
      const action = { tool:"text", x, y, color: annColor ? annColor.value : "#ff7a3c", size: annSize ? parseInt(annSize.value||14) : 14, text: txt };
      actionsStack.push(action);
      redrawAll();
      drawing = false;
    } else {
      const action = { tool: annoActiveTool, x, y, x2: x, y2: y, color: annColor ? annColor.value : "#ff7a3c", size: annSize ? parseInt(annSize.value||4) : 4 };
      actionsStack.push(action);
    }
  });

  // mousemove
  annoCanvas.addEventListener("mousemove", e=>{
    if(!drawing) return;
    const r = annoCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const cur = actionsStack[actionsStack.length - 1];
    if(!cur) return;
    if(cur.tool === "free"){
      cur.points.push({x,y});
    } else {
      cur.x2 = x; cur.y2 = y;
    }
    redrawAll();
  });

  // mouseup
  document.addEventListener("mouseup", ()=> {
    if(drawing) {
      drawing = false;
      redrawAll();
    }
  });
}

/* ======================
   Merge annotations into enhanceCanvas
   - scale display coords => image natural coords
   - applies blur actions as multi-pass gaussian on image pixel region
   ========================*/
function mergeAnnotationsToEnhanceCanvas(){
  if(!enhanceCanvas.width || !previewArea) return;
  // create tmp canvas at image resolution
  const tmp = document.createElement("canvas");
  tmp.width = enhanceCanvas.width; tmp.height = enhanceCanvas.height;
  const tctx = tmp.getContext("2d");
  // draw current image
  tctx.drawImage(enhanceCanvas, 0, 0);

  // compute display rect
  const dispRect = previewArea.getBoundingClientRect();
  const dispW = dispRect.width, dispH = dispRect.height;
  const scaleX = enhanceCanvas.width / Math.max(1, dispW);
  const scaleY = enhanceCanvas.height / Math.max(1, dispH);

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
      tctx.beginPath(); tctx.moveTo(x1, y1); tctx.lineTo(x2, y2); tctx.stroke();
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
      // apply blur on region
      const sx = Math.round(Math.min(a.x,a.x2) * scaleX);
      const sy = Math.round(Math.min(a.y,a.y2) * scaleY);
      const sw = Math.max(1, Math.round(Math.abs(a.x2 - a.x) * scaleX));
      const sh = Math.max(1, Math.round(Math.abs(a.y2 - a.y) * scaleY));
      try{
        let region = tctx.getImageData(sx, sy, sw, sh);
        // multi-pass gaussian
        const passes = 7;
        for(let p=0;p<passes;p++) region = gaussianBlur(region);
        tctx.putImageData(region, sx, sy);
      }catch(e){
        console.warn("blur region failed", e);
      }
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

  // copy tmp back to enhanceCanvas
  enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
  enhanceCtx.drawImage(tmp, 0, 0);
}

/* gaussian blur (separable 5-tap) */
function gaussianBlur(imgData){
  const w = imgData.width, h = imgData.height;
  const src = imgData.data;
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const weights = [0.1201,0.2339,0.2920,0.2339,0.1201];
  const half = 2;
  // horizontal pass
  for(let row=0; row<h; row++){
    for(let col=0; col<w; col++){
      let r=0,g=0,b=0,a=0;
      for(let k=-half; k<=half; k++){
        const x = Math.min(w-1, Math.max(0, col + k));
        const idx = (row*w + x)*4;
        const wt = weights[k+half];
        r += src[idx] * wt; g += src[idx+1] * wt; b += src[idx+2] * wt; a += src[idx+3] * wt;
      }
      const idxOut = (row*w + col)*4;
      tmp[idxOut] = r; tmp[idxOut+1] = g; tmp[idxOut+2] = b; tmp[idxOut+3] = a;
    }
  }
  // vertical pass
  for(let col=0; col<w; col++){
    for(let row=0; row<h; row++){
      let r=0,g=0,b=0,a=0;
      for(let k=-half; k<=half; k++){
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

/* small init & resize handlers */
window.addEventListener("resize", ()=> {
  ensureAnnoCanvas();
});
ensureAnnoCanvas();

/* keep preview images non-interactive */
if(beforeImg) beforeImg.style.pointerEvents = "none";
if(afterImg) afterImg.style.pointerEvents = "none";

/* keyboard escape to close modals */
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape"){
    ["aboutModal","themeModal"].forEach(id=>{
      const m = $(id);
      if(m) m.style.display = "none";
    });
  }
});

/* global error catch so UI doesn't freeze on script errors */
window.addEventListener("error", ev=>{
  console.error("Runtime error:", ev.error || ev.message);
});

/* final default view */
showSection(isAuthed() ? "home" : "home");
