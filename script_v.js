/* ==========================================================
   Meta Media Hub - script_v.js
   Full client-side logic:
   - Auth / Sections
   - Theme modal (T2)
   - Image Resizer (scan + UI plumbing)
   - AI Enhancer (Upscale, Sharpen-Pro, Denoise, HDR, OCR)
   - Privacy Blur (draw rect on anno canvas)
   - Annotation toolbar (Option B): rect, arrow, text, highlight, blur, undo, clear, apply
   - Preview & Download
   All operations run in-browser. No server calls.
   ========================================================== */


/* ===========
   Small helpers
   =========== */
const $ = id => document.getElementById(id);
const elExists = id => !!$(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ====================
   AUTH + SECTION LOGIC
   ==================== */
const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");

const AUTH_KEY = "mm_auth_v3";
const PASSWORD = "Meta@123";

function saveAuth(v){ if(v) localStorage.setItem(AUTH_KEY, "true"); else localStorage.removeItem(AUTH_KEY); }
function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }

function showSection(name){
  const home = $("home");
  const imageSection = $("imageSection");
  const enhancerSection = $("enhancerSection");

  if(home) home.style.display = name==="home" ? "flex" : "none";
  if(imageSection) imageSection.style.display = name==="resize" ? "block" : "none";
  if(enhancerSection) enhancerSection.style.display = name==="enhance" ? "block" : "none";

  // animate (make visible)
  if(home) home.classList.toggle("active", name==="home");
  if(imageSection) imageSection.classList.toggle("active", name==="resize");
  if(enhancerSection) enhancerSection.classList.toggle("active", name==="enhance");
}

function unlock(){
  if(!pwInput) return;
  pwMsg.textContent = "";
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    if(pwModal) pwModal.style.display = "none";
    if(statusText) statusText.textContent = "Unlocked";
    showSection("home");
    pwInput.value = "";
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}
if(pwBtn) pwBtn.addEventListener("click", unlock);
if(pwInput) pwInput.addEventListener("keydown", e => { if(e.key === "Enter") unlock(); });

if(isAuthed()){
  if(pwModal) pwModal.style.display = "none";
  if(statusText) statusText.textContent = "Unlocked";
  showSection("home");
} else {
  // keep modal visible
  if(pwModal) pwModal.style.display = "flex";
}

/* ====================
   THEME MODAL (T2)
   ==================== */
const themeBtn = $("themeBtn");
const themeModal = $("themeModal");
const closeTheme = $("closeTheme");
const THEME_SAVE_KEY = "mm_theme_choice";

function applyThemeClass(key){
  // removes previously applied theme-* classes and adds new
  const bodies = document.body.className.split(" ").filter(Boolean);
  const filtered = bodies.filter(c => !c.startsWith("theme-"));
  filtered.push("theme-" + key);
  document.body.className = filtered.join(" ");
  try{ localStorage.setItem(THEME_SAVE_KEY, key); }catch(e){}
}

if(themeBtn) themeBtn.addEventListener("click", ()=> { if(themeModal) themeModal.style.display = "flex"; });
if(closeTheme) closeTheme.addEventListener("click", ()=> { if(themeModal) themeModal.style.display = "none"; });

document.querySelectorAll(".theme-card").forEach(card=>{
  card.addEventListener("click", () => {
    const t = card.getAttribute("data-theme");
    if(!t) return;
    applyThemeClass(t);
    if(themeModal) themeModal.style.display = "none";
  });
});

// load saved
const savedTheme = localStorage.getItem(THEME_SAVE_KEY) || "flaming-orange";
applyThemeClass(savedTheme);

/* small: light/dark toggle (keeps compatibility) */
const themeToggle = $("themeToggle");
if(themeToggle){
  themeToggle.addEventListener("click", ()=>{
    // toggle a simple 'theme-light' class in addition to selected theme keys
    if(document.documentElement.classList.contains("theme-light")){
      document.documentElement.classList.remove("theme-light");
      themeToggle.textContent = "🌙";
    } else {
      document.documentElement.classList.add("theme-light");
      themeToggle.textContent = "☀️";
    }
  });
}

/* ====================
   NAVIGATION (home -> tools)
   ==================== */
const btnImage = $("btnImage");
const btnEnhancer = $("btnEnhancer");
const backHomeFromImage = $("backHomeFromImage");
const backHomeFromEnhancer = $("backHomeFromEnhancer");

if(btnImage) btnImage.addEventListener("click", ()=> showSection("resize"));
if(btnEnhancer) btnEnhancer.addEventListener("click", ()=> showSection("enhance"));
if(backHomeFromImage) backHomeFromImage.addEventListener("click", ()=> showSection("home"));
if(backHomeFromEnhancer) backHomeFromEnhancer.addEventListener("click", ()=> showSection("home"));

