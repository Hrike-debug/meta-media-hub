/* ==========================================================
   Meta Media Hub - script_v.js (Stable Fade + Enhancer + Resizer)
   Image Resizer + AI Enhancer + Object Hide Blur
   Client-side only
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

const AUTH_KEY  = "mm_auth_v4";
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

/* ==========================================================
   ✅ 4-THEME SYSTEM (USING EXISTING BUTTON)
========================================================== */

const themeToggle = $("themeToggle");
const THEME_KEY = "mm_theme_4";

const THEMES = [
  "theme-flaming-orange",
  "theme-dark-glass",
  "theme-cyber-tech",
  "theme-retro-beige"
];

function applyThemeClass(cls){
  document.body.classList.remove(...THEMES);
  document.body.classList.add(cls);
  localStorage.setItem(THEME_KEY, cls);
}

let currentThemeIndex = THEMES.indexOf(
  localStorage.getItem(THEME_KEY) || "theme-flaming-orange"
);
if(currentThemeIndex < 0) currentThemeIndex = 0;
applyThemeClass(THEMES[currentThemeIndex]);

themeToggle.addEventListener("click", ()=>{
  currentThemeIndex = (currentThemeIndex + 1) % THEMES.length;
  applyThemeClass(THEMES[currentThemeIndex]);
});

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
   IMAGE RESIZER – Smart Human Detection  (UNCHANGED)
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
    if(st==="person"){ icon="👤"; msg="Human detected";}
    if(st==="none"){ icon="❌"; msg="No person";}
    return `
      <div class="file-row">
        <span>${icon}</span>
        <div><b>${i+1}. ${f.name}</b><br><small>${msg}</small></div>
      </div>`;
  }).join("");
}

async function loadModel(){
  imgStatus.textContent="Loading AI model…";
  cocoModel = await cocoSsd.load();
  imgStatus.textContent="Model ready";
}

async function detectPerson(imgEl){
  await loadModel();
  const preds = await cocoModel.detect(imgEl);
  return preds.some(p => p.class === "person");
}

async function handleNewImages(){
  smartBanner.style.display="flex";
  bannerIcon.textContent="⏳";
  bannerText.textContent="Scanning images…";
  imgStatus.textContent="Scanning…";

  imageDetectionMap={};
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
    ? `Smart Human Detection:<br>People in <b>${found}</b> image(s).`
    : `No people detected.`;

  imgAiToggle.classList.toggle("active", found>0);
  imgStatus.textContent="Scan complete.";
}


/* ==========================================================
   AI IMAGE ENHANCER – OCR, HDR & Strong Blur
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

  enhanceCanvas.width = img.width;
  enhanceCanvas.height = img.height;
  enhanceCtx.drawImage(img,0,0);

  enhFileInfo.textContent = `${file.name} — ${img.width}×${img.height}px`;
  enhStatus.textContent = "Image loaded. Apply enhancements.";

  hideRectEnh = null;
  URL.revokeObjectURL(url);
}

enhQuality.addEventListener("input",()=> enhQualityVal.textContent = enhQuality.value+"%");

/* ==========================================================
   ✅ PREVIEW BUTTON – NEW TAB PREVIEW REMOVED
   (Button now does nothing – as requested)
========================================================== */
enhPreviewBtn.addEventListener("click",()=>{
  // Intentionally disabled to remove second preview window
});

/* ==========================================================
   ENHANCE RUN (UNCHANGED)
========================================================== */
enhRunBtn.addEventListener("click",()=>{
  if(!enhanceCanvas.width) return alert("Upload image first!");
  let data = enhanceCtx.getImageData(0,0,enhanceCanvas.width,enhanceCanvas.height);

  if(enhOCR.checked) data = applyOCRBoost(data);
  if(enhHDR.checked) data = applyHDRToneMap(data);

  enhanceCtx.putImageData(data,0,0);

  if(enhHide.checked && hideRectEnh){
    blurRegionOnCanvas(enhanceCtx, hideRectEnh);
  }

  download(
    enhanceCanvas.toDataURL("image/jpeg",(parseInt(enhQuality.value)||92)/100),
    "enhanced.jpg"
  );
  enhStatus.textContent="Done! Downloaded.";
});

/* OCR BOOST */
function applyOCRBoost(imageData){
  const d = imageData.data;
  for(let i=0;i<d.length;i+=4){
    const avg = (d[i]+d[i+1]+d[i+2])/3;
    const b = avg>128 ? 1.1 : 1.25;
    d[i]   = Math.min(255,d[i]*b);
    d[i+1] = Math.min(255,d[i+1]*b);
    d[i+2] = Math.min(255,d[i+2]*b);
  }
  return imageData;
}

/* HDR Tone Map */
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
  if(v<100) return Math.min(255,v*1.25);
  if(v>180) return v*0.85;
  return v;
}

/* Strong multi-pass blur */
function blurRegionOnCanvas(ctx,box){
  const {x,y,width,height}=box;
  if(width<=0 || height<=0) return;

  let region = ctx.getImageData(x,y,width,height);
  const passes=7;

  for(let i=0;i<passes;i++){
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
        const px=Math.min(w-1,Math.max(0,x+k));
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

function download(url,name){
  const a=document.createElement("a");
  a.href=url;
  a.download=name;
  a.click();
}

/* Object Hide area selection */
hideAreaBtn.addEventListener("click",()=>{
  if(!enhanceCanvas.width) return alert("Upload image first");
  hideModal.style.display="flex";
  hidePreview.src = enhanceCanvas.toDataURL("image/jpeg",0.92);
});

let dragging=false,startX=0,startY=0;

hideCanvas.addEventListener("mousedown",e=>{
  if(!enhHide.checked) return;
  dragging=true;
  startX=e.offsetX; startY=e.offsetY;
  hideRectEnh = {x:startX,y:startY,width:0,height:0};
  hideRect.style.display="block";
});

hideCanvas.addEventListener("mousemove",e=>{
  if(!dragging) return;
  hideRectEnh.width  = e.offsetX-startX;
  hideRectEnh.height = e.offsetY-startY;
  hideRect.style.left   = hideRectEnh.x+"px";
  hideRect.style.top    = hideRectEnh.y+"px";
  hideRect.style.width  = hideRectEnh.width+"px";
  hideRect.style.height = hideRectEnh.height+"px";
});

document.addEventListener("mouseup",()=> dragging=false);

closeHide.addEventListener("click",()=> hideModal.style.display="none");
clearHide.addEventListener("click",()=>{
  hideRectEnh=null;
  hideRect.style.display="none";
});
saveHide.addEventListener("click",()=> hideModal.style.display="none");

/* Default view */
showSection("home");
