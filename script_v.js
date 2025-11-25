/* script_v.js
   Meta Media Hub — Unified script
   - Auth + theme + navigation
   - Image upload + coco-ssd person detection (optional)
   - Enhancer: OCR boost, HDR, multi-pass blur
   - Annotation canvas with tools (rect, arrow, text, highlight, blur)
   - Preview modal (slider) and inline preview (annotation overlay)
   - Tooltips from data-tip
   - All client-side, no server
*/

/* -------------------------
   Small helpers
--------------------------*/
const $ = id => document.getElementById(id);
const q = sel => document.querySelector(sel);
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);

function safeGet(id){ return $(id) || document.querySelector(`[name="${id}"]`) || null; }

/* -------------------------
   AUTH + SECTIONS
--------------------------*/
const PASSWORD = "Meta@123";
const AUTH_KEY = "mm_auth_v4";

const pwModal = $("pwModal"), pwInput = $("pwInput"), pwBtn = $("pwBtn"), pwMsg = $("pwMsg");
const statusText = $("statusText");

function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }
function saveAuth(v){ if(v) localStorage.setItem(AUTH_KEY,"true"); else localStorage.removeItem(AUTH_KEY); }

function showSection(name){
  const home = $("home");
  const imageSection = $("imageSection");
  const enhancerSection = $("enhancerSection");

  if(home) home.style.display = name==="home" ? "flex" : "none";
  if(imageSection) imageSection.style.display = name==="resize" ? "block" : "none";
  if(enhancerSection) enhancerSection.style.display = name==="enhance" ? "block" : "none";

  // for animations class toggles
  document.querySelectorAll(".section, .home-section").forEach(el=>{
    el.classList.remove("active");
  });
  const active = name==="home" ? home : (name==="resize" ? imageSection : enhancerSection);
  if(active) setTimeout(()=> active.classList.add("active"),10);
}

async function unlock(){
  if(!pwInput) return;
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    if(pwModal) pwModal.style.display = "none";
    if(statusText) statusText.textContent = "Unlocked";
    showSection("home");
    pwMsg && (pwMsg.textContent = "");
  } else {
    pwMsg && (pwMsg.textContent = "Incorrect password");
  }
}
on(pwBtn, "click", unlock);
on(pwInput, "keydown", e=> { if(e.key === "Enter") unlock(); });

if(isAuthed()){
  if(pwModal) pwModal.style.display = "none";
  if(statusText) statusText.textContent = "Unlocked";
  showSection("home");
} else {
  // show pw modal (already visible in HTML)
}

/* NAVIGATION buttons (defensive) */
on($("btnImage"), "click", ()=> showSection("resize"));
on($("btnEnhancer") || $("btnEnhancer"), "click", ()=> showSection("enhance"));
on($("backHomeFromImage"), "click", ()=> showSection("home"));
on($("backHomeFromEnhancer"), "click", ()=> showSection("home"));

/* ABOUT modal */
on($("aboutBtn"), "click", ()=> { const m=$("aboutModal"); if(m) m.style.display="flex"; });
on($("closeAbout"), "click", ()=> { const m=$("aboutModal"); if(m) m.style.display="none"; });

/* THEME toggle + theme modal */
const themeToggle = $("themeToggle");
const themeBtn = $("themeBtn");
const themeModal = $("themeModal");
const closeTheme = $("closeTheme");
const THEME_KEY = "mm_theme_choice";

function applyThemeKey(key){
  // remove any theme-... classes from documentElement then add
  document.documentElement.className = document.documentElement.className.split(/\s+/).filter(c=>!c.startsWith("theme-")).join(" ");
  if(key) document.documentElement.classList.add(key);
  localStorage.setItem(THEME_KEY, key || "");
  if(themeToggle) themeToggle.textContent = (key && key.startsWith("theme-")) ? "☀️" : "🌙";
}
on(themeToggle, "click", ()=>{
  // simple light/dark toggle by presence of theme-light (we support theme-light in CSS)
  if(document.documentElement.classList.contains("theme-light")){
    document.documentElement.classList.remove("theme-light");
    localStorage.setItem(THEME_KEY,"");
  } else {
    document.documentElement.classList.add("theme-light");
    localStorage.setItem(THEME_KEY,"theme-light");
  }
});
on(themeBtn, "click", ()=> themeModal && (themeModal.style.display="flex"));
on(closeTheme, "click", ()=> themeModal && (themeModal.style.display="none"));
document.querySelectorAll(".theme-card").forEach(card=>{
  card.addEventListener("click", ()=> {
    const t = card.dataset.theme;
    if(t) applyThemeKey("theme-" + t);
    themeModal.style.display="none";
  });
});
// init theme from storage
applyThemeKey(localStorage.getItem(THEME_KEY) || "");

