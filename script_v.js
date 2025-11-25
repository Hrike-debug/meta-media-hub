/* ==========================================================
   Meta Media Hub - script_v.js  (Enhanced)
   Image Resize + AI Enhancer + Object Hide
   Client-side processing only (no uploads)
   ----------------------------------------------------------
========================================================== */

/* Helper */
const $ = id => document.getElementById(id);

/* AUTH */
const pwModal = $("pwModal"), pwInput = $("pwInput"), pwBtn = $("pwBtn"), pwMsg = $("pwMsg"), statusText = $("statusText");
const AUTH_KEY = "mm_auth_v2", PASSWORD = "Meta@123";

function saveAuth(v){ v ? localStorage.setItem(AUTH_KEY,"true") : localStorage.removeItem(AUTH_KEY); }
function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }

async function unlock(){
  if(pwInput.value === PASSWORD){
    saveAuth(true);
    pwModal.style.display="none";
    statusText.textContent="Unlocked";
    showSection("home");
  } else {
    pwMsg.textContent="Incorrect password";
  }
}
pwBtn.addEventListener("click", unlock);
pwInput.addEventListener("keydown", e => { if(e.key==="Enter") unlock(); });

if(isAuthed()){
  pwModal.style.display="none";
  showSection("home");
}

/* SECTION CONTROL */
function showSection(name){
  $("home").style.display = (name==="home")?"flex":"none";
  $("resizeSection").style.display = (name==="resize")?"block":"none";
  $("enhanceSection").style.display = (name==="enhance")?"block":"none";
}

/* NAV */
$("btnResize").addEventListener("click",()=>showSection("resize"));
$("btnEnhance").addEventListener("click",()=>showSection("enhance"));
$("backHome1").addEventListener("click",()=>showSection("home"));
$("backHome2").addEventListener("click",()=>showSection("home"));

/* ABOUT MODAL */
const aboutModal = $("aboutModal");
$("btnAbout").addEventListener("click",()=>aboutModal.style.display="flex");
$("closeAbout").addEventListener("click",()=>aboutModal.style.display="none");

/* ===============================
   AI ENHANCER
================================ */

let enhanceFiles = [];
let enhanceCanvas = $("enhanceCanvas");
let enhanceCtx = enhanceCanvas.getContext("2d");
let enhancePreview = $("enhancePreview");
let hideRect = null;

const enhanceOCR = $("enhanceOCR");
const enhanceHDR = $("enhanceHDR");
const enhanceHide = $("enhanceHide");
const enhanceApplyBtn = $("enhanceApply");

/* Select File */
$("enhanceInput").addEventListener("change", async e => {
  enhanceFiles = Array.from(e.target.files);
  if(!enhanceFiles.length) return;
  await loadEnhanceImage(enhanceFiles[0]);
});

async function loadEnhanceImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();

  enhanceCanvas.width = img.width;
  enhanceCanvas.height = img.height;

  enhanceCtx.drawImage(img,0,0);
  enhancePreview.src = url;

  hideRect = null;
}

/* APPLY ENHANCEMENTS */
enhanceApplyBtn.addEventListener("click",()=>{
  if(!enhanceCanvas.width) return alert("Upload an image first!");

  let imgData = enhanceCtx.getImageData(0,0,enhanceCanvas.width,enhanceCanvas.height);

  if(enhanceOCR.checked) imgData = applyOCRBoost(imgData);
  if(enhanceHDR.checked) imgData = applyHDRToneMap(imgData);

  enhanceCtx.putImageData(imgData,0,0);

  if(enhanceHide.checked && hideRect){
    blurRegionOnCanvas(enhanceCtx, hideRect);
  }

  enhancePreview.src = enhanceCanvas.toDataURL("image/jpeg",0.92);
});

/* ===============================
   AI FILTERS
================================ */

/* --- E: OCR MODE --- */
function applyOCRBoost(imageData){
  const d = imageData.data;
  const w = imageData.width, h = imageData.height;
  for(let i = 0; i < d.length; i+=4){
    let avg = (d[i]+d[i+1]+d[i+2]) / 3;
    let boost = avg > 128 ? 1.1 : 1.25;
    d[i] *= boost; d[i+1] *= boost; d[i+2] *= boost;
  }
  return imageData;
}

/* --- F: HDR TONE MAP --- */
function applyHDRToneMap(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    d[i] = tone(d[i]);
    d[i+1] = tone(d[i+1]);
    d[i+2] = tone(d[i+2]);
  }
  return imageData;
}
function tone(v){
  const shadows = 0.18, highlight = 0.85;
  if(v < 100) return v * 1.25;   // lift shadows
  if(v > 180) return v * 0.85;   // compress highlights
  return v;
}

/* --- H: OBJECT HIDE BLUR AREA --- */
function blurRegionOnCanvas(ctx, box){
  const { x, y, width, height } = box;
  if(width<=0 || height<=0) return;

  let region = ctx.getImageData(x,y,width,height);

  const passes = 7; // 💥 EDIT BLUR STRENGTH HERE
  for(let i=0;i<passes;i++){
    region = gaussianBlur(region,width,height);
  }

  ctx.putImageData(region,x,y);
}

/* Gaussian blur kernel */
function gaussianBlur(imgData,w,h){
  const weights=[0.1201,0.2339,0.2920,0.2339,0.1201];
  const side=5;
  const half=2;
  const d=imgData.data;
  const tmp = new Uint8ClampedArray(d);

  // horizontal
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0;
      for(let k=-half;k<=half;k++){
        const px = Math.min(w-1,Math.max(0,x+k));
        const idx = (y*w+px)*4;
        const wgt=weights[k+half];
        r+=tmp[idx]*wgt;
        g+=tmp[idx+1]*wgt;
        b+=tmp[idx+2]*wgt;
      }
      const id = (y*w+x)*4;
      d[id]=r; d[id+1]=g; d[id+2]=b;
    }
  }
  return imgData;
}

/* ===============================
   OBJECT HIDE RECTANGLE UI
================================ */

const hideBox = $("hideBox");
let dragging=false, startX=0, startY=0;

$("enhanceCanvas").addEventListener("mousedown",e=>{
  if(!enhanceHide.checked) return;

  dragging=true;
  startX=e.offsetX; startY=e.offsetY;
  hideRect={x:startX,y:startY,width:0,height:0};

  hideBox.style.display="block";
});
$("enhanceCanvas").addEventListener("mousemove",e=>{
  if(!dragging) return;
  const w=e.offsetX-startX, h=e.offsetY-startY;
  hideRect={x:startX,y:startY,width:w,height:h};
  positionHideBox();
});
document.addEventListener("mouseup",()=> dragging=false);

function positionHideBox(){
  hideBox.style.left = hideRect.x+"px";
  hideBox.style.top = hideRect.y+"px";
  hideBox.style.width = hideRect.width+"px";
  hideBox.style.height = hideRect.height+"px";
}
