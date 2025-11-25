/* ==========================================================
   Meta Media Hub - script_v.js (v5)
   - Image Resizer (scan + AI toggle)
   - AI Enhancer: Upscale, Sharpen, Denoise, OCR, HDR
   - Object Hide with strong blur + preview
   All client-side, no uploads.
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

const AUTH_KEY  = "mm_auth_v5";
const PASSWORD  = "Meta@123";

function saveAuth(v){
  if(v) localStorage.setItem(AUTH_KEY,"true");
  else  localStorage.removeItem(AUTH_KEY);
}
function isAuthed(){
  return localStorage.getItem(AUTH_KEY) === "true";
}

function showSection(name){
  const home            = $("home");
  const imageSection    = $("imageSection");
  const enhancerSection = $("enhancerSection");

  [home, imageSection, enhancerSection].forEach(el=>{
    if(el){
      el.style.display = "none";
      el.classList.remove("active");
    }
  });

  if(name==="home" && home){
    home.style.display="flex";
    requestAnimationFrame(()=> home.classList.add("active"));
  }
  if(name==="resize" && imageSection){
    imageSection.style.display="block";
    requestAnimationFrame(()=> imageSection.classList.add("active"));
  }
  if(name==="enhance" && enhancerSection){
    enhancerSection.style.display="block";
    requestAnimationFrame(()=> enhancerSection.classList.add("active"));
  }
}

function unlock(){
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    pwModal.style.display = "none";
    statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}

pwBtn.addEventListener("click", unlock);
pwInput.addEventListener("keydown", e => { if(e.key==="Enter") unlock(); });

if(isAuthed()){
  pwModal.style.display="none";
  statusText.textContent="Unlocked";
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
  themeToggle.textContent = t==="light" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY, t);
}

themeToggle.addEventListener("click", () => {
  const current = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(current === "dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

/* ---------------------------
   NAVIGATION
---------------------------- */
$("btnImage").addEventListener("click", ()=>showSection("resize"));
$("btnEnhancer").addEventListener("click", ()=>showSection("enhance"));
$("backHomeFromImage").addEventListener("click", ()=>showSection("home"));
$("backHomeFromEnhancer").addEventListener("click", ()=>showSection("home"));

/* ABOUT MODAL */
$("aboutBtn").addEventListener("click",()=> $("aboutModal").style.display="flex");
$("closeAbout").addEventListener("click",()=> $("aboutModal").style.display="none");


/* ==========================================================
   IMAGE RESIZER – Smart Human Detection (scan only)
========================================================== */

let imageFiles        = [];
let imageDetectionMap = {};
let cocoModel         = null;

const dropImage     = $("dropImage");
const imageInput    = $("imageInput");
const imageFileList = $("imageFileList");
const smartBanner   = $("smartBanner");
const bannerIcon    = $("bannerIcon");
const bannerText    = $("bannerText");
const imgStatus     = $("imgStatus");
const imgAiToggle   = $("imgAiToggle");

dropImage.addEventListener("click", ()=> imageInput.click());
imageInput.addEventListener("change", async e=>{
  imageFiles = Array.from(e.target.files);
  await handleNewImages();
});

dropImage.addEventListener("dragover", e=>{
  e.preventDefault();
  dropImage.style.background = "rgba(255,255,255,0.05)";
});
dropImage.addEventListener("dragleave", ()=> dropImage.style.background = "");
dropImage.addEventListener("drop", async e=>{
  e.preventDefault();
  dropImage.style.background = "";
  imageFiles = Array.from(e.dataTransfer.files);
  await handleNewImages();
});

function refreshImageList(){
  if(!imageFiles.length){
    imageFileList.innerHTML="No files uploaded.";
    smartBanner.style.display="none";
    return;
  }

  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    const st = imageDetectionMap[f.name] || "unknown";
    let icon="⏳", msg="Scanning…";
    if(st==="person"){ icon="👤"; msg="Human detected"; }
    if(st==="none"){   icon="❌"; msg="No person"; }

    return `
      <div class="file-row">
        <span>${icon}</span>
        <div><b>${i+1}. ${f.name}</b><br><small>${msg} — ${Math.round(f.size/1024)} KB</small></div>
      </div>`;
  }).join("");
}