/* ABOUT modal */
const aboutBtn = $("aboutBtn");
const aboutModal = $("aboutModal");
const closeAbout = $("closeAbout");
if(aboutBtn && aboutModal) aboutBtn.addEventListener("click", ()=> aboutModal.style.display = "flex");
if(closeAbout && aboutModal) closeAbout.addEventListener("click", ()=> aboutModal.style.display = "none");

/* =========================
   IMAGE RESIZER (scan)
   Minimal but functional: upload + AI person detection (coco-ssd)
   ========================= */
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

async function loadCoco(){
  if(cocoModel) return cocoModel;
  if(imgStatus) imgStatus.textContent = "Loading model…";
  try{
    cocoModel = await cocoSsd.load();
    if(imgStatus) imgStatus.textContent = "Model ready";
    return cocoModel;
  }catch(e){
    console.warn("Coco load failed", e);
    if(imgStatus) imgStatus.textContent = "Model failed";
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

function refreshImageList(){
  if(!imageFileList) return;
  if(!imageFiles.length){
    imageFileList.innerHTML = "No files uploaded.";
    if(smartBanner) smartBanner.style.display = "none";
    return;
  }
  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    const st = imageDetectionMap[f.name] || "unknown";
    let icon = "⏳", label = "Scanning...";
    if(st === "person"){ icon = "👤"; label = "Human found"; }
    if(st === "none"){ icon = "❌"; label = "No person"; }
    return `<div class="file-row"><span>${icon}</span><div><b>${i+1}. ${f.name}</b><br><small>${label} — ${Math.round(f.size/1024)} KB</small></div></div>`;
  }).join("");
}

if(dropImage && imageInput){
  dropImage.addEventListener("click", ()=> imageInput.click());
  dropImage.addEventListener("dragover", e => { e.preventDefault(); dropImage.style.background = "rgba(255,255,255,0.03)"; });
  dropImage.addEventListener("dragleave", () => { dropImage.style.background = ""; });
  dropImage.addEventListener("drop", async e => {
    e.preventDefault(); dropImage.style.background = "";
    imageFiles = Array.from(e.dataTransfer.files);
    await handleNewImages();
  });

  imageInput.addEventListener("change", async e => {
    imageFiles = Array.from(e.target.files);
    await handleNewImages();
  });
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
    try{ await img.decode(); } catch(e){}
    const hasPerson = await detectPerson(img);
    imageDetectionMap[file.name] = hasPerson ? "person" : "none";
    if(hasPerson) found++;
    refreshImageList();
    URL.revokeObjectURL(url);
  }

  if(bannerIcon) bannerIcon.textContent = found ? "🟢" : "⚪";
  if(bannerText) bannerText.innerHTML = found ? `Smart Human Detection: found people in <b>${found}</b> of ${imageFiles.length} image(s).` : `Smart Human Detection: no people found.`;
  if(imgAiToggle) imgAiToggle.classList.toggle("active", found>0);
  if(imgStatus) imgStatus.textContent = "Scan complete.";
}

/* update quality label */
const imgQuality = $("imgQuality");
const imgQualityVal = $("imgQualityVal");
if(imgQuality && imgQualityVal){
  imgQuality.addEventListener("input", ()=> imgQualityVal.textContent = imgQuality.value + "%");
}

/* ============================
   AI ENHANCER SECTION
   - uses an offscreen enhanceCanvas for processing
   - annoCanvas is used for annotation + blur drawing
   ============================ */

let enhanceFiles = [];
const enhanceCanvas = document.createElement("canvas"); // offscreen
const enhanceCtx = enhanceCanvas.getContext("2d");
let currentEnhFile = null;

// DOM bindings (from your HTML)
const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const enhFileInfo = $("enhFileInfo");
const enhQuality = $("enhQuality");
const enhQualityVal = $("enhQualityVal");
const enhRunBtn = $("enhRunBtn");
const enhPreviewBtn = $("enhPreviewBtn");
const enhOCR = $("enhOCR");
const enhHDR = $("enhHDR");
const enhDenoise = $("enhDenoise");
const enhUpscale2x = $("enhUpscale2x");
const enhUpscale4x = $("enhUpscale4x");
const enhFaceEnhance = $("enhFaceEnhance");
const enhHide = $("enhHide");
const hideAreaBtn = $("hideAreaBtn");
const enhStatus = $("enhStatus");

const previewArea = $("previewArea");
const beforeImg = $("beforeImg");
const afterImg = $("afterImg");

// annotation canvas overlay (visible)
const annoCanvas = $("annoCanvas");
const annoCtx = annoCanvas ? annoCanvas.getContext("2d") : null;
const annoToolbar = $("annoToolbar");
const annColor = $("annColor");
const annSize = $("annSize");
const annApply = $("annApply");
const annUndo = $("annUndo");
const annClear = $("annClear");

// internal state for hide rectangle (used by blur tool)
let hideRectEnh = null; // x,y,width,height in image pixel coords (not CSS)
let imageNaturalW = 0, imageNaturalH = 0; // loaded image size

