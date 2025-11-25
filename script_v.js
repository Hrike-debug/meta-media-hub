/* ==========================================================
   Meta Media Hub - script_v.js (SAFE & SYNCED)
   Image Resizer + AI Enhancer + Object Hide Blur
   All processing is client-side only.
========================================================== */

const $ = id => document.getElementById(id);

/* ---------------------------
   AUTH SYSTEM
---------------------------- */
const pwModal   = $("pwModal");
const pwInput   = $("pwInput");
const pwBtn     = $("pwBtn");
const pwMsg     = $("pwMsg");
const statusText= $("statusText");

const AUTH_KEY  = "mm_auth_v3";
const PASSWORD  = "Meta@123";

function saveAuth(v){
  if(v) localStorage.setItem(AUTH_KEY,"true");
  else  localStorage.removeItem(AUTH_KEY);
}
function isAuthed(){
  return localStorage.getItem(AUTH_KEY) === "true";
}

function showSection(name){
  const home          = $("home");
  const imageSection  = $("imageSection");
  const enhancerSection = $("enhancerSection");

  if(home)           home.style.display          = name==="home"   ? "flex" : "none";
  if(imageSection)   imageSection.style.display  = name==="resize" ? "block": "none";
  if(enhancerSection)enhancerSection.style.display = name==="enhance"? "block": "none";
}

function unlock(){
  if(!pwInput || !pwModal || !statusText || !pwMsg) return;
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    pwModal.style.display = "none";
    statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}

if(pwBtn)   pwBtn.addEventListener("click", unlock);
if(pwInput) pwInput.addEventListener("keydown", e => { if(e.key==="Enter") unlock(); });

if(isAuthed() && pwModal && statusText){
  pwModal.style.display = "none";
  statusText.textContent = "Unlocked";
  showSection("home");
}

/* ---------------------------
   THEME SWITCHER
---------------------------- */
const themeToggle = $("themeToggle");
const THEME_KEY   = "ui_theme";

function applyTheme(t){
  if(t === "light") document.documentElement.classList.add("theme-light");
  else              document.documentElement.classList.remove("theme-light");
  if(themeToggle) themeToggle.textContent = t==="light" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, t);
}

if(themeToggle){
  themeToggle.addEventListener("click", () => {
    const current = localStorage.getItem(THEME_KEY) || "dark";
    applyTheme(current === "dark" ? "light" : "dark");
  });
}
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

/* ---------------------------
   NAVIGATION
---------------------------- */
const btnImage            = $("btnImage");
const btnEnhancer         = $("btnEnhancer");
const backHomeFromImage   = $("backHomeFromImage");
const backHomeFromEnhancer= $("backHomeFromEnhancer");

if(btnImage)            btnImage.addEventListener("click", ()=>showSection("resize"));
if(btnEnhancer)         btnEnhancer.addEventListener("click", ()=>showSection("enhance"));
if(backHomeFromImage)   backHomeFromImage.addEventListener("click", ()=>showSection("home"));
if(backHomeFromEnhancer)backHomeFromEnhancer.addEventListener("click", ()=>showSection("home"));

/* ABOUT MODAL */
const aboutBtn   = $("aboutBtn");
const aboutModal = $("aboutModal");
const closeAbout = $("closeAbout");

if(aboutBtn && aboutModal) {
  aboutBtn.addEventListener("click", ()=> aboutModal.style.display="flex");
}
if(closeAbout && aboutModal) {
  closeAbout.addEventListener("click", ()=> aboutModal.style.display="none");
}

/* ==========================================================
   IMAGE RESIZER – basic scan + AI toggle 
   (Your existing resize/ZIP logic can be added on top)
========================================================== */

let imageFiles        = [];
let imageDetectionMap = {};
let cocoModel         = null;

const dropImage    = $("dropImage");
const imageInput   = $("imageInput");
const imageFileList= $("imageFileList");
const smartBanner  = $("smartBanner");
const bannerIcon   = $("bannerIcon");
const bannerText   = $("bannerText");
const imgStatus    = $("imgStatus");
const imgAiToggle  = $("imgAiToggle");

/* drag / click upload */
if(dropImage && imageInput){
  dropImage.addEventListener("click", ()=> imageInput.click());

  imageInput.addEventListener("change", async e=>{
    imageFiles = Array.from(e.target.files);
    await handleNewImages();
  });

  dropImage.addEventListener("dragover", e=>{
    e.preventDefault();
    dropImage.style.background = "#182028";
  });
  dropImage.addEventListener("dragleave", ()=>{
    dropImage.style.background = "";
  });
  dropImage.addEventListener("drop", async e=>{
    e.preventDefault();
    dropImage.style.background = "";
    imageFiles = Array.from(e.dataTransfer.files);
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
    if(st==="person"){ icon="👤"; text="Human found"; }
    if(st==="none"){  icon="❌"; text="No person"; }

    return `
      <div class="file-row">
        <span>${icon}</span>
        <div>
          <b>${i+1}. ${f.name}</b><br>
          <small>${text} — ${Math.round(f.size/1024)} KB</small>
        </div>
      </div>`;
  }).join("");
}

