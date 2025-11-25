/* ==========================================================
   Meta Media Hub - script_v.js  (FINAL SYNC VERSION)
   Image Resize + AI Enhancer + Object Hide
   Client-side processing only (no uploads)
========================================================== */

const $ = id => document.getElementById(id);

/* ---------------------------
   AUTH SYSTEM
---------------------------- */
const pwModal = $("pwModal"), pwInput = $("pwInput"), pwBtn = $("pwBtn"), pwMsg = $("pwMsg"), statusText = $("statusText");
const AUTH_KEY = "mm_auth_v2", PASSWORD = "Meta@123";

function saveAuth(v){
  v ? localStorage.setItem(AUTH_KEY,"true") : localStorage.removeItem(AUTH_KEY);
}
function isAuthed(){ return localStorage.getItem(AUTH_KEY)==="true"; }

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

/* ---------------------------
   SECTION NAVIGATION
---------------------------- */
function showSection(name){
  $("home").style.display = (name==="home") ? "flex" : "none";
  $("imageSection").style.display = (name==="resize") ? "block" : "none";
  $("enhancerSection").style.display = (name==="enhance") ? "block" : "none";
}

$("btnImage").addEventListener("click",()=>showSection("resize"));
$("btnEnhancer").addEventListener("click",()=>showSection("enhance"));
$("backHomeFromImage").addEventListener("click",()=>showSection("home"));
$("backHomeFromEnhancer").addEventListener("click",()=>showSection("home"));

/* ABOUT MODAL */
$("aboutBtn").addEventListener("click",()=>$("aboutModal").style.display="flex");
$("closeAbout").addEventListener("click",()=>$("aboutModal").style.display="none");

/* ---------------------------
   THEME SWITCHER
---------------------------- */
const themeToggle = $("themeToggle");
const THEME_KEY = "ui_theme";

function applyTheme(t){
  if(t==="light") document.documentElement.classList.add("theme-light");
  else document.documentElement.classList.remove("theme-light");
  themeToggle.textContent = t==="light" ? "☀️" : "🌙";
  localStorage.setItem(THEME_KEY,t);
}
themeToggle.addEventListener("click",()=>{
  const c = localStorage.getItem(THEME_KEY) || "dark";
  applyTheme(c==="dark" ? "light" : "dark");
});
applyTheme(localStorage.getItem(THEME_KEY) || "dark");

/* ==========================================================
   IMAGE RESIZER (existing working system, only ID sync)
========================================================== */

let imageFiles = [];
let imageDetectionMap = {};
let imageFocusMap = {}; 
let cocoModel = null;

const dropImage = $("dropImage");
const imageInput = $("imageInput");
const imageFileList = $("imageFileList");

dropImage.addEventListener("click",()=>imageInput.click());
imageInput.addEventListener("change", async e=>{
  imageFiles = Array.from(e.target.files);
  await handleNewImages();
});

/* DRAG INPUT */
dropImage.addEventListener("dragover", e=>{e.preventDefault();dropImage.style.background="#1b232a";});
dropImage.addEventListener("dragleave",()=>dropImage.style.background="");
dropImage.addEventListener("drop", async e=>{
  e.preventDefault(); dropImage.style.background="";
  imageFiles = Array.from(e.dataTransfer.files);
  await handleNewImages();
});

function refreshImageList(){
  if(!imageFiles.length){
    imageFileList.innerHTML="No files uploaded.";
    $("smartBanner").style.display="none";
    return;
  }
  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    const st = imageDetectionMap[f.name] || "unknown";
    let icon="⏳", txt="Scanning…";
    if(st==="person"){ icon="👤"; txt="Human found"; }
    else if(st==="none"){ icon="❌"; txt="No person"; }

    return `
      <div class="file-row">
        <span>${icon}</span>
        <div>
          <strong>${i+1}. ${f.name}</strong><br>
          <span class="small">${txt} — ${Math.round(f.size/1024)} KB</span>
        </div>
      </div>`;
  }).join("");
}

/* LOAD PERSON MODEL */
async function loadModel(){
  if(cocoModel) return cocoModel;
  $("imgStatus").textContent="Loading AI model...";
  cocoModel = await cocoSsd.load();
  $("imgStatus").textContent="Model ready.";
  return cocoModel;
}

async function detectPerson(imgEl){
  try{
    await loadModel();
    const pred = await cocoModel.detect(imgEl);
    return pred.some(p=>p.class==="person");
  } catch(e){
    return false;
  }
}

/* PROCESS NEW IMAGES */
async function handleNewImages(){
  imageDetectionMap = {};
  imageFiles.forEach(f=>imageDetectionMap[f.name]="unknown");

  refreshImageList();
  $("smartBanner").style.display="flex";
  $("bannerText").textContent="Scanning images...";

  let found = 0;
  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src=url;
    await img.decode();

    const has = await detectPerson(img);
    has ? found++ : null;
    imageDetectionMap[file.name] = has ? "person" : "none";
    refreshImageList();
    URL.revokeObjectURL(url);
  }

  if(found>0){
    $("bannerIcon").textContent="🟢";
    $("bannerText").innerHTML = `People detected in <b>${found}</b> of ${imageFiles.length} image(s).`;
    $("imgAiToggle").classList.add("active");
  } else {
    $("bannerIcon").textContent="⚪";
    $("bannerText").innerHTML = `No people detected.`;
    $("imgAiToggle").classList.remove("active");
  }

  $("imgStatus").textContent="Scan complete.";
}

