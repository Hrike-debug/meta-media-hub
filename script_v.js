const $ = id => document.getElementById(id);

/* ================= AUTH ================= */
const PASSWORD = "Meta@123";
const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");

pwBtn.onclick = () => {
  if (pwInput.value === PASSWORD) {
    pwModal.style.display = "none";
    statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    pwMsg.textContent = "Wrong password";
  }
};

/* ================= NAVIGATION ================= */
function showSection(sec) {
  $("home").style.display = sec === "home" ? "flex" : "none";
  $("imageSection").style.display = sec === "image" ? "block" : "none";
  $("enhancerSection").style.display = sec === "enhance" ? "block" : "none";
}

$("btnImage").onclick = () => showSection("image");
$("btnEnhancer").onclick = () => showSection("enhance");
$("backHomeFromImage").onclick = () => showSection("home");
$("backHomeFromEnhancer").onclick = () => showSection("home");

/* ================= IMAGE TOOLS ================= */
const imageToolInput = $("imageToolInput");
const dropImageTool = $("dropImageTool");
const imageToolInfo = $("imageToolInfo");
const resizePreviewImg = $("resizePreviewImg");
const resizeW = $("resizeW");
const resizeH = $("resizeH");

const canvas = document.createElement("canvas");
const ctx = canvas.getContext("2d");

let currentImg = new Image();

dropImageTool.onclick = () => imageToolInput.click();

imageToolInput.onchange = e => {
  const file = e.target.files[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  currentImg.src = url;

  currentImg.onload = () => {
    canvas.width = currentImg.naturalWidth;
    canvas.height = currentImg.naturalHeight;
    ctx.drawImage(currentImg, 0, 0);
    resizePreviewImg.src = url;
    imageToolInfo.textContent = file.name;
  };
};

$("resizePreviewBtn").onclick = () => {
  const w = parseInt(resizeW.value) || currentImg.naturalWidth;
  const h = parseInt(resizeH.value) || currentImg.naturalHeight;

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(currentImg, 0, 0, w, h);
  resizePreviewImg.src = canvas.toDataURL("image/jpeg", 0.92);
};

$("resizeDownloadBtn").onclick = () => {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/jpeg", 0.92);
  a.download = "resized.jpg";
  a.click();
};

/* ================= ENHANCER BASIC PREVIEW ================= */
const enhanceInput = $("enhanceInput");
const dropEnhance = $("dropEnhance");
const beforeImg = $("beforeImg");
const afterImg = $("afterImg");

dropEnhance.onclick = () => enhanceInput.click();

enhanceInput.onchange = e => {
  const file = e.target.files[0];
  const url = URL.createObjectURL(file);
  beforeImg.src = url;
  afterImg.src = url;
};

/* ================= SPLIT HANDLE ================= */
const splitHandle = $("splitHandle");
const splitContainer = document.querySelector(".split-container");
const afterClip = $("afterClip");
let sliding = false;
let splitPos = 0.5;

splitHandle.onmousedown = () => sliding = true;
document.onmouseup = () => sliding = false;

document.onmousemove = e => {
  if (!sliding) return;
  const rect = splitContainer.getBoundingClientRect();
  splitPos = (e.clientX - rect.left) / rect.width;
  splitPos = Math.max(0.05, Math.min(0.95, splitPos));
  afterClip.style.width = splitPos * 100 + "%";
  splitHandle.style.left = splitPos * 100 + "%";
};