// For annotation drawing stack & tool state
let annoTool = null; // 'rect','arrow','text','highlight','blur'
let drawing = false;
let startX = 0, startY = 0;
let scaleToCanvas = { sx:1, sy:1, dx:0, dy:0 }; // mapping from image space -> canvas space for display
const annoOps = []; // stack of operations {type, params, color, size, text}
const redoStack = [];

// Ensure annoCanvas matches previewArea size in pixels (CSS size -> bitmap)
function fitAnnoCanvasToPreview(){
  if(!annoCanvas || !previewArea) return;
  const rect = previewArea.getBoundingClientRect();
  // set canvas CSS size to match preview area and pixel buffer to devicePixelRatio * size
  annoCanvas.style.left = rect.left + "px";
  annoCanvas.style.top = rect.top + "px";
  // but we want the canvas positioned inside previewArea by CSS; simpler: set width/height to preview client size
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if(w <= 0 || h <= 0) return;
  // set canvas attributes (pixel buffer)
  const ratio = window.devicePixelRatio || 1;
  annoCanvas.width = Math.round(w * ratio);
  annoCanvas.height = Math.round(h * ratio);
  annoCanvas.style.width = w + "px";
  annoCanvas.style.height = h + "px";
  if(annoCtx){
    annoCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
    // clear
    annoCtx.clearRect(0,0,w,h);
    // redraw existing ops
    redrawAnnoOps();
  }
}

// redraw annotation operations onto annoCanvas
function redrawAnnoOps(){
  if(!annoCtx || !previewArea) return;
  // clear
  const rect = previewArea.getBoundingClientRect();
  const w = rect.width, h = rect.height;
  annoCtx.clearRect(0,0,w,h);

  // draw each op
  for(const op of annoOps){
    drawOpOnCtx(annoCtx, op);
  }
}

// draw one operation on a given 2D context (context expects coordinate system matched to preview display)
function drawOpOnCtx(ctx, op){
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const color = op.color || "#ff7a3c";
  const size = op.size || 4;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = op.type === "highlight" ? 0.18 : 1.0;

  if(op.type === "rect" || op.type === "blur" || op.type === "highlight"){
    ctx.lineWidth = size;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    const r = op.coords; // [x,y,w,h] in display canvas coords
    if(op.type === "highlight"){
      ctx.fillRect(r[0], r[1], r[2], r[3]);
    } else {
      // stroke rect
      ctx.strokeRect(r[0], r[1], r[2], r[3]);
    }
  } else if(op.type === "arrow"){
    // draw simple arrow from x1,y1 -> x2,y2
    const [x1,y1,x2,y2] = op.coords;
    ctx.lineWidth = size;
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();

    // arrowhead
    const angle = Math.atan2(y2-y1, x2-x1);
    const headLen = Math.max(8, size*3);
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen*Math.cos(angle - Math.PI/6), y2 - headLen*Math.sin(angle - Math.PI/6));
    ctx.lineTo(x2 - headLen*Math.cos(angle + Math.PI/6), y2 - headLen*Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fill();
  } else if(op.type === "text"){
    ctx.font = `${Math.max(12, op.size*3)}px Inter, Arial`;
    ctx.fillStyle = color;
    ctx.fillText(op.text || "", op.x, op.y);
  }

  ctx.restore();
}

/* convert image-space rect to preview display coords
   image-space = natural image pixel coords (0..imageNaturalW)
   display-space = coordinates inside previewArea (pixel measured)
*/
function imageRectToDisplay(rect){
  // rect: {x,y,width,height} in image pixels
  // find ratio of displayed image inside previewArea (object-fit:contain)
  if(!beforeImg) return [rect.x, rect.y, rect.width, rect.height];
  const dispRect = beforeImg.getBoundingClientRect();
  // compute scale between natural and displayed
  const scaleX = dispRect.width / imageNaturalW;
  const scaleY = dispRect.height / imageNaturalH;
  // because object-fit:contain, scaleX===scaleY
  const s = Math.min(scaleX, scaleY);
  // center offset (image might be letterboxed)
  // compute actual image draw size
  const drawW = imageNaturalW * s;
  const drawH = imageNaturalH * s;
  const offsetX = dispRect.left + (dispRect.width - drawW)/2;
  const offsetY = dispRect.top + (dispRect.height - drawH)/2;
  // convert
  const dx = offsetX + rect.x * s - dispRect.left; // relative to previewArea left
  const dy = offsetY + rect.y * s - dispRect.top;
  const dw = rect.width * s;
  const dh = rect.height * s;
  // since annoCanvas coordinates are relative to preview area top-left, return [dx,dy,dw,dh]
  const previewRect = previewArea.getBoundingClientRect();
  return [dx, dy, dw, dh];
}

