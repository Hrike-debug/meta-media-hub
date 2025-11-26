/* ==========================================================
   Meta Media Hub - script_v.js
   Full client-side logic:
   - Auth / Sections
   - Theme modal (T2)
   - Image Resizer (scan + UI plumbing)
   - AI Enhancer (Upscale, Sharpen-Pro, Denoise, HDR, OCR)
   - Privacy Blur (programmatic only – no drawing)
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

const savedTheme = localStorage.getItem(THEME_SAVE_KEY) || "flaming-orange";
applyThemeClass(savedTheme);

/* ====================
   NAVIGATION
   ==================== */
const btnImage = $("btnImage");
const btnEnhancer = $("btnEnhancer");
const backHomeFromImage = $("backHomeFromImage");
const backHomeFromEnhancer = $("backHomeFromEnhancer");

if(btnImage) btnImage.addEventListener("click", ()=> showSection("resize"));
if(btnEnhancer) btnEnhancer.addEventListener("click", ()=> showSection("enhance"));
if(backHomeFromImage) backHomeFromImage.addEventListener("click", ()=> showSection("home"));
if(backHomeFromEnhancer) backHomeFromEnhancer.addEventListener("click", ()=> showSection("home"));

/* =========================
   IMAGE RESIZER (scan)
   ========================= */

let imageFiles = [];
let imageDetectionMap = {};
let cocoModel = null;

/* (unchanged resizer logic continues exactly as before) */
/* ... NO CHANGES IN THIS SECTION ... */

/* ============================
   AI ENHANCER SECTION
   ============================ */

let enhanceFiles = [];
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx = enhanceCanvas.getContext("2d");
let currentEnhFile = null;

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

// Privacy blur state only (no drawing now)
let hideRectEnh = null;
let imageNaturalW = 0, imageNaturalH = 0;

/* ===========================
   IMAGE PROCESSING FUNCTIONS
   =========================== */
/* (ALL YOUR EXISTING PROCESSING FUNCTIONS REMAIN UNCHANGED) */

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

    let workCanvas = document.createElement("canvas");
    workCanvas.width = enhanceCanvas.width;
    workCanvas.height = enhanceCanvas.height;
    const wctx = workCanvas.getContext("2d");
    wctx.drawImage(enhanceCanvas, 0, 0);

    if(enhUpscale4x && enhUpscale4x.checked){
      workCanvas = upscaleCanvas(workCanvas, 4);
    } else if(enhUpscale2x && enhUpscale2x.checked){
      workCanvas = upscaleCanvas(workCanvas, 2);
    }

    const wctx2 = workCanvas.getContext("2d");
    let id = wctx2.getImageData(0,0,workCanvas.width, workCanvas.height);

    if(enhDenoise && enhDenoise.checked){
      id = applyDenoise(id);
    }

    if(enhFaceEnhance && enhFaceEnhance.checked){
      id = applySharpen(id, 0.9);
    }

    if(enhOCR && enhOCR.checked){
      id = applyOCRBoost(id);
    }

    if(enhHDR && enhHDR.checked){
      id = applyHDRToneMap(id);
    }

    if(!(enhFaceEnhance && enhFaceEnhance.checked)){
      id = applySharpen(id, 0.6);
    }

    wctx2.putImageData(id, 0, 0);

    if(enhHide && enhHide.checked && hideRectEnh){
      const factor = workCanvas.width / enhanceCanvas.width;
      const box = {
        x: Math.round(hideRectEnh.x * factor),
        y: Math.round(hideRectEnh.y * factor),
        width: Math.round(hideRectEnh.width * factor),
        height: Math.round(hideRectEnh.height * factor)
      };
      blurRegionOnCanvas(wctx2, box, 8);
    }

    const q = enhQuality ? (parseInt(enhQuality.value) || 92)/100 : 0.92;
    const outDataUrl = workCanvas.toDataURL("image/jpeg", q);

    enhanceCanvas.width = workCanvas.width;
    enhanceCanvas.height = workCanvas.height;
    enhanceCtx.setTransform(1,0,0,1,0,0);
    enhanceCtx.clearRect(0,0,enhanceCanvas.width, enhanceCanvas.height);
    enhanceCtx.drawImage(workCanvas, 0, 0);

    afterImg.src = outDataUrl;

    if(enhStatus) enhStatus.textContent = "Enhancement complete. Download will start.";

    downloadDataUrl(outDataUrl, `enhanced_${currentEnhFile ? currentEnhFile.name.replace(/\.[^/.]+$/,"") : Date.now()}.jpg`);
  });
}

if(enhPreviewBtn){
  enhPreviewBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){ alert("Upload an image first!"); return; }
    const url = enhanceCanvas.toDataURL("image/jpeg", (parseInt(enhQuality?.value||92)/100));
    const w = window.open("");
    if(!w) { alert("Popup blocked — allow popups to preview."); return; }
    const html = `<title>Preview</title><img src="${url}" style="max-width:100%;height:auto;display:block;margin:0 auto;">`;
    w.document.write(html);
    w.document.close();
  });
}

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
   End of script
   ============================ */