/* ==========================================================
   AI IMAGE ENHANCER
========================================================== */

let enhanceFiles = [];
let enhanceCanvas = document.createElement("canvas");
let enhanceCtx = enhanceCanvas.getContext("2d");
let hideRectEnh = null;

$("dropEnhance").addEventListener("click",()=>$("enhanceInput").click());
$("enhanceInput").addEventListener("change", async e=>{
  enhanceFiles = Array.from(e.target.files);
  if(!enhanceFiles.length) return;
  await loadEnhImage(enhanceFiles[0]);
});

async function loadEnhImage(file){
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src=url;
  await img.decode();

  enhanceCanvas.width = img.width;
  enhanceCanvas.height = img.height;
  enhanceCtx.drawImage(img,0,0);

  $("enhFileInfo").textContent = `${file.name} — ${img.width}×${img.height}px`;
  URL.revokeObjectURL(url);

  hideRectEnh = null;
}

/* ENHANCE BUTTON */
$("enhRunBtn").addEventListener("click", async () => {
  if(!enhanceCanvas.width) return alert("Upload an image first!");

  let imgData = enhanceCtx.getImageData(0,0,enhanceCanvas.width,enhanceCanvas.height);

  if($("enhOCR").checked) imgData = applyOCRBoost(imgData);
  if($("enhHDR").checked) imgData = applyHDRToneMap(imgData);
  if($("enhDenoise").checked) imgData = applyDenoise(imgData);
  if($("enhFaceEnhance").checked) imgData = applySharpen(imgData);

  enhanceCtx.putImageData(imgData,0,0);

  if($("enhHide").checked && hideRectEnh){
    blurRegionOnCanvas(enhanceCtx, hideRectEnh);
  }

  const q = parseInt($("enhQuality").value)/100;
  download(enhanceCanvas.toDataURL("image/jpeg", q));
});

/* PREVIEW */
$("enhPreviewBtn").addEventListener("click",()=>{
  if(!enhanceCanvas.width) return alert("Upload first!");
  window.open(enhanceCanvas.toDataURL("image/jpeg",0.92));
});

/* RECT / HIDE UI */
$("hideAreaBtn").addEventListener("click",()=>{
  $("hideModal").style.display="flex";

  const src = enhanceCanvas.toDataURL("image/jpeg",0.92);
  $("hidePreview").src=src;

  $("hideModal").setAttribute("aria-hidden","false");
});

/* SELECT RECTANGLE */
const hideCanvas = $("hideCanvas");
const hideBox = $("hideRect");
let hDrag = false, startX=0, startY=0;

hideCanvas.addEventListener("mousedown", e=>{
  if(!$("enhHide").checked) return;
  hDrag=true;
  startX=e.offsetX; startY=e.offsetY;
  hideRectEnh={x:startX,y:startY,width:0,height:0};
  hideBox.style.display="block";
});
hideCanvas.addEventListener("mousemove", e=>{
  if(!hDrag) return;
  const w=e.offsetX-startX, h=e.offsetY-startY;
  hideRectEnh={x:startX,y:startY,width:w,height:h};
  positionHideRect();
});
document.addEventListener("mouseup",()=>hDrag=false);

function positionHideRect(){
  hideBox.style.left = hideRectEnh.x+"px";
  hideBox.style.top = hideRectEnh.y+"px";
  hideBox.style.width = hideRectEnh.width+"px";
  hideBox.style.height = hideRectEnh.height+"px";
}

$("closeHide").addEventListener("click",()=>{
  $("hideModal").style.display="none";
});
$("saveHide").addEventListener("click",()=>{
  $("hideModal").style.display="none";
});

/* ----------------------------
   BLUR (STRONG MULTI PASS)
----------------------------- */
function blurRegionOnCanvas(ctx, box){
  const { x,y,width,height } = box;
  if(width<=0 || height<=0) return;

  let region = ctx.getImageData(x,y,width,height);

  const passes = 7;  // Increase to change strength
  for(let p=0;p<passes;p++){
    region = gaussianBlur(region,width,height);
  }
  ctx.putImageData(region,x,y);
}

function gaussianBlur(imgData,w,h){
  const weights=[0.1201,0.2339,0.2920,0.2339,0.1201];
  const half=2;
  const d=imgData.data;
  const tmp = new Uint8ClampedArray(d);

  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      let r=0,g=0,b=0;
      for(let k=-half;k<=half;k++){
        const px = Math.min(w-1,Math.max(0,x+k));
        const idx=(y*w+px)*4;
        const wgt=weights[k+half];
        r+=tmp[idx]*wgt;
        g+=tmp[idx+1]*wgt;
        b+=tmp[idx+2]*wgt;
      }
      const id=(y*w+x)*4;
      d[id]=r; d[id+1]=g; d[id+2]=b;
    }
  }
  return imgData;
}

/* DOWNLOAD */
function download(base64,name="enhanced.jpg"){
  const a=document.createElement("a");
  a.href=base64;
  a.download=name;
  a.click();
}

/* =============================== */

showSection("home");