async function loadModel(){
  if(cocoModel) return cocoModel;
  imgStatus.textContent="Loading AI model…";
  cocoModel = await cocoSsd.load();
  imgStatus.textContent="Model ready";
  return cocoModel;
}

async function detectPerson(imgEl){
  await loadModel();
  const preds = await cocoModel.detect(imgEl);
  return preds.some(p => p.class === "person");
}

async function handleNewImages(){
  imageDetectionMap = {};
  imageFiles.forEach(f => imageDetectionMap[f.name]="unknown");

  smartBanner.style.display="flex";
  bannerIcon.textContent="⏳";
  bannerText.textContent="Scanning images…";
  imgStatus.textContent="Scanning…";

  refreshImageList();

  let found=0;
  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();

    const person = await detectPerson(img);
    imageDetectionMap[file.name] = person ? "person" : "none";
    if(person) found++;

    refreshImageList();
    URL.revokeObjectURL(url);
  }

  bannerIcon.textContent = found ? "🟢" : "⚪";
  bannerText.innerHTML = found
    ? `Smart Human Detection:<br>People detected in <b>${found}</b> of ${imageFiles.length} image(s).`
    : `Smart Human Detection:<br>No people detected.`;

  imgAiToggle.classList.toggle("active", found>0);
  imgStatus.textContent="Scan complete.";
}

// Smart toggle labels
(function(){
  const labelOn  = imgAiToggle.querySelector(".label-on");
  const labelOff = imgAiToggle.querySelector(".label-off");
  function update(){
    const on = imgAiToggle.classList.contains("active");
    labelOn.style.display  = on ? "inline" : "none";
    labelOff.style.display = on ? "none"  : "inline";
  }
  imgAiToggle.addEventListener("click",()=>{
    imgAiToggle.classList.toggle("active");
    update();
  });
  update();
})();


/* ==========================================================
   AI IMAGE ENHANCER – UPSCALE-AI + SHARPEN + BLUR
========================================================== */

let enhanceFiles    = [];
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx    = enhanceCanvas.getContext("2d");
let baseImageData   = null;
let baseWidth       = 0;
let baseHeight      = 0;

// hide region stored as RELATIVE coords
let hideRectPx  = null;   // current drawn rect in modal (pixels)
let hideRectRel = null;   // normalized {xRel,yRel,wRel,hRel}

const dropEnhance   = $("dropEnhance");
const enhanceInput  = $("enhanceInput");
const enhFileInfo   = $("enhFileInfo");
const enhQuality    = $("enhQuality");
const enhQualityVal = $("enhQualityVal");
const enhRunBtn     = $("enhRunBtn");
const enhPreviewBtn = $("enhPreviewBtn");
const enhUpscale2   = $("enhUpscale2x");
const enhUpscale4   = $("enhUpscale4x");
const enhFaceEnh    = $("enhFaceEnhance");
const enhDenoise    = $("enhDenoise");
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


dropEnhance.addEventListener("click", ()=> enhanceInput.click());

enhanceInput.addEventListener("change", async e=>{
  enhanceFiles = Array.from(e.target.files);
  if(!enhanceFiles.length) return;
  await loadEnhImage(enhanceFiles[0]);
});

async function loadEnhImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();

  baseWidth  = img.width;
  baseHeight = img.height;

  enhanceCanvas.width  = baseWidth;
  enhanceCanvas.height = baseHeight;
  enhanceCtx.drawImage(img,0,0);

  baseImageData = enhanceCtx.getImageData(0,0,baseWidth,baseHeight);

  enhFileInfo.textContent = `${file.name} — ${baseWidth}×${baseHeight}px`;
  enhStatus.textContent   = "Image loaded. Choose enhancements and run.";

  hideRectRel = null;
  hideRectPx  = null;

  URL.revokeObjectURL(url);
}

enhQuality.addEventListener("input",()=>{
  enhQualityVal.textContent = enhQuality.value + "%";
});