/* convert display coords to image-space rect (inverse of above) */
function displayRectToImage(x,y,w,h){
  if(!beforeImg) return { x, y, width: w, height: h };
  const dispRect = beforeImg.getBoundingClientRect();
  const scaleX = dispRect.width / imageNaturalW;
  const scaleY = dispRect.height / imageNaturalH;
  const s = Math.min(scaleX, scaleY);
  const drawW = imageNaturalW * s;
  const drawH = imageNaturalH * s;
  const offsetX = dispRect.left + (dispRect.width - drawW)/2;
  const offsetY = dispRect.top + (dispRect.height - drawH)/2;
  // x,y are relative to previewArea left/top; convert to absolute then to image coords
  const absX = x + previewArea.getBoundingClientRect().left;
  const absY = y + previewArea.getBoundingClientRect().top;
  const ix = (absX - offsetX) / s;
  const iy = (absY - offsetY) / s;
  const iw = w / s;
  const ih = h / s;
  return { x: Math.round(ix), y: Math.round(iy), width: Math.round(iw), height: Math.round(ih) };
}

/* ================
   Enhance: Load image
   ================ */
if(dropEnhance && enhanceInput){
  dropEnhance.addEventListener("click", ()=> enhanceInput.click());
  dropEnhance.addEventListener("dragover", e => { e.preventDefault(); dropEnhance.style.background = "rgba(255,255,255,0.03)"; });
  dropEnhance.addEventListener("dragleave", () => { dropEnhance.style.background = ""; });
  dropEnhance.addEventListener("drop", async e => {
    e.preventDefault(); dropEnhance.style.background = ""; enhanceFiles = Array.from(e.dataTransfer.files); if(enhanceFiles.length) await loadEnhImage(enhanceFiles[0]);
  });
  enhanceInput.addEventListener("change", async e => {
    enhanceFiles = Array.from(e.target.files);
    if(enhanceFiles.length) await loadEnhImage(enhanceFiles[0]);
  });
}

async function loadEnhImage(file){
  if(!file) return;
  currentEnhFile = file;
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  try{ await img.decode(); }catch(e){ /* ignore */ }

  // set natural sizes
  imageNaturalW = img.naturalWidth;
  imageNaturalH = img.naturalHeight;

  // set enhanceCanvas size to natural
  enhanceCanvas.width = imageNaturalW;
  enhanceCanvas.height = imageNaturalH;
  enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
  enhanceCtx.drawImage(img, 0, 0, imageNaturalW, imageNaturalH);

  // show before/after preview: beforeImg shows original, afterImg shows current enhanced (initially same)
  if(beforeImg) beforeImg.src = url;
  afterImg.src = enhanceCanvas.toDataURL("image/jpeg", (parseInt(enhQuality?.value || 92)/100));
  if(enhFileInfo) enhFileInfo.textContent = `${file.name} — ${imageNaturalW}×${imageNaturalH}px`;
  if(enhStatus) enhStatus.textContent = "Image loaded. Choose options.";

  // reset annotation & hide area
  annoOps.length = 0;
  hideRectEnh = null;
  fitAnnoCanvasToPreview();
  redrawAnnoOps();

  URL.revokeObjectURL(url);
}

/* enhance quality label */
if(enhQuality && enhQualityVal){
  enhQuality.addEventListener("input", ()=> enhQualityVal.textContent = enhQuality.value + "%");
}

/* ===========================
   IMAGE PROCESSING FUNCTIONS
   (operate on ImageData)
   =========================== */

/* OCR boost: increase mid-tone contrast for text clarity */
function applyOCRBoost(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    const r=d[i], g=d[i+1], b=d[i+2];
    const avg = (r+g+b)/3;
    const boost = avg>128 ? 1.06 : 1.18;
    d[i] = clamp(Math.round(r*boost),0,255);
    d[i+1] = clamp(Math.round(g*boost),0,255);
    d[i+2] = clamp(Math.round(b*boost),0,255);
  }
  return imageData;
}

/* HDR tone map: lift shadows and compress highlights */
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
  if(v < 90) return clamp(Math.round(v*1.28), 0, 255);
  if(v > 200) return clamp(Math.round(v*0.9), 0, 255);
  return v;
}

/* Simple denoise: small bilateral-ish blur approximation using two-pass box blur */
function applyDenoise(imageData){
  // two-pass box blur (fast, gentle)
  const tmp = boxBlur(imageData, 1); // radius 1
  const tmp2 = boxBlur(tmp, 1);
  return tmp2;
}

function boxBlur(imgData, radius){
  // radius small (1 or 2)
  const w = imgData.width, h = imgData.height;
  const out = new ImageData(w,h);
  const a = imgData.data, b = out.data;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,bv=0,cnt=0;
      for(let yy = Math.max(0,y-radius); yy<=Math.min(h-1,y+radius); yy++){
        for(let xx = Math.max(0,x-radius); xx<=Math.min(w-1,x+radius); xx++){
          const idx = (yy*w+xx)*4;
          r += a[idx]; g += a[idx+1]; bv += a[idx+2];
          cnt++;
        }
      }
      const id = (y*w+x)*4;
      b[id] = Math.round(r/cnt);
      b[id+1] = Math.round(g/cnt);
      b[id+2] = Math.round(bv/cnt);
      b[id+3] = a[id+3];
    }
  }
  return out;
}

