/* ==========================================================
   Meta Media Hub - script_v.js (v1.7)
   - Auth + Theme + Navigation
   - Image Resizer scan (human detection)
   - AI Enhancer: Upscale-lite, Denoise, OCR, HDR, Sharpen
   - Object Hide Blur (relative + works after upscale)
   - Annotation toolbar (rect / arrow / text) floating style
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

const AUTH_KEY  = "mm_auth_v7";
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
   (Resizer crop/ZIP logic can be plugged below later)
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
   AI IMAGE ENHANCER – upscale-lite + OCR + HDR + blur
========================================================== */

let enhanceFiles    = [];
const enhanceCanvas = document.createElement("canvas");
const enhanceCtx    = enhanceCanvas.getContext("2d");
let baseImageData   = null;
let baseWidth       = 0;
let baseHeight      = 0;

// hide region stored as relative coords (0–1)
let hideRectRel = null;

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
const enhProgress   = $("enhProgress");

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
  enhProgress.style.width = "0%";

  URL.revokeObjectURL(url);
}

enhQuality.addEventListener("input",()=>{
  enhQualityVal.textContent = enhQuality.value + "%";
});

/* Build the enhanced version into a new canvas (not touching main yet) */
function buildEnhancedCanvas(){
  if(!baseImageData) return null;

  const workCanvas = document.createElement("canvas");
  workCanvas.width  = baseWidth;
  workCanvas.height = baseHeight;
  const workCtx = workCanvas.getContext("2d");
  workCtx.putImageData(baseImageData,0,0);

  let data = workCtx.getImageData(0,0,baseWidth,baseHeight);

  // Denoise → OCR → HDR → Sharpen
  if(enhDenoise.checked){
    data = applyDenoise3x3(data);
  }
  if(enhOCR.checked){
    data = applyOCRBoost(data);
  }
  if(enhHDR.checked){
    data = applyHDRToneMap(data);
  }
  if(enhFaceEnh.checked){
    data = applyUnsharpMask(data, 0.7);
  }

  workCtx.putImageData(data,0,0);

  // UPSCALE-LITE
  let scale = 1;
  if(enhUpscale4.checked)      scale = 4;
  else if(enhUpscale2.checked) scale = 2;

  let finalCanvas = workCanvas;
  if(scale > 1){
    const upCanvas = document.createElement("canvas");
    upCanvas.width  = baseWidth * scale;
    upCanvas.height = baseHeight * scale;
    const upCtx = upCanvas.getContext("2d");
    upCtx.imageSmoothingEnabled = true;
    upCtx.imageSmoothingQuality = "high";
    upCtx.drawImage(workCanvas,0,0,upCanvas.width, upCanvas.height);

    // slight sharpen after upscale
    const upData = upCtx.getImageData(0,0,upCanvas.width,upCanvas.height);
    const sharp  = applyUnsharpMask(upData, 0.4);
    upCtx.putImageData(sharp,0,0);

    finalCanvas = upCanvas;
  }

  // apply blur region if set
  if(enhHide.checked && hideRectRel){
    const cw = finalCanvas.width;
    const ch = finalCanvas.height;
    const bx = Math.round(hideRectRel.xRel * cw);
    const by = Math.round(hideRectRel.yRel * ch);
    const bw = Math.round(hideRectRel.wRel * cw);
    const bh = Math.round(hideRectRel.hRel * ch);
    const ctx = finalCanvas.getContext("2d");
    blurRegionOnCanvas(ctx, {x:bx,y:by,width:bw,height:bh});
  }

  return finalCanvas;
}

/* PREVIEW → before/after slider modal */
enhPreviewBtn.addEventListener("click", ()=>{
  if(!baseImageData){
    alert("Upload an image first!");
    return;
  }
  const finalCanvas = buildEnhancedCanvas();
  if(!finalCanvas){
    alert("Could not build enhanced preview.");
    return;
  }

  // BEFORE
  const tmpBefore = document.createElement("canvas");
  tmpBefore.width  = baseWidth;
  tmpBefore.height = baseHeight;
  tmpBefore.getContext("2d").putImageData(baseImageData,0,0);
  $("beforeImg").src = tmpBefore.toDataURL("image/jpeg",0.9);

  // AFTER
  $("afterImg").src = finalCanvas.toDataURL("image/jpeg",0.9);

  $("previewTitle").textContent = "AI Enhancement Preview";
  $("previewInfo").textContent  = `${finalCanvas.width}×${finalCanvas.height} (after processing)`;

  const modal = $("previewModal");
  modal.style.display="flex";
  modal.setAttribute("aria-hidden","false");
  $("afterLayer").style.width = "50%";
  $("handle").style.left = "50%";
});