/* -------------------------
   Tooltips from data-tip
--------------------------*/
const tooltipBox = document.createElement("div");
tooltipBox.className = "tooltip-box";
document.body.appendChild(tooltipBox);
let tooltipTimer = null;
document.querySelectorAll(".help-tip").forEach(el=>{
  el.addEventListener("mouseenter", (ev)=>{
    const tip = el.dataset.tip || el.getAttribute("data-tip") || "Info";
    tooltipTimer = setTimeout(()=>{
      tooltipBox.textContent = tip;
      tooltipBox.style.display = "block";
      const r = el.getBoundingClientRect();
      // position above element if space, otherwise below
      const top = r.top - tooltipBox.offsetHeight - 8;
      if(top > 8) tooltipBox.style.top = (top) + "px";
      else tooltipBox.style.top = (r.bottom + 8) + "px";
      tooltipBox.style.left = Math.min(window.innerWidth - tooltipBox.offsetWidth - 12, Math.max(8, r.left)) + "px";
    }, 180);
  });
  el.addEventListener("mouseleave", ()=> {
    clearTimeout(tooltipTimer);
    tooltipBox.style.display = "none";
  });
});

/* =========================
   IMAGE RESIZER (scan only)
   - uses coco-ssd if available
============================*/
let imageFiles = [];
let imageDetectionMap = {};
let cocoModel = null;

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");
const smartBanner = $("smartBanner");
const bannerIcon = $("bannerIcon");
const bannerText = $("bannerText");
const imgStatus = $("imgStatus");
const imgAiToggle = $("imgAiToggle");

if(dropImage) dropImage.addEventListener("click", ()=> imageInput && imageInput.click());
if(imageInput){
  imageInput.addEventListener("change", async e=>{
    imageFiles = Array.from(e.target.files || []);
    await handleNewImages();
  });
}
if(dropImage){
  dropImage.addEventListener("dragover", e=> { e.preventDefault(); dropImage.style.background="rgba(255,255,255,0.02)"; });
  dropImage.addEventListener("dragleave", ()=> { dropImage.style.background=""; });
  dropImage.addEventListener("drop", async e=> {
    e.preventDefault();
    dropImage.style.background="";
    imageFiles = Array.from(e.dataTransfer.files || []);
    await handleNewImages();
  });
}