async function loadModel(){
  if(cocoModel) return cocoModel;
  if(imgStatus) imgStatus.textContent="Loading AI model…";
  cocoModel = await cocoSsd.load();
  if(imgStatus) imgStatus.textContent="Model ready";
  return cocoModel;
}

async function detectPerson(imgEl){
  try{
    await loadModel();
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

  if(smartBanner){
    smartBanner.style.display="flex";
  }
  if(bannerText) bannerText.textContent="Scanning images…";
  if(imgStatus)  imgStatus.textContent="Scanning images…";

  let found=0;

  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();

    const hasPerson = await detectPerson(img);
    imageDetectionMap[file.name] = hasPerson ? "person" : "none";
    if(hasPerson) found++;

    refreshImageList();
    URL.revokeObjectURL(url);
  }

  if(bannerIcon) bannerIcon.textContent = found ? "🟢" : "⚪";
  if(bannerText){
    bannerText.innerHTML = found
      ? `Smart Human Detection: found people in <b>${found}</b> of ${imageFiles.length} image(s).`
      : `Smart Human Detection: no people found.`;
  }
  if(imgAiToggle){
    imgAiToggle.classList.toggle("active", found>0);
  }
  if(imgStatus) imgStatus.textContent="Scan complete.";
}

/* Smart AI toggle text */
if(imgAiToggle){
  const labelOn  = imgAiToggle.querySelector(".label-on");
  const labelOff = imgAiToggle.querySelector(".label-off");

  function updateSwitchLabel(){
    const on = imgAiToggle.classList.contains("active");
    if(labelOn)  labelOn.style.display  = on ? "inline" : "none";
    if(labelOff) labelOff.style.display = on ? "none"  : "inline";
  }
  imgAiToggle.addEventListener("click", ()=>{
    imgAiToggle.classList.toggle("active");
    updateSwitchLabel();
  });
  updateSwitchLabel();
}

/* NOTE:
   Your full resize + preview + ZIP logic can sit below here.
   This section is only doing scan + AI toggle safely.
*/

/* ==========================================================
   AI IMAGE ENHANCER – OCR, HDR & OBJECT HIDE BLUR
========================================================== */

let enhanceFiles   = [];
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx    = enhanceCanvas.getContext("2d");
let hideRectEnh     = null;

const dropEnhance   = $("dropEnhance");
const enhanceInput  = $("enhanceInput");
const enhFileInfo   = $("enhFileInfo");
const enhQuality    = $("enhQuality");
const enhQualityVal = $("enhQualityVal");
const enhRunBtn     = $("enhRunBtn");
const enhPreviewBtn = $("enhPreviewBtn");
const enhOCR        = $("enhOCR");
const enhHDR        = $("enhHDR");
const enhHide       = $("enhHide");
const hideAreaBtn   = $("hideAreaBtn");
const hideModal     = $("hideModal");
const hidePreview   = $("hidePreview");
const hideCanvas    = $("hideCanvas");
const hideRect      = $("hideRect");
const closeHide     = $("closeHide");
const saveHide      = $("saveHide");
const clearHide     = $("clearHide");
const enhStatus     = $("enhStatus");

/* upload click/drag */
if(dropEnhance && enhanceInput){
  dropEnhance.addEventListener("click", ()=>enhanceInput.click());

  enhanceInput.addEventListener("change", async e=>{
    enhanceFiles = Array.from(e.target.files);
    if(!enhanceFiles.length) return;
    await loadEnhImage(enhanceFiles[0]);
  });
}

async function loadEnhImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();

  enhanceCanvas.width  = img.width;
  enhanceCanvas.height = img.height;
  enhanceCtx.drawImage(img,0,0);

  if(enhFileInfo) enhFileInfo.textContent = `${file.name} — ${img.width}×${img.height}px`;
  if(enhStatus)   enhStatus.textContent   = "Image loaded. Choose options and run.";
  hideRectEnh = null;

  URL.revokeObjectURL(url);
}

/* quality label */
if(enhQuality && enhQualityVal){
  enhQuality.addEventListener("input", ()=>{
    enhQualityVal.textContent = enhQuality.value + "%";
  });
}

/* RUN ENHANCE */
if(enhRunBtn){
  enhRunBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){
      alert("Upload an image first!");
      return;
    }
    let data = enhanceCtx.getImageData(0,0,enhanceCanvas.width,enhanceCanvas.height);

    if(enhOCR && enhOCR.checked) data = applyOCRBoost(data);
    if(enhHDR && enhHDR.checked) data = applyHDRToneMap(data);

    enhanceCtx.putImageData(data,0,0);

    if(enhHide && enhHide.checked && hideRectEnh){
      blurRegionOnCanvas(enhanceCtx, hideRectEnh);
    }

    const q = enhQuality ? (parseInt(enhQuality.value) || 92)/100 : 0.92;
    const outUrl = enhanceCanvas.toDataURL("image/jpeg", q);
    download(outUrl, "enhanced.jpg");
    if(enhStatus) enhStatus.textContent = "Enhancement complete. File downloaded.";
  });
}