/* ---------------------------
   ENHANCE PIPELINE
---------------------------- */
enhRunBtn.addEventListener("click", ()=>{
  if(!baseImageData){
    alert("Upload an image first!");
    return;
  }

  // 1) START from original each time
  let workCanvas = document.createElement("canvas");
  workCanvas.width  = baseWidth;
  workCanvas.height = baseHeight;
  let workCtx = workCanvas.getContext("2d");
  workCtx.putImageData(baseImageData,0,0);

  let imgData = workCtx.getImageData(0,0,baseWidth,baseHeight);

  // 2) AI-ish filters (order: denoise → OCR → HDR → sharpen)
  if(enhDenoise.checked){
    imgData = applyDenoise3x3(imgData);
  }
  if(enhOCR.checked){
    imgData = applyOCRBoost(imgData);
  }
  if(enhHDR.checked){
    imgData = applyHDRToneMap(imgData);
  }
  if(enhFaceEnh.checked){
    imgData = applyUnsharpMask(imgData, 0.7);  // SHARPEN-PRO
  }

  workCtx.putImageData(imgData,0,0);

  // 3) UPSCALE-AI (2x / 4x)
  let scale = 1;
  if(enhUpscale4.checked)      scale = 4;
  else if(enhUpscale2.checked) scale = 2;

  let finalCanvas = workCanvas;
  if(scale > 1){
    const upCanvas = document.createElement("canvas");
    upCanvas.width  = baseWidth  * scale;
    upCanvas.height = baseHeight * scale;
    const upCtx = upCanvas.getContext("2d");
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = "high";
    upCtx.drawImage(workCanvas,0,0,upCanvas.width,upCanvas.height);
    finalCanvas = upCanvas;
  }

  // 4) Copy to main enhanceCanvas
  enhanceCanvas.width  = finalCanvas.width;
  enhanceCanvas.height = finalCanvas.height;
  enhanceCtx.drawImage(finalCanvas,0,0);

  // 5) Apply blur region (Object Hide) using RELATIVE coords
  if(enhHide.checked && hideRectRel){
    const cw = enhanceCanvas.width;
    const ch = enhanceCanvas.height;
    const x  = Math.round(hideRectRel.xRel * cw);
    const y  = Math.round(hideRectRel.yRel * ch);
    const w  = Math.round(hideRectRel.wRel * cw);
    const h  = Math.round(hideRectRel.hRel * ch);

    blurRegionOnCanvas(enhanceCtx, {x, y, width:w, height:h});
  }

  // 6) Export
  const q = (parseInt(enhQuality.value) || 92) / 100;
  const outUrl = enhanceCanvas.toDataURL("image/jpeg", q);
  download(outUrl, "enhanced.jpg");
  enhStatus.textContent = "Enhancement complete. File downloaded.";
});

if(enhPreviewBtn){
  enhPreviewBtn.addEventListener("click", ()=>{
    if(!enhanceCanvas.width){
      alert("Upload an image first!");
      return;
    }

    // BEFORE
    const beforeUrl = enhanceCanvas.toDataURL("image/jpeg", 0.92);
    $("beforeImg").src = beforeUrl;

    // AFTER (temporary process preview copy)
    let previewData = enhanceCtx.getImageData(0,0,enhanceCanvas.width,enhanceCanvas.height);

    if(enhOCR.checked) previewData = applyOCRBoost(previewData);
    if(enhHDR.checked) previewData = applyHDRToneMap(previewData);
    enhanceCtx.putImageData(previewData,0,0);

    $("afterImg").src = enhanceCanvas.toDataURL("image/jpeg", 0.92);

    // Reset canvas to original
    loadEnhImage(enhanceFiles[0]);

    // OPEN MODAL
    const modal = $("previewModal");
    modal.style.display = "flex";
    modal.setAttribute("aria-hidden","false");

    // set slider to 50-50
    $("afterLayer").style.width = "50%";
    $("handle").style.left = "50%";
  });
}

$("closePreview").addEventListener("click", ()=>{
  $("previewModal").style.display = "none";
});



/* ---------------------------
   FILTERS
---------------------------- */