function refreshImageList(){
  if(!imageFileList) return;
  if(!imageFiles || !imageFiles.length){
    imageFileList.innerHTML = "No files uploaded.";
    if(smartBanner) smartBanner.style.display = "none";
    return;
  }
  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    const st = imageDetectionMap[f.name] || "unknown";
    let icon="⏳", label="Scanning…";
    if(st==="person"){ icon="👤"; label="Human found"; }
    else if(st==="none"){ icon="❌"; label="No person"; }
    return `<div class="file-row"><span style="margin-right:10px">${icon}</span><div><b>${i+1}. ${f.name}</b><br><small>${label} • ${Math.round(f.size/1024)} KB</small></div></div>`;
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
    console.warn("coco load failed:", e);
    if(imgStatus) imgStatus.textContent = "Model failed to load";
    return null;
  }
}
async function detectPerson(imgEl){
  try{
    await loadCoco();
    if(!cocoModel) return false;
    const preds = await cocoModel.detect(imgEl);
    return preds.some(p=>p.class === "person");
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

/* =========================
   ENHANCER: canvas processing + UI
============================*/
const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const enhFileInfo = $("enhFileInfo");
const enhQuality = $("enhQuality");
const enhQualityVal = $("enhQualityVal");
const enhRunBtn = $("enhRunBtn");
const enhPreviewBtn = $("enhPreviewBtn");
const enhOCR = $("enhOCR");
const enhHDR = $("enhHDR");
const enhHide = $("enhHide");
const hideAreaBtn = $("hideAreaBtn");
const hideModal = $("hideModal");
const hidePreview = $("hidePreview");
const hideCanvas = $("hideCanvas");
const hideRectElem = $("hideRect");
const closeHide = $("closeHide");
const saveHide = $("saveHide");
const clearHide = $("clearHide");
const enhStatus = $("enhStatus");

const previewModal = $("previewModal");
const beforeImg = $("beforeImg");
const afterImg = $("afterImg");
const previewArea = $("previewArea");
const afterLayer = $("afterLayer");
const handle = $("handle");
const previewTitle = $("previewTitle");
const previewInfo = $("previewInfo");
const closePreview = $("closePreview");

// internal enhance canvas that holds original/enhanced pixels (image natural size)
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");
let currentEnhFile = null;
let hideRectSaved = null; // in image coordinates {x,y,width,height}

/* drag/click upload for enhancer */
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

async function loadEnhImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode().catch(()=>{});
  enhanceCanvas.width = img.naturalWidth;
  enhanceCanvas.height = img.naturalHeight;
  enhanceCtx.clearRect(0,0,enhanceCanvas.width,enhanceCanvas.height);
  enhanceCtx.drawImage(img,0,0);
  if(enhFileInfo) enhFileInfo.textContent = `${file.name} — ${img.naturalWidth}×${img.naturalHeight}px`;
  if(enhStatus) enhStatus.textContent = "Image loaded.";
  // update preview area images (before/after)
  beforeImg.src = url;
  afterImg.src = url;
  previewInfo && (previewInfo.textContent = `${img.naturalWidth}×${img.naturalHeight}px`);
  hideRectSaved = null;
  URL.revokeObjectURL(url);
}

/* quality UI */
if(enhQuality && enhQualityVal){
  enhQuality.addEventListener("input", ()=> enhQualityVal.textContent = enchQualityValSafe(enhQuality));
}
function enchQualityValSafe(inp){ try{ return (parseInt(inp.value)||92) + "%"; }catch(e){ return "92%"; } }

/* preview modal slider behavior */
let draggingHandle = false;
if(handle){
  handle.addEventListener("mousedown", ()=> { draggingHandle=true; document.body.style.cursor='ew-resize'; });
  document.addEventListener("mouseup", ()=> { draggingHandle=false; document.body.style.cursor=''; });
  document.addEventListener("mousemove", e=>{
    if(!draggingHandle) return;
    if(!previewArea) return;
    const rect = previewArea.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, (e.clientX - rect.left)/rect.width * 100));
    afterLayer.style.width = pct + "%";
    handle.style.left = pct + "%";
  });
}

/* Preview open/close */
on(enhPreviewBtn, "click", ()=> {
  if(!enhanceCanvas.width) return alert("Upload an image first!");
  previewModal && (previewModal.style.display = "flex");
  // ensure preview slider initial position
  afterLayer.style.width = "50%";
  handle.style.left = "50%";
});
on(closePreview, "click", ()=> previewModal && (previewModal.style.display = "none"));

/* enhance run -> apply selected filters and download */
on(enhRunBtn, "click", ()=>{
  if(!enhanceCanvas.width) return alert("Upload an image first!");
  enhStatus && (enhStatus.textContent = "Processing...");
  // get pixels
  let imgData = enhanceCtx.getImageData(0,0,enhanceCanvas.width, enhanceCanvas.height);
  if(enhOCR && enhOCR.checked) imgData = applyOCRBoost(imgData);
  if(enhHDR && enhHDR.checked) imgData = applyHDRToneMap(imgData);
  enhanceCtx.putImageData(imgData, 0, 0);
  if(enhHide && enhHide.checked && hideRectSaved){
    blurRegionOnCanvas(enhanceCtx, hideRectSaved);
  }
  const q = enhQuality ? (parseInt(enhQuality.value)||92)/100 : 0.92;
  const out = enhanceCanvas.toDataURL("image/jpeg", q);
  downloadDataURL(out, (currentEnhFile && currentEnhFile.name) ? (currentEnhFile.name.replace(/\.[^/.]+$/,"") + "_enh.jpg") : "enhanced.jpg");
  enhStatus && (enhStatus.textContent = "Enhancement complete. Downloaded.");
  // update preview after download
  afterImg.src = out;
});

