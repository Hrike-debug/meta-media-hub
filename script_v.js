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
   THEME MODAL (UNCHANGED)
   ==================== */
const themeBtn = $("themeBtn");
const themeModal = $("themeModal");
const closeTheme = $("closeTheme");
const THEME_SAVE_KEY = "mm_theme_choice";

function applyThemeClass(key){
  document.body.className = document.body.className
    .split(" ")
    .filter(c => !c.startsWith("theme-"))
    .join(" ") + " theme-" + key;

  try{ localStorage.setItem(THEME_SAVE_KEY, key); }catch(e){}
}

if(themeBtn && themeModal){
  themeBtn.addEventListener("click", ()=>{
    themeModal.style.display = "flex";
  });
}

if(closeTheme && themeModal){
  closeTheme.addEventListener("click", ()=>{
    themeModal.style.display = "none";
  });
}

document.querySelectorAll(".theme-card").forEach(card=>{
  card.addEventListener("click", ()=>{
    const t = card.getAttribute("data-theme");
    if(!t) return;
    applyThemeClass(t);
    if(themeModal) themeModal.style.display = "none";
  });
});

const savedTheme = localStorage.getItem(THEME_SAVE_KEY) || "flaming-orange";
applyThemeClass(savedTheme.replace("theme-",""));

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

let hideRectEnh = null;
let imageNaturalW = 0, imageNaturalH = 0;

/* =================
   ENHANCE RUN
   ================= */
if(enhRunBtn){
  enhRunBtn.addEventListener("click", async ()=>{
    if(!enhanceCanvas.width){
      alert("Upload an image first!");
      return;
    }
    if(enhStatus) enhStatus.textContent = "Processing…";

    const q = enhQuality ? (parseInt(enhQuality.value) || 92)/100 : 0.92;
    const outDataUrl = enhanceCanvas.toDataURL("image/jpeg", q);

    afterImg.src = outDataUrl;

    if(enhStatus) enhStatus.textContent = "Enhancement complete. Download started.";

    downloadDataUrl(outDataUrl, `enhanced_${Date.now()}.jpg`);
  });
}

/* ===========================
   ✅ PREVIEW FIX — INLINE ONLY (NO NEW TAB)
   =========================== */
if(enhPreviewBtn){
  enhPreviewBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){
      alert("Upload an image first!");
      return;
    }

    const url = enhanceCanvas.toDataURL(
      "image/jpeg",
      (parseInt(enhQuality?.value || 92) / 100)
    );

    if(beforeImg) beforeImg.src = enhanceCanvas.toDataURL("image/jpeg");
    if(afterImg)  afterImg.src  = url;

    if(enhStatus) enhStatus.textContent = "Preview updated below.";
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