/* OCR BOOST (E) */
function applyOCRBoost(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    const avg = (d[i]+d[i+1]+d[i+2])/3;
    const boost = avg > 128 ? 1.1 : 1.25;
    d[i]   = Math.min(255, d[i]  * boost);
    d[i+1] = Math.min(255, d[i+1]* boost);
    d[i+2] = Math.min(255, d[i+2]* boost);
  }
  return imageData;
}

/* HDR Tone Map (F) */
function applyHDRToneMap(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    d[i]   = tone(d[i]);
    d[i+1] = tone(d[i+1]);
    d[i+2] = tone(d[i+2]);
  }
  return imageData;
}
function tone(v){
  if(v < 100) return Math.min(255, v * 1.25); // lift shadows
  if(v > 180) return v * 0.85;                // compress highlights
  return v;
}

/* DENOISE 3×3 (soft) */
function applyDenoise3x3(imageData){
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);

  const idx = (x,y)=> ((y*w + x) * 4);

  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0,count=0;
      for(let dy=-1;dy<=1;dy++){
        for(let dx=-1;dx<=1;dx++){
          const xx = Math.min(w-1, Math.max(0,x+dx));
          const yy = Math.min(h-1, Math.max(0,y+dy));
          const i  = idx(xx,yy);
          r += src[i];
          g += src[i+1];
          b += src[i+2];
          count++;
        }
      }
      const o = idx(x,y);
      out[o]   = r/count;
      out[o+1] = g/count;
      out[o+2] = b/count;
      out[o+3] = src[o+3];
    }
  }

  imageData.data.set(out);
  return imageData;
}

/* SHARPEN-PRO: Unsharp Mask */
function applyUnsharpMask(imageData, amount){
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const blur = applyDenoise3x3(new ImageData(new Uint8ClampedArray(src),w,h)).data;
  const out = new Uint8ClampedArray(src.length);

  for(let i=0;i<src.length;i+=4){
    const r = src[i],   g = src[i+1], b = src[i+2];
    const br= blur[i], bg= blur[i+1], bb= blur[i+2];

    const hr = r - br;
    const hg = g - bg;
    const hb = b - bb;

    out[i]   = Math.max(0, Math.min(255, r + amount*hr));
    out[i+1] = Math.max(0, Math.min(255, g + amount*hg));
    out[i+2] = Math.max(0, Math.min(255, b + amount*hb));
    out[i+3] = src[i+3];
  }

  imageData.data.set(out);
  return imageData;
}


/* ==========================================================
   OBJECT HIDE – blur region + preview
========================================================== */

hideAreaBtn.addEventListener("click", ()=>{
  if(!baseImageData){
    alert("Upload an image first!");
    return;
  }
  hideModal.style.display="flex";
  // base preview
  const tmpCanvas = document.createElement("canvas");
  tmpCanvas.width  = baseWidth;
  tmpCanvas.height = baseHeight;
  tmpCanvas.getContext("2d").putImageData(baseImageData,0,0);
  hidePreview.src = tmpCanvas.toDataURL("image/jpeg",0.9);

  // reset rect UI
  if(hideRectRel){
    // we'll draw based on rel once user starts dragging again
    hideRect.style.display = "none";
  } else {
    hideRect.style.display = "none";
  }
});

let draggingHide=false, startHX=0, startHY=0;

hideCanvas.addEventListener("mousedown", e=>{
  if(!enhHide.checked) return;
  draggingHide = true;
  const rect = hideCanvas.getBoundingClientRect();
  startHX = e.clientX - rect.left;
  startHY = e.clientY - rect.top;

  hideRectPx = { x:startHX, y:startHY, width:0, height:0 };
  hideRect.style.display="block";
});

hideCanvas.addEventListener("mousemove", e=>{
  if(!draggingHide || !hideRectPx) return;
  const rect = hideCanvas.getBoundingClientRect();
  const curX = e.clientX - rect.left;
  const curY = e.clientY - rect.top;

  hideRectPx.width  = curX - hideRectPx.x;
  hideRectPx.height = curY - hideRectPx.y;

  drawHideRectPx();
});

document.addEventListener("mouseup", ()=>{
  if(!draggingHide) return;
  draggingHide = false;
  updateHideRectRel();
  updateHidePreviewBlur();   // LIVE-ish blur preview in modal
});