/* preview button earlier opened new window; now preview modal used */

/* =========================
   Filters implementations
============================*/

/* OCR boost: light local contrast/brightness tweak aimed at text */
function applyOCRBoost(imageData){
  const d = imageData.data;
  const len = d.length;
  for(let i=0;i<len;i+=4){
    // lighten midtones + slight contrast
    let r = d[i], g = d[i+1], b = d[i+2];
    const lum = (r+g+b)/3;
    const boost = lum > 128 ? 1.05 : 1.18;
    d[i] = Math.min(255, r * boost);
    d[i+1] = Math.min(255, g * boost);
    d[i+2] = Math.min(255, b * boost);
    // small local contrast
    d[i] = Math.min(255, (d[i] - 128) * 1.06 + 128);
    d[i+1] = Math.min(255, (d[i+1] - 128) * 1.06 + 128);
    d[i+2] = Math.min(255, (d[i+2] - 128) * 1.06 + 128);
  }
  return imageData;
}

/* HDR tone mapping: lift shadows compress highlights gently */
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

/* -------------------------
   Blur utils (multi-pass gaussian horizontal + vertical)
   This implementation uses separable kernel approximated by small weights.
--------------------------*/
function blurRegionOnCanvas(ctx, box){
  if(!box) return;
  const {x,y,width,height} = box;
  if(width <=1 || height <=1) return;
  try{
    let region = ctx.getImageData(x,y,Math.max(1,Math.round(width)), Math.max(1,Math.round(height)));
    const passes = 7; // increase for stronger blur
    for(let p=0;p<passes;p++){
      region = gaussianBlur(region);
    }
    ctx.putImageData(region, x, y);
  }catch(e){
    console.warn("blurRegionOnCanvas fail:", e);
  }
}

function gaussianBlur(imgData){
  // simple separable 5-tap kernel (horizontal then vertical)
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
      for(let k=-half;k<=half;k++){
        const x = Math.min(w-1, Math.max(0, col + k));
        const idx = (row*w + x)*4;
        const wt = weights[k+half];
        r += src[idx] * wt;
        g += src[idx+1] * wt;
        b += src[idx+2] * wt;
        a += src[idx+3] * wt;
      }
      const idxOut = (row*w + col)*4;
      tmp[idxOut] = r; tmp[idxOut+1] = g; tmp[idxOut+2] = b; tmp[idxOut+3] = a;
    }
  }
  // vertical pass
  for(let col=0; col<w; col++){
    for(let row=0; row<h; row++){
      let r=0,g=0,b=0,a=0;
      for(let k=-half;k<=half;k++){
        const y = Math.min(h-1, Math.max(0, row + k));
        const idx = (y*w + col)*4;
        const wt = weights[k+half];
        r += tmp[idx] * wt;
        g += tmp[idx+1] * wt;
        b += tmp[idx+2] * wt;
        a += tmp[idx+3] * wt;
      }
      const idxOut = (row*w + col)*4;
      out[idxOut] = r; out[idxOut+1] = g; out[idxOut+2] = b; out[idxOut+3] = a;
    }
  }
  // write back
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

/* ===========================
   OBJECT HIDE (hide modal interactions)
   We keep hideRectSaved in image pixel coordinates
============================*/
let draggingHide = false;
let startHX=0,startHY=0;

if(hideAreaBtn){
  hideAreaBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width) return alert("Upload an image first!");
    hideModal && (hideModal.style.display = "flex");
    // show preview
    hidePreview && (hidePreview.src = enhanceCanvas.toDataURL("image/jpeg", 0.9));
    // reset rect element visibility
    if(hideRectElem) hideRectElem.style.display = hideRectSaved ? "block" : "none";
  });
}