/* PREVIEW ONLY */
if(enhPreviewBtn){
  enhPreviewBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){
      alert("Upload an image first!");
      return;
    }
    const outUrl = enhanceCanvas.toDataURL("image/jpeg", 0.92);
    window.open(outUrl, "_blank");
  });
}

/* -------------------------
   OCR BOOST (E)
-------------------------- */
function applyOCRBoost(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    const avg = (d[i]+d[i+1]+d[i+2])/3;
    const boost = avg > 128 ? 1.1 : 1.25;
    d[i]   = Math.min(255, d[i]*boost);
    d[i+1] = Math.min(255, d[i+1]*boost);
    d[i+2] = Math.min(255, d[i+2]*boost);
  }
  return imageData;
}

/* -------------------------
   HDR TONE MAP (F)
-------------------------- */
function applyHDRToneMap(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    d[i]   = toneChannel(d[i]);
    d[i+1] = toneChannel(d[i+1]);
    d[i+2] = toneChannel(d[i+2]);
  }
  return imageData;
}
function toneChannel(v){
  if(v < 100) return Math.min(255, v*1.25); // lift shadows
  if(v > 180) return v*0.85;                // compress highlights
  return v;
}

/* -------------------------
   OBJECT HIDE AREA (H)
-------------------------- */
let draggingHide = false;
let startHX = 0, startHY = 0;

if(hideAreaBtn && hideModal && hidePreview){
  hideAreaBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){
      alert("Upload an image first!");
      return;
    }
    hideModal.style.display="flex";
    hidePreview.src = enhanceCanvas.toDataURL("image/jpeg",0.92);
    if(hideRect){
      hideRect.style.display = hideRectEnh ? "block" : "none";
    }
  });
}

if(hideCanvas && hideRect){
  hideCanvas.addEventListener("mousedown", e=>{
    if(!(enhHide && enhHide.checked)) return;
    draggingHide = true;
    startHX = e.offsetX;
    startHY = e.offsetY;
    hideRectEnh = { x:startHX, y:startHY, width:0, height:0 };
    hideRect.style.display="block";
  });

  hideCanvas.addEventListener("mousemove", e=>{
    if(!draggingHide || !hideRectEnh) return;
    hideRectEnh.width  = e.offsetX - startHX;
    hideRectEnh.height = e.offsetY - startHY;
    hideRect.style.left   = hideRectEnh.x + "px";
    hideRect.style.top    = hideRectEnh.y + "px";
    hideRect.style.width  = hideRectEnh.width + "px";
    hideRect.style.height = hideRectEnh.height + "px";
  });

  document.addEventListener("mouseup", ()=> draggingHide=false);
}

if(closeHide && hideModal){
  closeHide.addEventListener("click", ()=>{
    hideModal.style.display="none";
  });
}
if(saveHide && hideModal){
  saveHide.addEventListener("click", ()=>{
    hideModal.style.display="none";
  });
}
if(clearHide && hideRect){
  clearHide.addEventListener("click", ()=>{
    hideRectEnh = null;
    hideRect.style.display="none";
  });
}

/* STRONG MULTI-PASS BLUR */
function blurRegionOnCanvas(ctx, box){
  if(!box) return;
  const {x,y,width,height} = box;
  if(width<=0 || height<=0) return;

  let region = ctx.getImageData(x,y,width,height);
  const passes = 7; // 🔥 increase this for more blur

  for(let i=0;i<passes;i++){
    region = gaussianBlur(region, width, height);
  }
  ctx.putImageData(region, x, y);
}

function gaussianBlur(imgData, w, h){
  const weights = [0.1201,0.2339,0.2920,0.2339,0.1201];
  const half    = 2;
  const d       = imgData.data;
  const tmp     = new Uint8ClampedArray(d);

  // horizontal only (fast blur)
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0;
      for(let k=-half;k<=half;k++){
        const px  = Math.min(w-1, Math.max(0, x+k));
        const idx = (y*w+px)*4;
        const wgt = weights[k+half];
        r += tmp[idx]   * wgt;
        g += tmp[idx+1] * wgt;
        b += tmp[idx+2] * wgt;
      }
      const id = (y*w+x)*4;
      d[id]   = r;
      d[id+1] = g;
      d[id+2] = b;
    }
  }
  return imgData;
}

/* simple downloader */
function download(url, name="image.jpg"){
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
}

/* ---------------------------
   DEFAULT VIEW
---------------------------- */
showSection("home");
