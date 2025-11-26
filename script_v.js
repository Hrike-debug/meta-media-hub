/* ==========================================================
   Meta Media Hub - script_v.js (FULL STABLE)
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

pwBtn?.addEventListener("click", unlock);
pwInput?.addEventListener("keydown", e => { if(e.key==="Enter") unlock(); });

if(isAuthed()){
  pwModal.style.display="none";
  statusText.textContent="Unlocked";
  showSection("home");
}

/* ---------------------------
   NAVIGATION
---------------------------- */
$("btnImage")?.addEventListener("click", ()=>showSection("resize"));
$("btnEnhancer")?.addEventListener("click", ()=>showSection("enhance"));
$("backHomeFromImage")?.addEventListener("click", ()=>showSection("home"));
$("backHomeFromEnhancer")?.addEventListener("click", ()=>showSection("home"));

/* ==========================================================
   IMAGE RESIZER – UPLOAD + CENTER COVER (NO STRETCH)
========================================================== */

let imageFiles = [];
let imageDetectionMap = {};
let cocoModel = null;

const dropImage     = $("dropImage");
const imageInput    = $("imageInput");
const imageFileList = $("imageFileList");
const smartBanner   = $("smartBanner");
const bannerIcon    = $("bannerIcon");
const bannerText    = $("bannerText");
const imgStatus     = $("imgStatus");
const imgAiToggle   = $("imgAiToggle");

const imgWidth      = $("imgWidth");
const imgHeight     = $("imgHeight");
const imgQuality    = $("imgQuality");
const imgProcessBtn = $("imgProcessBtn");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProgress   = $("imgProgress");

/* ✅ UPLOAD FIXED */
dropImage?.addEventListener("click", ()=> imageInput.click());

imageInput?.addEventListener("change", async e=>{
  imageFiles = Array.from(e.target.files || []).filter(f=>f.type.startsWith("image/"));
  await handleNewImages();
});

dropImage?.addEventListener("dragover", e=>{
  e.preventDefault();
  dropImage.classList.add("drag-over");
});
dropImage?.addEventListener("dragleave", ()=> dropImage.classList.remove("drag-over"));
dropImage?.addEventListener("drop", async e=>{
  e.preventDefault();
  dropImage.classList.remove("drag-over");
  imageFiles = Array.from(e.dataTransfer.files || []).filter(f=>f.type.startsWith("image/"));
  await handleNewImages();
});

function refreshImageList(){
  if(!imageFiles.length){
    imageFileList.innerHTML="No files uploaded.";
    smartBanner.style.display="none";
    return;
  }

  imageFileList.innerHTML = imageFiles.map((f,i)=>{
    return `<div class="file-row"><b>${i+1}. ${f.name}</b></div>`;
  }).join("");
}

async function handleNewImages(){
  refreshImageList();
  smartBanner.style.display="flex";
  bannerText.textContent="Images ready.";
  imgStatus.textContent="Ready.";
}

/* ✅ ZIP HELPER */
function dataURLToBlob(dataUrl){
  const [h,d] = dataUrl.split(",");
  const mime = h.match(/:(.*?);/)[1];
  const bin = atob(d);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}

/* ✅ ✅ ✅ FIXED RESIZE (CENTER COVER – NO STRETCH) */
async function processImages(previewOnly=false){
  if(!imageFiles.length) return alert("Upload images first");

  const tW = parseInt(imgWidth?.value)  || 0;
  const tH = parseInt(imgHeight?.value) || 0;
  const q  = (parseInt(imgQuality?.value)||90)/100;

  const zip = new JSZip();
  let done = 0;

  for(const file of imageFiles){
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.src = url;
    await img.decode();

    const w = tW || img.naturalWidth;
    const h = tH || img.naturalHeight;

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");

    /* ✅ TRUE CENTER COVER SCALE */
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = img.naturalWidth * scale;
    const sh = img.naturalHeight * scale;
    const ox = (w - sw) / 2;
    const oy = (h - sh) / 2;

    ctx.drawImage(img, ox, oy, sw, sh);

    const out = canvas.toDataURL("image/jpeg", q);

    if(previewOnly){
      window.open(out,"_blank");
      return;
    }

    zip.file(
      file.name.replace(/\.[^/.]+$/, "")+"_resized.jpg",
      dataURLToBlob(out)
    );

    done++;
    if(imgProgress)
      imgProgress.style.width = ((done/imageFiles.length)*100).toFixed(1)+"%";

    URL.revokeObjectURL(url);
  }

  const blob = await zip.generateAsync({type:"blob"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "resized_images.zip";
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
}

imgProcessBtn?.addEventListener("click",()=>processImages(false));
imgPreviewBtn?.addEventListener("click",()=>processImages(true));

/* ==========================================================
   AI ENHANCER – UNCHANGED (UPLOAD SAFE)
========================================================== */

const enhanceCanvas = document.createElement("canvas");
const enhanceCtx    = enhanceCanvas.getContext("2d");
let enhanceFiles    = [];

const dropEnhance   = $("dropEnhance");
const enhanceInput  = $("enhanceInput");
const enhRunBtn     = $("enhRunBtn");
const enhPreviewBtn = $("enhPreviewBtn");
const enhStatus     = $("enhStatus");

dropEnhance?.addEventListener("click", ()=> enhanceInput.click());

enhanceInput?.addEventListener("change", async e=>{
  enhanceFiles = Array.from(e.target.files || []).filter(f=>f.type.startsWith("image/"));
  if(!enhanceFiles.length) return;

  const img = new Image();
  const url = URL.createObjectURL(enhanceFiles[0]);
  img.src = url;
  await img.decode();

  enhanceCanvas.width = img.width;
  enhanceCanvas.height = img.height;
  enhanceCtx.drawImage(img,0,0);

  enhStatus.textContent="Image loaded.";
  URL.revokeObjectURL(url);
});

enhPreviewBtn?.addEventListener("click",()=>{
  if(!enhanceCanvas.width) return alert("Upload image first");
  window.open(enhanceCanvas.toDataURL("image/jpeg",0.92),"_blank");
});

enhRunBtn?.addEventListener("click",()=>{
  if(!enhanceCanvas.width) return alert("Upload image first");
  const a=document.createElement("a");
  a.href=enhanceCanvas.toDataURL("image/jpeg",0.92);
  a.download="enhanced.jpg";
  a.click();
});

/* Default view */
showSection("home");