if(hideCanvas){
  // we want coordinates relative to displayed hidePreview image, then map to image coords
  hideCanvas.addEventListener("mousedown", e=>{
    if(!(enhHide && enhHide.checked)) return;
    draggingHide = true;
    const rect = hideCanvas.getBoundingClientRect();
    startHX = e.clientX - rect.left;
    startHY = e.clientY - rect.top;
    if(hideRectElem){
      hideRectElem.style.display = "block";
      hideRectElem.style.left = startHX + "px";
      hideRectElem.style.top = startHY + "px";
      hideRectElem.style.width = "0px";
      hideRectElem.style.height = "0px";
    }
    hideRectSaved = { x: startHX, y: startHY, width: 0, height: 0 }; // stored as display coords until Save
  });
  hideCanvas.addEventListener("mousemove", e=>{
    if(!draggingHide) return;
    const rect = hideCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const w = cx - startHX;
    const h = cy - startHY;
    if(hideRectElem){
      hideRectElem.style.left = (w>=0 ? startHX : cx) + "px";
      hideRectElem.style.top = (h>=0 ? startHY : cy) + "px";
      hideRectElem.style.width = Math.abs(w) + "px";
      hideRectElem.style.height = Math.abs(h) + "px";
    }
    hideRectSaved = { x: (w>=0 ? startHX : cx), y: (h>=0 ? startHY : cy), width: Math.abs(w), height: Math.abs(h) };
  });
  document.addEventListener("mouseup", ()=> { draggingHide = false; });
}

on(closeHide, "click", ()=> hideModal && (hideModal.style.display="none"));
on(saveHide, "click", ()=>{
  // map display coords to image pixel coords (hidePreview displayed in contain mode)
  if(!hideRectSaved || !hidePreview || !enhanceCanvas.width) { hideModal && (hideModal.style.display="none"); return; }

  // compute image display rect inside hideCanvas
  const dispRect = hidePreview.getBoundingClientRect();
  const canvasRect = hideCanvas.getBoundingClientRect();
  // ratio of image natural to displayed
  const naturalW = enhanceCanvas.width, naturalH = enhanceCanvas.height;
  const dispW = dispRect.width, dispH = dispRect.height;
  const offsetX = dispRect.left - canvasRect.left;
  const offsetY = dispRect.top - canvasRect.top;

  // convert hideRectSaved (display coords) -> image pixel coords
  const sx = Math.max(0, hideRectSaved.x - offsetX);
  const sy = Math.max(0, hideRectSaved.y - offsetY);
  const sw = Math.min(dispW, hideRectSaved.width);
  const sh = Math.min(dispH, hideRectSaved.height);
  const xImg = Math.round((sx / dispW) * naturalW);
  const yImg = Math.round((sy / dispH) * naturalH);
  const wImg = Math.round((sw / dispW) * naturalW);
  const hImg = Math.round((sh / dispH) * naturalH);

  hideRectSaved = { x: xImg, y: yImg, width: wImg, height: hImg };
  hideModal && (hideModal.style.display="none");
  enhStatus && (enhStatus.textContent = "Hide area saved. Will be applied on Enhance.");
});
on(clearHide, "click", ()=>{
  hideRectSaved = null;
  if(hideRectElem) hideRectElem.style.display = "none";
  enhStatus && (enhStatus.textContent = "Hide area cleared.");
});


/* ===========================
   ANNOTATION TOOL — canvas overlay on previewArea
   - freehand drawing for rect/arrow/text/highlight/blur
   - we draw on an annotation canvas sized to displayed preview area (CSS pixels)
   - apply merges annotations to enhanceCanvas by scaling
============================*/
const annoCanvas = $("annoCanvas");
const annoToolbar = $("annoToolbar");
const annoButtons = document.querySelectorAll(".anno-btn");
const annUndo = $("annUndo");
const annClear = $("annClear");
const annApply = $("annApply");
const annColor = $("annColor");
const annSize = $("annSize");

let annoCtx = null;
let annoWidth = 0, annoHeight = 0;
let annoActiveTool = null;
let drawing = false;
let startX=0, startY=0;
let actionsStack = []; // store drawn shapes to support undo
let redoStack = [];

