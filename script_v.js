/* ==========================================================
   Meta Media Hub - script_v.js
   Stable working version
   - Auth
   - Navigation
   - Smart Human Detection
   - Manual Focus (ONLY when NO human)
   - Center-Cover Resize
   ========================================================== */

const $ = id => document.getElementById(id);

/* ====================
   AUTH
==================== */
const pwModal   = $("pwModal");
const pwInput   = $("pwInput");
const pwBtn     = $("pwBtn");
const pwMsg     = $("pwMsg");
const statusText= $("statusText");

const AUTH_KEY  = "mm_auth_v3";
const PASSWORD  = "Meta@123";

function saveAuth(v){ v ? localStorage.setItem(AUTH_KEY,"true") : localStorage.removeItem(AUTH_KEY); }
function isAuthed(){ return localStorage.getItem(AUTH_KEY) === "true"; }

function unlock(){
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
pwInput.addEventListener("keydown", e=>{ if(e.key==="Enter") unlock(); });

if(isAuthed()){
  pwModal.style.display="none";
  statusText.textContent="Unlocked";
  showSection("home");
}

/* ====================
   NAVIGATION
==================== */
function showSection(name){
  ["home","imageSection","enhancerSection"].forEach(id=>{
    const el=$(id);
    if(el) el.style.display="none";
  });
  if(name==="home") $("home").style.display="flex";
  if(name==="resize") $("imageSection").style.display="block";
  if(name==="enhance") $("enhancerSection").style.display="block";
}

$("btnImage").onclick        = ()=> showSection("resize");
$("btnEnhancer").onclick     = ()=> showSection("enhance");
$("backHomeFromImage").onclick   = ()=> showSection("home");
$("backHomeFromEnhancer").onclick= ()=> showSection("home");

/* =========================
   IMAGE RESIZER + AI SCAN
========================= */

let imageFiles = [];
let imageDetectionMap = {};
let cocoModel = null;
let hasHuman = false;

/* ✅ Manual Focus State */
let manualFocusEnabled = false;
let manualFocusPoint = null;

const dropImage     = $("dropImage");
const imageInput    = $("imageInput");
const imageFileList = $("imageFileList");
const smartBanner   = $("smartBanner");
const bannerIcon    = $("bannerIcon");
const bannerText    = $("bannerText");
const imgStatus     = $("imgStatus");

const imgWidth      = $("imgWidth");
const imgHeight     = $("imgHeight");
const imgQuality    = $("imgQuality");
const imgQualityVal = $("imgQualityVal");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProcessBtn = $("imgProcessBtn");
const focusBtn      = $("focusBtn");

dropImage.onclick = ()=> imageInput.click();

imageInput.onchange = async e=>{
  imageFiles = Array.from(e.target.files).filter(f=>f.type.startsWith("image/"));
  await handleNewImages();
};

async function loadCoco(){
  if(!cocoModel){
    imgStatus.textContent="Loading model…";
    cocoModel = await cocoSsd.load();
  }
}
async function detectPerson(img){
  await loadCoco();
  const preds = await cocoModel.detect(img);
  return preds.some(p=>p.class==="person");
}

async function handleNewImages(){
  imageDetectionMap={};
  smartBanner.style.display="block";
  bannerIcon.textContent="⏳";
  bannerText.textContent="Scanning images…";
  imgStatus.textContent="Scanning…";

  let found=0;

  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src=url; await img.decode();

    const human = await detectPerson(img);
    imageDetectionMap[file.name] = human ? "person" : "none";
    if(human) found++;

    URL.revokeObjectURL(url);
  }

  hasHuman = found>0;

  bannerIcon.textContent = hasHuman ? "🟢" : "⚪";
  bannerText.innerHTML   = hasHuman
    ? `Human detected in ${found} image(s)`
    : "No human detected";

  /* ✅ MANUAL FOCUS AUTO CONTROL */
  if(hasHuman){
    focusBtn.disabled = true;
    focusBtn.style.opacity = 0.4;
    manualFocusEnabled = false;
    manualFocusPoint = null;
  } else {
    focusBtn.disabled = false;
    focusBtn.style.opacity = 1;
  }

  imgStatus.textContent="Scan complete.";
  refreshImageList();
}

function refreshImageList(){
  if(!imageFiles.length){
    imageFileList.textContent="No files uploaded.";
    return;
  }
  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    const st = imageDetectionMap[f.name] || "unknown";
    return `<div>${i+1}. ${f.name} — ${st}</div>`;
  }).join("");
}

/* =====================
   MANUAL FOCUS (NO HUMAN ONLY)
===================== */
focusBtn.onclick = ()=>{
  if(hasHuman){
    alert("Manual Focus disabled (Human detected)");
    return;
  }
  manualFocusEnabled = true;
  alert("Now click anywhere on the screen to set focus point.");
};

document.addEventListener("click", e=>{
  if(!manualFocusEnabled) return;
  manualFocusPoint = { x:e.clientX, y:e.clientY };
  manualFocusEnabled=false;
  alert("Manual focus set.");
});

/* ======================
   CENTER-COVER RESIZE
====================== */
imgQuality.oninput = ()=> imgQualityVal.textContent = imgQuality.value+"%";

async function processImages(){
  if(!imageFiles.length) return alert("Upload images first");

  const tW = parseInt(imgWidth.value)||0;
  const tH = parseInt(imgHeight.value)||0;
  const q  = (parseInt(imgQuality.value)||90)/100;

  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src=url; await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = tW || img.width;
    canvas.height= tH || img.height;
    const ctx = canvas.getContext("2d");

    const scale = Math.max(
      canvas.width  / img.width,
      canvas.height / img.height
    );

    const sw = img.width  * scale;
    const sh = img.height * scale;

    let ox = (canvas.width  - sw) / 2;
    let oy = (canvas.height - sh) / 2;

    /* ✅ APPLY MANUAL FOCUS ONLY IF NO HUMAN */
    if(!hasHuman && manualFocusPoint){
      const fx = manualFocusPoint.x / window.innerWidth;
      const fy = manualFocusPoint.y / window.innerHeight;
      ox = canvas.width  * (0.5 - fx);
      oy = canvas.height * (0.5 - fy);
    }

    ctx.drawImage(img, ox, oy, sw, sh);

    const out = canvas.toDataURL("image/jpeg", q);
    download(out, file.name.replace(/\..+$/,"")+"_resized.jpg");

    URL.revokeObjectURL(url);
  }

  imgStatus.textContent="Done.";
}

imgProcessBtn.onclick = processImages;
imgPreviewBtn.onclick = processImages;

/* ====================
   UTILITY
==================== */
function download(url,name){
  const a=document.createElement("a");
  a.href=url; a.download=name; a.click();
}