/* Close preview modal */
$("closePreview").addEventListener("click", ()=>{
  const modal = $("previewModal");
  modal.style.display="none";
  modal.setAttribute("aria-hidden","true");
});

/* slider drag */
(function(){
  const wrap = $("previewArea");
  const handle = $("handle");
  const afterLayer = $("afterLayer");
  let dragging = false;

  function setPct(p){
    p = Math.max(0, Math.min(100,p));
    afterLayer.style.width = p + "%";
    handle.style.left      = p + "%";
  }

  handle.addEventListener("mousedown", ()=>{
    dragging = true;
    document.body.style.cursor = "ew-resize";
  });
  document.addEventListener("mouseup", ()=>{
    dragging = false;
    document.body.style.cursor = "";
  });
  document.addEventListener("mousemove", e=>{
    if(!dragging) return;
    const rect = wrap.getBoundingClientRect();
    const pct  = ((e.clientX - rect.left) / rect.width) * 100;
    setPct(pct);
  });
})();

/* RUN ENHANCE & DOWNLOAD + send to annotation */
enhRunBtn.addEventListener("click", ()=>{
  if(!baseImageData){
    alert("Upload an image first!");
    return;
  }
  const finalCanvas = buildEnhancedCanvas();
  if(!finalCanvas){
    alert("Could not build enhanced image.");
    return;
  }

  enhProgress.style.width = "90%";
  enhanceCanvas.width  = finalCanvas.width;
  enhanceCanvas.height = finalCanvas.height;
  enhanceCtx.drawImage(finalCanvas,0,0);

  const q = (parseInt(enhQuality.value) || 92)/100;
  const outUrl = enhanceCanvas.toDataURL("image/jpeg", q);
  download(outUrl, "enhanced.jpg");
  enhStatus.textContent="Enhancement complete. File downloaded.";
  enhProgress.style.width = "100%";

  // push to annotation view
  initAnnotFromEnhance();
});

/* ---------------------------
   FILTERS
---------------------------- */

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
  if(v < 100) return Math.min(255, v * 1.25);
  if(v > 180) return v * 0.85;
  return v;
}