function ensureAnnoCanvas(){
  if(!annoCanvas || !previewArea) return false;
  // set canvas pixel size to previewArea size (accounting for devicePixelRatio)
  const rect = previewArea.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  const w = Math.max(10, Math.floor(rect.width));
  const h = Math.max(10, Math.floor(rect.height));
  annoCanvas.style.width = w + "px";
  annoCanvas.style.height = h + "px";
  annoCanvas.width = Math.floor(w * ratio);
  annoCanvas.height = Math.floor(h * ratio);
  annoCtx = annoCanvas.getContext("2d");
  annoCtx.scale(ratio, ratio);
  annoWidth = w; annoHeight = h;
  // make sure pointer events allowed to draw
  annoCanvas.style.pointerEvents = "auto";
  clearAnno();
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
  for(const a of actionsStack) {
    drawAction(annoCtx, a, false);
  }
}

function drawAction(ctx, action, previewOnly){
  // action: { tool, x, y, x2, y2, color, size, text }
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = action.color || "#ff7a3c";
  ctx.fillStyle = action.color || "#ff7a3c";
  ctx.lineWidth = Math.max(1, action.size || 4);
  if(action.tool === "rect"){
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.setLineDash([6,6]);
    ctx.strokeRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(255,122,60,0.12)";
    ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
  } else if(action.tool === "arrow"){
    // line + arrow head
    ctx.beginPath();
    ctx.moveTo(action.x, action.y);
    ctx.lineTo(action.x2, action.y2);
    ctx.stroke();
    // arrow head
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
  } else if(action.tool === "blur"){
    // draw semi-opaque rectangle as visual cue (actual blur applied on merge)
    ctx.globalAlpha = 0.6;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(action.x, action.y, action.x2 - action.x, action.y2 - action.y);
    // store action for later actual blur merging
  } else if(action.tool === "free"){
    // stroke path recorded as points
    ctx.beginPath();
    const pts = action.points || [];
    if(pts.length){
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i=1;i<pts.length;i++){
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
}

/* annotate toolbar events */
annoButtons.forEach(b=>{
  b.addEventListener("click", ()=>{
    // toggle active state
    annoButtons.forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    annoActiveTool = b.dataset.tool;
    // show toolbar panel
    if(annoToolbar) annoToolbar.style.display = "flex";
    // ensure annotation canvas size
    ensureAnnoCanvas();
  });
});

if(annClear) annClear.addEventListener("click", ()=> { clearAnno(); });
if(annUndo) annUndo.addEventListener("click", ()=> {
  if(actionsStack.length) {
    redoStack.push(actionsStack.pop());
    redrawAll();
  }
});
if(annApply) annApply.addEventListener("click", ()=>{
  // merge annotations to enhanceCanvas (image pixel coords)
  if(!enhanceCanvas.width || !annoCanvas) return alert("Nothing to apply.");
  // create a temp canvas sized to image natural size
  const tmp = document.createElement("canvas");
  tmp.width = enhanceCanvas.width;
  tmp.height = enhanceCanvas.height;
  const tctx = tmp.getContext("2d");
  // draw current image
  tctx.drawImage(enhanceCanvas, 0, 0);
  // draw each action by scaling annotation coordinates to image coords
  const dispRect = previewArea.getBoundingClientRect();
  const dispW = dispRect.width, dispH = dispRect.height;
  for(const a of actionsStack){
    // compute scaled action
    const scaleX = enhanceCanvas.width / dispW;
    const scaleY = enhanceCanvas.height / dispH;
    if(a.tool === "text"){
      // text: draw with simple settings
      tctx.fillStyle = a.color || "#ff7a3c";
      tctx.font = `${Math.max(12, a.size*3) * scaleX}px Inter, sans-serif`;
      tctx.fillText(a.text || "", a.x*scaleX, a.y*scaleY);
    } else if(a.tool === "rect" || a.tool === "highlight"){
      const sx = Math.round(a.x * scaleX);
      const sy = Math.round(a.y * scaleY);
      const sw = Math.round((a.x2 - a.x) * scaleX);
      const sh = Math.round((a.y2 - a.y) * scaleY);
      if(a.tool === "rect"){
        tctx.strokeStyle = a.color || "#ff7a3c";
        tctx.lineWidth = Math.max(2, a.size || 4) * scaleX;
        tctx.setLineDash([6*scaleX,6*scaleX]);
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
      const x1 = a.x*scaleX, y1 = a.y*scaleY, x2 = a.x2*scaleX, y2 = a.y2*scaleY;
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
      // apply blur area on tmp canvas (image pixel coords)
      const sx = Math.round(a.x * scaleX);
      const sy = Math.round(a.y * scaleY);
      const sw = Math.max(1, Math.round((a.x2 - a.x) * scaleX));
      const sh = Math.max(1, Math.round((a.y2 - a.y) * scaleY));
      try{
        let region = tctx.getImageData(sx, sy, sw, sh);
        // multi-pass gaussian blur
        const passes = 7;
        for(let p=0;p<passes;p++) region = gaussianBlur(region);
        tctx.putImageData(region, sx, sy);
      }catch(e){ console.warn("apply blur action fail", e); }
    } else if(a.tool === "free"){
      // draw freehand strokes scaled
      tctx.strokeStyle = a.color || "#ff7a3c";
      tctx.lineWidth = Math.max(1, a.size || 4) * Math.max(scaleX,scaleY);
      tctx.beginPath();
      const pts = a.points || [];
      if(pts.length){
        tctx.moveTo(pts[0].x*scaleX, pts[0].y*scaleY);
        for(let i=1;i<pts.length;i++){
          tctx.lineTo(pts[i].x*scaleX, pts[i].y*scaleY);
        }
        tctx.stroke();
      }
    }
  }
  // copy tmp back to enhanceCanvas
  enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
  enhanceCtx.drawImage(tmp, 0, 0);
  // update preview image
  const out = enhanceCanvas.toDataURL("image/jpeg", 0.92);
  afterImg.src = out;
  enhStatus && (enhStatus.textContent = "Annotations applied to image.");
  // clear annotation overlay
  clearAnno();
});

/* annotation canvas mouse handling (drawing shapes) */
if(annoCanvas){
  annoCanvas.addEventListener("mousedown", e=>{
    if(!annoActiveTool) return;
    drawing = true;
    const r = annoCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    startX = x; startY = y;
    if(annoActiveTool === "free"){
      // create freehand action
      const action = { tool:"free", color: annColor ? annColor.value : "#ff7a3c", size: annSize ? parseInt(annSize.value||4) : 4, points:[{x,y}]};
      actionsStack.push(action);
    } else if(annoActiveTool === "text"){
      const txt = prompt("Enter text to add:");
      if(!txt) { drawing=false; return; }
      const action = { tool:"text", x, y, color: annColor ? annColor.value : "#ff7a3c", size: annSize ? parseInt(annSize.value||14) : 14, text: txt };
      actionsStack.push(action);
      redrawAll();
      drawing=false;
    } else {
      // push a placeholder action so we can update x2,y2 on mousemove
      const action = { tool: annoActiveTool, x, y, x2: x, y2: y, color: annColor ? annColor.value : "#ff7a3c", size: annSize ? parseInt(annSize.value||4) : 4 };
      actionsStack.push(action);
    }
  });

  annoCanvas.addEventListener("mousemove", e=>{
    if(!drawing) return;
    const r = annoCanvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const current = actionsStack[actionsStack.length -1];
    if(!current) return;
    if(current.tool === "free"){
      current.points.push({x,y});
    } else {
      current.x2 = x; current.y2 = y;
    }
    redrawAll();
  });

  annoCanvas.addEventListener("mouseup", e=>{
    if(drawing) {
      drawing = false;
      // finalize shape
      // if rectangle/arrow with negative width/height keep as is; drawAction will handle
      redrawAll();
    }
  });
}

/* Undo/clear events are above (annUndo/annClear) */

/* ===========================
   Small UX init
============================*/
ensureAnnoCanvas();
showSection(isAuthed() ? "home" : "home");
document.addEventListener("keydown", e=>{
  if(e.key === "Escape"){
    // close any modal
    [previewModal, hideModal, themeModal, $("aboutModal")].forEach(m=>{ if(m) m.style.display = "none"; });
  }
});

/* prevent clicks on preview images (they are background) */
if(beforeImg) beforeImg.style.pointerEvents = "none";
if(afterImg) afterImg.style.pointerEvents = "none";

/* Safety - prevent uncaught errors from freezing UI */
window.addEventListener("error", (ev)=>{
  console.error("Runtime error:", ev.error || ev.message);
  // keep UI visible
});

/* End of script_v.js */