/* Sharpen: unsharp mask approximation */
function applySharpen(imageData, amount=0.6){
  // create blurred version and add difference
  const blurred = boxBlur(imageData, 1);
  const w = imageData.width, h = imageData.height;
  const src = imageData.data, blur = blurred.data;
  const out = new ImageData(w,h);
  const dst = out.data;
  for(let i=0;i<src.length;i+=4){
    for(let c=0;c<3;c++){
      const val = src[i+c] + amount*(src[i+c] - blur[i+c]);
      dst[i+c] = clamp(Math.round(val), 0, 255);
    }
    dst[i+3] = src[i+3];
  }
  return out;
}

/* Upscale: simple canvas-based upscale using browser interpolation (imageSmoothingEnabled)
   factor: 2 or 4
*/
function upscaleCanvas(srcCanvas, factor){
  const dst = document.createElement("canvas");
  dst.width = Math.round(srcCanvas.width * factor);
  dst.height = Math.round(srcCanvas.height * factor);
  const ctx = dst.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(srcCanvas, 0, 0, dst.width, dst.height);
  return dst;
}

/* Strong privacy blur: multi-pass gaussian-ish blur on a region */
function blurRegionOnCanvas(ctx, box, passes = 7){
  if(!box || box.width<=0 || box.height<=0) return;
  // extract region from ctx
  const imgData = ctx.getImageData(box.x, box.y, box.width, box.height);
  let tmp = imgData;
  for(let i=0;i<passes;i++){
    tmp = gaussianBlur(tmp, box.width, box.height);
  }
  ctx.putImageData(tmp, box.x, box.y);
}

/* gaussian blur (fast horizontal then vertical) -> simplified using separable kernel with radius 2 */
function gaussianBlur(imgData, w, h){
  const weights = [0.1201,0.2339,0.2920,0.2339,0.1201];
  const half = 2;
  const src = imgData.data;
  const tmp = new Uint8ClampedArray(src.length);
  // horizontal
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0,a=0;
      for(let k=-half;k<=half;k++){
        const px = Math.min(w-1, Math.max(0, x+k));
        const idx = (y*w+px)*4;
        const wgt = weights[k+half];
        r += src[idx]*wgt;
        g += src[idx+1]*wgt;
        b += src[idx+2]*wgt;
        a += src[idx+3]*wgt;
      }
      const id = (y*w+x)*4;
      tmp[id] = r; tmp[id+1] = g; tmp[id+2] = b; tmp[id+3] = a;
    }
  }
  // vertical into original buffer
  const out = new ImageData(w,h);
  const outd = out.data;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0,a=0;
      for(let k=-half;k<=half;k++){
        const py = Math.min(h-1, Math.max(0, y+k));
        const idx = (py*w+x)*4;
        const wgt = weights[k+half];
        r += tmp[idx]*wgt;
        g += tmp[idx+1]*wgt;
        b += tmp[idx+2]*wgt;
        a += tmp[idx+3]*wgt;
      }
      const id = (y*w+x)*4;
      outd[id]= Math.round(r); outd[id+1]=Math.round(g); outd[id+2]=Math.round(b); outd[id+3]=Math.round(a);
    }
  }
  return out;
}

/* =================
   ENHANCE RUN / PREVIEW
   ================= */