function drawHideRectPx(){
  if(!hideRectPx) return;
  hideRect.style.left   = Math.min(hideRectPx.x, hideRectPx.x + hideRectPx.width) + "px";
  hideRect.style.top    = Math.min(hideRectPx.y, hideRectPx.y + hideRectPx.height) + "px";
  hideRect.style.width  = Math.abs(hideRectPx.width) + "px";
  hideRect.style.height = Math.abs(hideRectPx.height) + "px";
}

// convert pixel rect → relative (0–1) rect
function updateHideRectRel(){
  if(!hideRectPx) return;
  const cw = hideCanvas.clientWidth;
  const ch = hideCanvas.clientHeight;
  if(!cw || !ch) return;

  const x0 = Math.min(hideRectPx.x, hideRectPx.x + hideRectPx.width);
  const y0 = Math.min(hideRectPx.y, hideRectPx.y + hideRectPx.height);
  const w  = Math.abs(hideRectPx.width);
  const h  = Math.abs(hideRectPx.height);

  hideRectRel = {
    xRel: x0 / cw,
    yRel: y0 / ch,
    wRel: w  / cw,
    hRel: h  / ch
  };
}

// LIVE-ish preview blur inside hide modal
function updateHidePreviewBlur(){
  if(!hideRectRel || !baseImageData) return;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width  = baseWidth;
  tempCanvas.height = baseHeight;
  const tctx = tempCanvas.getContext("2d");
  tctx.putImageData(baseImageData,0,0);

  const bx = Math.round(hideRectRel.xRel * baseWidth);
  const by = Math.round(hideRectRel.yRel * baseHeight);
  const bw = Math.round(hideRectRel.wRel * baseWidth);
  const bh = Math.round(hideRectRel.hRel * baseHeight);

  blurRegionOnCanvas(tctx, {x:bx,y:by,width:bw,height:bh});

  hidePreview.src = tempCanvas.toDataURL("image/jpeg",0.9);
}

closeHide.addEventListener("click", ()=>{
  hideModal.style.display="none";
});

clearHide.addEventListener("click", ()=>{
  hideRectPx  = null;
  hideRectRel = null;
  hideRect.style.display="none";
  // reset preview to base
  if(baseImageData){
    const tmp = document.createElement("canvas");
    tmp.width=baseWidth; tmp.height=baseHeight;
    tmp.getContext("2d").putImageData(baseImageData,0,0);
    hidePreview.src = tmp.toDataURL("image/jpeg",0.9);
  }
});

saveHide.addEventListener("click", ()=>{
  // rect already saved in hideRectRel
  hideModal.style.display="none";
});


/* STRONG MULTI-PASS BLUR for hide region */
function blurRegionOnCanvas(ctx, box){
  if(!box) return;
  let {x,y,width,height} = box;
  if(width<=0 || height<=0) return;

  // normalize just in case negative width/height slipped in
  const x0 = Math.min(x, x+width);
  const y0 = Math.min(y, y+height);
  const w  = Math.abs(width);
  const h  = Math.abs(height);

  let region = ctx.getImageData(x0,y0,w,h);
  const passes = 7; // heavier blur

  for(let i=0;i<passes;i++){
    region = gaussianBlur(region, w, h);
  }
  ctx.putImageData(region,x0,y0);
}

function gaussianBlur(imgData,w,h){
  const weights=[0.1201,0.2339,0.2920,0.2339,0.1201];
  const half=2;
  const src=imgData.data;
  const tmp = new Uint8ClampedArray(src);

  // horizontal blur
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0;
      for(let k=-half;k<=half;k++){
        const px = Math.min(w-1, Math.max(0,x+k));
        const idx=(y*w+px)*4;
        const wgt=weights[k+half];
        r += tmp[idx]   * wgt;
        g += tmp[idx+1] * wgt;
        b += tmp[idx+2] * wgt;
      }
      const id=(y*w+x)*4;
      src[id]   = r;
      src[id+1] = g;
      src[id+2] = b;
    }
  }
  return imgData;
}


/* ---------------------------
   UTILS
---------------------------- */
function download(url,name){
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  a.click();
}

/* Default view after unlock is handled above */

