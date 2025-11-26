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
   IMAGE RESIZER – Smart Human Detection
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

const imgWidth      = $("imgWidth");
const imgHeight     = $("imgHeight");
const imgQuality    = $("imgQuality");
const imgProcessBtn = $("imgProcessBtn");
const imgPreviewBtn = $("imgPreviewBtn");
const imgProgress   = $("imgProgress");

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
  if(cocoModel) return;
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

/* ===========================
   ✅ IMAGE RESIZE + CENTER COVER (NO STRETCH)
=========================== */

function dataURLToBlob(dataUrl){
  const [h,d] = dataUrl.split(",");
  const mime = h.match(/:(.*?);/)[1];
  const bin = atob(d);
  const arr = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
  return new Blob([arr],{type:mime});
}

async function processImages(previewOnly=false){
  if(!imageFiles.length) return alert("Upload images first");

  const tW = parseInt(imgWidth.value)  || 0;
  const tH = parseInt(imgHeight.value) || 0;
  const q  = (parseInt(imgQuality.value)||90)/100;

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
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";

    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = img.naturalWidth * scale;
    const sh = img.naturalHeight * scale;
    const ox = (w - sw) / 2;
    const oy = (h - sh) / 2;

    ctx.drawImage(img, ox, oy, sw, sh);

    const out = canvas.toDataURL("image/jpeg", q);

    if(previewOnly){
      window.open(out, "_blank");
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
   AI IMAGE ENHANCER – (UNCHANGED BELOW)
========================================================== */
/* ... everything below remains exactly as you sent ... */

/* Default view */
showSection("home");