if(enhRunBtn){
  enhRunBtn.addEventListener("click", async ()=>{
    if(!enhanceCanvas.width){
      alert("Upload an image first!");
      return;
    }
    if(enhStatus) enhStatus.textContent = "Processing…";
    // start with enhanceCanvas data
    let workCanvas = document.createElement("canvas");
    workCanvas.width = enhanceCanvas.width;
    workCanvas.height = enhanceCanvas.height;
    const wctx = workCanvas.getContext("2d");
    wctx.drawImage(enhanceCanvas, 0, 0);

    // Upscale first if requested
    if(enhUpscale4x && enhUpscale4x.checked){
      workCanvas = upscaleCanvas(workCanvas, 4);
    } else if(enhUpscale2x && enhUpscale2x.checked){
      workCanvas = upscaleCanvas(workCanvas, 2);
    }

    // get ImageData
    const wctx2 = workCanvas.getContext("2d");
    let id = wctx2.getImageData(0,0,workCanvas.width, workCanvas.height);

    // Denoise
    if(enhDenoise && enhDenoise.checked){
      id = applyDenoise(id);
    }

    // Face enhance -> approximate with sharpen for now
    if(enhFaceEnhance && enhFaceEnhance.checked){
      id = applySharpen(id, 0.9);
    }

    // OCR
    if(enhOCR && enhOCR.checked){
      id = applyOCRBoost(id);
    }

    // HDR
    if(enhHDR && enhHDR.checked){
      id = applyHDRToneMap(id);
    }

    // Sharpen slightly at end if not face-enhanced
    if(!(enhFaceEnhance && enhFaceEnhance.checked)){
      id = applySharpen(id, 0.6);
    }

    // put back to canvas
    wctx2.putImageData(id, 0, 0);

    // If hide blur requested and a hideRectEnh exists in image coordinates, blur on the workCanvas
    if(enhHide && enhHide.checked && hideRectEnh){
      // ensure hideRectEnh coordinates map to workCanvas coordinates (if upscaled, multiply)
      const factor = workCanvas.width / enhanceCanvas.width;
      const box = {
        x: Math.round(hideRectEnh.x * factor),
        y: Math.round(hideRectEnh.y * factor),
        width: Math.round(hideRectEnh.width * factor),
        height: Math.round(hideRectEnh.height * factor)
      };
      blurRegionOnCanvas(wctx2, box, 8);
    }

    // Show result in afterImg and update enhanceCanvas to final output (so subsequent ops apply)
    const q = enhQuality ? (parseInt(enhQuality.value) || 92)/100 : 0.92;
    const outDataUrl = workCanvas.toDataURL("image/jpeg", q);

    // replace enhanceCanvas content with workCanvas (so next operations start from result)
    enhanceCanvas.width = workCanvas.width;
    enhanceCanvas.height = workCanvas.height;
    enhanceCtx.setTransform(1,0,0,1,0,0);
    enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
    enhanceCtx.drawImage(workCanvas, 0, 0);

    // display
    afterImg.src = outDataUrl;
    if(enhStatus) enhStatus.textContent = "Enhancement complete. Download will start.";
    // auto-download
    downloadDataUrl(outDataUrl, `enhanced_${currentEnhFile ? currentEnhFile.name.replace(/\.[^/.]+$/,"") : Date.now()}.jpg`);
    // ensure preview area/anno canvas fits
    setTimeout(()=>{ fitAnnoCanvasToPreview(); }, 60);
  });
}

/* Preview button - opens new tab with current enhanced image */
if(enhPreviewBtn){
  enhPreviewBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){ alert("Upload an image first!"); return; }
    const url = enhanceCanvas.toDataURL("image/jpeg", (parseInt(enhQuality?.value||92)/100));
    // open in new window/tab
    const w = window.open("");
    if(!w) { alert("Popup blocked — allow popups to preview."); return; }
    const html = `<title>Preview</title><img src="${url}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`;
    w.document.write(html);
    w.document.close();
  });
}

/* =======================
   Annotation Toolbar Logic
   ======================= */

// make toolbar visible only when enhanceCanvas has content
function showAnnoToolbar(flag){
  if(!annoToolbar) return;
  annoToolbar.style.display = flag ? "block" : "none";
}

// attach tool buttons
document.querySelectorAll(".anno-btn").forEach(b=>{
  b.addEventListener("click", ()=>{
    // remove active on others
    document.querySelectorAll(".anno-btn").forEach(x=>x.classList.remove("active"));
    b.classList.add("active");
    annoTool = b.getAttribute("data-tool");
    // if blur, let user draw region; if text -> prompt on click
  });
});

// Undo & Clear
if(annUndo){
  annUndo.addEventListener("click", ()=>{
    if(annoOps.length) { redoStack.push(annoOps.pop()); redrawAnnoOps(); }
  });
}
if(annClear){
  annClear.addEventListener("click", ()=>{
    annoOps.length = 0; redoStack.length = 0; redrawAnnoOps();
  });
}