/* Soft denoise 3x3 */
function applyDenoise3x3(imageData){
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const out = new Uint8ClampedArray(src.length);
  const idx = (x,y)=> ((y*w + x)*4);

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

/* Unsharp mask */
function applyUnsharpMask(imageData, amount){
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const blurData = new ImageData(new Uint8ClampedArray(src), w, h);
  applyDenoise3x3(blurData);
  const blur = blurData.data;
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

/* STRONG BLUR REGION (object hide) */

function blurRegionOnCanvas(ctx, box){
  if(!box) return;
  let {x,y,width,height} = box;
  if(width<=0 || height<=0) return;

  const x0 = Math.min(x, x+width);
  const y0 = Math.min(y, y+height);
  const w  = Math.abs(width);
  const h  = Math.abs(height);

  let region = ctx.getImageData(x0,y0,w,h);
  const passes = 7;

  for(let i=0;i<passes;i++){
    region = gaussianBlur(region,w,h);
  }
  ctx.putImageData(region,x0,y0);
}

function gaussianBlur(imgData,w,h){
  const weights=[0.1201,0.2339,0.2920,0.2339,0.1201];
  const half=2;
  const src=imgData.data;
  const tmp = new Uint8ClampedArray(src);

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

/* --------------------------------------------------
   OBJECT HIDE – Modal to select area (relative coords)
-------------------------------------------------- */

hideAreaBtn.addEventListener("click", ()=>{
  if(!baseImageData){
    alert("Upload an image first!");
    return;
  }
  hideModal.style.display="flex";

  const tmp = document.createElement("canvas");
  tmp.width  = baseWidth;
  tmp.height = baseHeight;
  tmp.getContext("2d").putImageData(baseImageData,0,0);
  hidePreview.src = tmp.toDataURL("image/jpeg",0.9);
  hideRect.style.display="none";
});

let draggingHide=false, startHX=0, startHY=0;
let hideRectPx = null;

hideCanvas.addEventListener("mousedown", e=>{
  if(!enhHide.checked) return;
  draggingHide = true;
  const rect = hideCanvas.getBoundingClientRect();
  startHX = e.clientX - rect.left;
  startHY = e.clientY - rect.top;
  hideRectPx = {x:startHX,y:startHY,width:0,height:0};
  hideRect.style.display="block";
});

hideCanvas.addEventListener("mousemove", e=>{
  if(!draggingHide || !hideRectPx) return;
  const rect = hideCanvas.getBoundingClientRect();
  const curX = e.clientX - rect.left;
  const curY = e.clientY - rect.top;
  hideRectPx.width  = curX - hideRectPx.x;
  hideRectPx.height = curY - hideRectPx.y;

  const x0 = Math.min(hideRectPx.x, hideRectPx.x + hideRectPx.width);
  const y0 = Math.min(hideRectPx.y, hideRectPx.y + hideRectPx.height);
  const w  = Math.abs(hideRectPx.width);
  const h  = Math.abs(hideRectPx.height);

  hideRect.style.left   = x0 + "px";
  hideRect.style.top    = y0 + "px";
  hideRect.style.width  = w  + "px";
  hideRect.style.height = h  + "px";
});

document.addEventListener("mouseup", ()=>{
  if(!draggingHide) return;
  draggingHide=false;
  updateHideRelFromPx();
});

function updateHideRelFromPx(){
  if(!hideRectPx) return;
  const cw = hideCanvas.clientWidth;
  const ch = hideCanvas.clientHeight;
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

closeHide.addEventListener("click", ()=> hideModal.style.display="none");
clearHide.addEventListener("click", ()=>{
  hideRectRel = null;
  hideRectPx  = null;
  hideRect.style.display="none";
});
saveHide.addEventListener("click", ()=> hideModal.style.display="none");

/* --------------------------------------------------
   ANNOTATION TOOLBAR (rect / arrow / text)
-------------------------------------------------- */

const annotCanvas   = $("annotCanvas");
const annotCtx      = annotCanvas.getContext("2d");
const annotEmptyMsg = $("annotEmptyMsg");
const toolRectBtn   = $("toolRect");
const toolArrowBtn  = $("toolArrow");
const toolTextBtn   = $("toolText");
const annotClearBtn = $("annotClear");
const annotApplyBtn = $("annotApply");

let annotBaseImg = null;
let annotShapes  = [];
let annotCurrentTool = "rect";
let annotDrawing = false;
let annotStartX  = 0;
let annotStartY  = 0;
let annotTempShape = null;

// scale from annotation canvas space → enhanceCanvas space
let annotScaleX = 1;
let annotScaleY = 1;

function initAnnotFromEnhance(){
  if(!enhanceCanvas.width){
    annotEmptyMsg.style.display="flex";
    return;
  }
  annotEmptyMsg.style.display="none";

  const maxW = 600;
  const cw   = enhanceCanvas.width;
  const ch   = enhanceCanvas.height;
  const scale = cw > maxW ? maxW / cw : 1;

  annotCanvas.width  = cw * scale;
  annotCanvas.height = ch * scale;
  annotScaleX = cw / annotCanvas.width;
  annotScaleY = ch / annotCanvas.height;

  annotBaseImg = new Image();
  annotBaseImg.onload = ()=> redrawAnnotations();
  annotBaseImg.src = enhanceCanvas.toDataURL("image/jpeg",0.9);
  annotShapes = [];
}

function setTool(tool){
  annotCurrentTool = tool;
  [toolRectBtn, toolArrowBtn, toolTextBtn].forEach(btn=>btn.classList.remove("active"));
  if(tool==="rect")  toolRectBtn.classList.add("active");
  if(tool==="arrow") toolArrowBtn.classList.add("active");
  if(tool==="text")  toolTextBtn.classList.add("active");
}

toolRectBtn.addEventListener("click", ()=>setTool("rect"));
toolArrowBtn.addEventListener("click", ()=>setTool("arrow"));
toolTextBtn.addEventListener("click", ()=>setTool("text"));

annotCanvas.addEventListener("mousedown", e=>{
  if(!annotBaseImg) return;
  const rect = annotCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if(annotCurrentTool === "text"){
    const txt = prompt("Enter label text:");
    if(txt){
      annotShapes.push({type:"text", x, y, text:txt});
      redrawAnnotations();
    }
    return;
  }

  annotDrawing = true;
  annotStartX = x;
  annotStartY = y;
  annotTempShape = null;
});

annotCanvas.addEventListener("mousemove", e=>{
  if(!annotDrawing || !annotBaseImg) return;
  const rect = annotCanvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  if(annotCurrentTool === "rect"){
    annotTempShape = {type:"rect", x1:annotStartX, y1:annotStartY, x2:x, y2:y};
  } else if(annotCurrentTool === "arrow"){
    annotTempShape = {type:"arrow", x1:annotStartX, y1:annotStartY, x2:x, y2:y};
  }
  redrawAnnotations();
});

document.addEventListener("mouseup", ()=>{
  if(!annotDrawing) return;
  annotDrawing = false;
  if(annotTempShape){
    annotShapes.push(annotTempShape);
    annotTempShape = null;
    redrawAnnotations();
  }
});

annotClearBtn.addEventListener("click", ()=>{
  annotShapes = [];
  annotTempShape = null;
  redrawAnnotations();
});

annotApplyBtn.addEventListener("click", ()=>{
  if(!annotBaseImg || !enhanceCanvas.width){
    alert("Nothing to apply yet. Run Enhance first.");
    return;
  }
  const ctx = enhanceCtx;

  annotShapes.forEach(shape=>{
    drawShapeOnCtx(ctx, shape, annotScaleX, annotScaleY);
  });

  // refresh base image and annotations to match updated enhanceCanvas
  initAnnotFromEnhance();
  alert("Annotations applied to enhanced image.");
});

function redrawAnnotations(){
  annotCtx.clearRect(0,0,annotCanvas.width,annotCanvas.height);
  if(annotBaseImg && annotBaseImg.complete){
    annotCtx.drawImage(annotBaseImg,0,0,annotCanvas.width,annotCanvas.height);
  }
  annotShapes.forEach(shape=> drawShapeOnCtx(annotCtx, shape, 1, 1));
  if(annotTempShape){
    drawShapeOnCtx(annotCtx, annotTempShape, 1, 1);
  }
}

function drawShapeOnCtx(ctx, shape, sx, sy){
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,180,120,0.95)";
  ctx.fillStyle   = "rgba(255,180,120,0.20)";
  ctx.font        = "14px system-ui";

  if(shape.type === "rect"){
    const x = Math.min(shape.x1, shape.x2) * sx;
    const y = Math.min(shape.y1, shape.y2) * sy;
    const w = Math.abs(shape.x2 - shape.x1) * sx;
    const h = Math.abs(shape.y2 - shape.y1) * sy;
    ctx.fillRect(x,y,w,h);
    ctx.strokeRect(x,y,w,h);
  }

  if(shape.type === "arrow"){
    const x1 = shape.x1 * sx;
    const y1 = shape.y1 * sy;
    const x2 = shape.x2 * sx;
    const y2 = shape.y2 * sy;
    ctx.beginPath();
    ctx.moveTo(x1,y1);
    ctx.lineTo(x2,y2);
    ctx.stroke();

    const angle = Math.atan2(y2-y1, x2-x1);
    const headLen = 10;
    ctx.beginPath();
    ctx.moveTo(x2,y2);
    ctx.lineTo(x2 - headLen*Math.cos(angle - Math.PI/6),
               y2 - headLen*Math.sin(angle - Math.PI/6));
    ctx.lineTo(x2 - headLen*Math.cos(angle + Math.PI/6),
               y2 - headLen*Math.sin(angle + Math.PI/6));
    ctx.closePath();
    ctx.fill();
  }

  if(shape.type === "text"){
    const x = shape.x * sx;
    const y = shape.y * sy;
    const padding = 4;
    const metrics = ctx.measureText(shape.text);
    const w = metrics.width + padding*2;
    const h = 18;
    ctx.fillStyle = "rgba(0,0,0,0.70)";
    ctx.fillRect(x,y-h,w,h);
    ctx.strokeStyle = "rgba(255,180,120,0.9)";
    ctx.strokeRect(x,y-h,w,h);
    ctx.fillStyle = "rgba(255,220,200,1)";
    ctx.fillText(shape.text, x+padding, y-4);
  }

  ctx.restore();
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

/* Default view is controlled by auth */