// Apply -> merge annotation ops onto enhanceCanvas (image pixel coords)
if(annApply){
  annApply.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){ alert("Nothing to apply"); return; }
    // Merge: create a temporary canvas with same size as enhanceCanvas, draw enhanced image there scaled to natural, then draw annotations scaled from display coords to image coords
    const tmp = document.createElement("canvas");
    tmp.width = enhanceCanvas.width;
    tmp.height = enhanceCanvas.height;
    const tctx = tmp.getContext("2d");
    // draw current enhanced image into tmp (it is already in enhanceCanvas)
    tctx.drawImage(enhanceCanvas, 0, 0);

    // draw each op scaled from display coords => image coords
    const dispRect = beforeImg.getBoundingClientRect();
    const dispW = dispRect.width, dispH = dispRect.height;
    const s = Math.min(dispW / imageNaturalW, dispH / imageNaturalH);
    const drawW = imageNaturalW * s, drawH = imageNaturalH * s;
    const offsetX = (dispW - drawW)/2, offsetY = (dispH - drawH)/2;

    for(const op of annoOps){
      tctx.save();
      tctx.globalAlpha = (op.type === "highlight") ? 0.22 : 1.0;
      tctx.fillStyle = op.color || "#ff7a3c";
      tctx.strokeStyle = op.color || "#ff7a3c";
      tctx.lineWidth = op.size || 4;
      if(op.type === "rect" || op.type === "highlight" || op.type === "blur"){
        const r = op.coords; // display coords relative to previewArea
        const imgX = Math.round((r[0] - offsetX) / s);
        const imgY = Math.round((r[1] - offsetY) / s);
        const imgW = Math.round(r[2] / s);
        const imgH = Math.round(r[3] / s);
        if(op.type === "blur"){
          // blur region on tmp (image-space)
          try{ blurRegionOnCanvas(tctx, { x: imgX, y: imgY, width: imgW, height: imgH }, 8); }catch(e){}
        } else if(op.type === "highlight"){
          tctx.fillRect(imgX, imgY, imgW, imgH);
        } else {
          tctx.strokeRect(imgX, imgY, imgW, imgH);
        }
      } else if(op.type === "arrow"){
        const [x1,y1,x2,y2] = op.coords;
        // convert each point
        const ix1 = (x1 - offsetX)/s, iy1 = (y1 - offsetY)/s, ix2 = (x2 - offsetX)/s, iy2 = (y2 - offsetY)/s;
        tctx.beginPath();
        tctx.moveTo(ix1, iy1);
        tctx.lineTo(ix2, iy2);
        tctx.stroke();
        // arrowhead
        const angle = Math.atan2(iy2-iy1, ix2-ix1);
        const headLen = Math.max(8, op.size*2);
        tctx.beginPath();
        tctx.moveTo(ix2, iy2);
        tctx.lineTo(ix2 - headLen*Math.cos(angle - Math.PI/6), iy2 - headLen*Math.sin(angle - Math.PI/6));
        tctx.lineTo(ix2 - headLen*Math.cos(angle + Math.PI/6), iy2 - headLen*Math.sin(angle + Math.PI/6));
        tctx.closePath();
        tctx.fill();
      } else if(op.type === "text"){
        const x = (op.x - offsetX)/s, y = (op.y - offsetY)/s;
        tctx.font = `${Math.max(12, op.size*3)}px Inter, Arial`;
        tctx.fillStyle = op.color || "#ff7a3c";
        tctx.fillText(op.text || "", x, y);
      }
      tctx.restore();
    }

    // Replace enhanceCanvas with merged tmp content
    enhanceCanvas.width = tmp.width;
    enhanceCanvas.height = tmp.height;
    enhanceCtx.setTransform(1,0,0,1,0,0);
    enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
    enhanceCtx.drawImage(tmp, 0, 0);

    // update afterImg preview and clear annotation stack
    const q = enhQuality ? (parseInt(enhQuality.value) || 92)/100 : 0.92;
    const outUrl = enhanceCanvas.toDataURL("image/jpeg", q);
    afterImg.src = outUrl;
    annoOps.length = 0;
    redrawAnnoOps();
    if(enhStatus) enhStatus.textContent = "Annotations applied to image.";
    downloadDataUrl(outUrl, `enhanced_annotated_${currentEnhFile ? currentEnhFile.name.replace(/\.[^/.]+$/,"") : Date.now()}.jpg`);
  });
}

/* ================
   Annotation drawing events (on annoCanvas)
   ================ */
function getMousePosOnCanvas(evt){
  const rect = previewArea.getBoundingClientRect();
  const x = evt.clientX - rect.left;
  const y = evt.clientY - rect.top;
  return { x, y };
}

if(annoCanvas){
  // pointer down
  annoCanvas.addEventListener("pointerdown", e => {
    if(!annoTool) return;
    const p = getMousePosOnCanvas(e);
    drawing = true;
    startX = p.x; startY = p.y;

    // Text tool: prompt immediately
    if(annoTool === "text"){
      const text = prompt("Enter text label:");
      if(text){
        const size = parseInt(annSize?.value || 14);
        const color = annColor?.value || "#ff7a3c";
        // place at clicked point
        const op = { type:"text", text, x: p.x, y: p.y, color, size };
        annoOps.push(op);
        redrawAnnoOps();
      }
      drawing = false;
      // do not keep tool active (optional)
      // document.querySelectorAll(".anno-btn").forEach(x=>x.classList.remove("active"));
      // annoTool = null;
    } else {
      // start a temporary op
      // for blur tool, we will store type 'blur' but show as rect until applied
    }
  });

  annoCanvas.addEventListener("pointermove", e => {
    if(!drawing) return;
    if(!annoTool) return;
    const p = getMousePosOnCanvas(e);
    const color = annColor?.value || "#ff7a3c";
    const size = parseInt(annSize?.value || 4);

    // construct op preview but don't push final until pointerup
    const dx = p.x - startX;
    const dy = p.y - startY;

    // preview: draw on top (redraw all ops + current preview)
    redrawAnnoOps();
    // draw current preview
    const previewOp = { type: annoTool, coords: null, color, size };
    if(annoTool === "rect" || annoTool === "highlight" || annoTool === "blur"){
      const r = [ startX, startY, dx, dy ];
      // normalize width/height to positive and keep origin as top-left
      const x = dx < 0 ? startX + dx : startX;
      const y = dy < 0 ? startY + dy : startY;
      const w = Math.abs(dx); const h = Math.abs(dy);
      previewOp.coords = [x, y, w, h];
      drawOpOnCtx(annoCtx, previewOp);
    } else if(annoTool === "arrow"){
      previewOp.coords = [ startX, startY, p.x, p.y ];
      drawOpOnCtx(annoCtx, previewOp);
    }
  });

  annoCanvas.addEventListener("pointerup", e => {
    if(!drawing) return;
    drawing = false;
    const p = getMousePosOnCanvas(e);
    const color = annColor?.value || "#ff7a3c";
    const size = parseInt(annSize?.value || 4);

    const dx = p.x - startX;
    const dy = p.y - startY;

    if(annoTool === "rect" || annoTool === "highlight" || annoTool === "blur"){
      const x = dx < 0 ? startX + dx : startX;
      const y = dy < 0 ? startY + dy : startY;
      const w = Math.abs(dx); const h = Math.abs(dy);
      if(w < 6 || h < 6) { redrawAnnoOps(); return; } // ignore tiny
      const op = { type: annoTool, coords: [x,y,w,h], color, size };
      annoOps.push(op);
      // if blur tool used, also store hideRectEnh (image-space) for privacy blur (apply on Enhance)
      if(annoTool === "blur"){
        hideRectEnh = displayRectToImage(x, y, w, h);
        // give user feedback
        if(enhStatus) enhStatus.textContent = `Hide region set (${hideRectEnh.x}x${hideRectEnh.y} | ${hideRectEnh.width}×${hideRectEnh.height})`;
      }
    } else if(annoTool === "arrow"){
      const op = { type: "arrow", coords: [startX, startY, p.x, p.y], color, size };
      annoOps.push(op);
    }
    redrawAnnoOps();
  });

  // ensure canvas resizes when window resizes
  window.addEventListener("resize", () => {
    setTimeout(()=>{ fitAnnoCanvasToPreview(); }, 60);
  });
}

/* when hideAreaBtn clicked, simply activate blur tool and show toolbar */
if(hideAreaBtn){
  hideAreaBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){ alert("Upload an image first!"); return; }
    if(annoToolbar) annoToolbar.style.display = "block";
    // activate blur tool button visually
    document.querySelectorAll(".anno-btn").forEach(x=>{
      x.classList.toggle("active", x.getAttribute("data-tool")==="blur");
      if(x.getAttribute("data-tool")==="blur") annoTool = "blur";
    });
    // show helpful message
    if(enhStatus) enhStatus.textContent = "Draw a rectangle on the preview to define blur/hide area.";
    fitAnnoCanvasToPreview();
  });
}

/* When an image is loaded into preview (beforeImg/afterImg changed), ensure anno canvas positions */
const observer = new ResizeObserver(()=> fitAnnoCanvasToPreview());
if(previewArea) observer.observe(previewArea);

/* ============================
   Utility: download dataURL
   ============================ */
function downloadDataUrl(dataUrl, filename){
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

/* ============================
   Small helper: preview update on afterImg load
   ============================ */
if(afterImg){
  afterImg.addEventListener("load", () => {
    // show toolbar if enhanceCanvas present
    const has = enhanceCanvas && enhanceCanvas.width>0;
    showAnnoToolbar(has);
    fitAnnoCanvasToPreview();
    redrawAnnoOps();
  });
}

/* ============================
   Init: set up basic bindings
   ============================ */

// make sure previewArea visible toggle when an enhance image exists
showAnnoToolbar(false);

// ensure annotation toolbar color & size exist
if(annColor) annColor.value = "#ff7a3c";
if(annSize) annSize.value = 4;

// ensure preview area pointer-events allow canvas drawing
if(previewArea && annoCanvas){
  // ensure annoCanvas sits on top and covers preview area; style already inline
  // but make sure pointer events are enabled when toolbar visible
  // we will toggle pointer-events based on toolbar visibility
  const observer2 = new MutationObserver(()=> {
    // noop for now
  });
  observer2.observe(annoToolbar || document.body, { attributes:true, subtree:false });
}

/* ============
   Small fixes:
   - Prevent accidental text selection while drawing
   ============ */
document.addEventListener("mousedown", e => {
  if(annoCanvas && e.target === annoCanvas) e.preventDefault();
});

/* ============
   Final: small utilities / safety
   ============ */

// if user closes modals on overlay click
document.querySelectorAll(".modal").forEach(mod=>{
  mod.addEventListener("click", (e)=>{
    if(e.target === mod) mod.style.display = "none";
  });
});

// Close buttons for About & Theme handled earlier; ensure hide when Escape pressed
document.addEventListener("keydown", (e)=>{
  if(e.key === "Escape"){
    document.querySelectorAll(".modal").forEach(m => { if(m) m.style.display = "none"; });
  }
});

/* ============
   End of script
   ============ */


