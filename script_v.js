const $ = id => document.getElementById(id);

/* ---------------- AUTH ---------------- */
const PASSWORD="Meta@123";
pwBtn.onclick=()=>{
  if(pwInput.value===PASSWORD){
    pwModal.style.display="none";
    statusText.textContent="Unlocked";
    showSection("home");
  } else pwMsg.textContent="Wrong Password";
};

/* ---------------- NAVIGATION ---------------- */
btnImage.onclick=()=>showSection("resize");
btnEnhancer.onclick=()=>showSection("enhance");
backHomeFromImage.onclick=()=>showSection("home");
backHomeFromEnhancer.onclick=()=>showSection("home");

function showSection(name){
  home.style.display = name==="home"?"flex":"none";
  imageSection.style.display = name==="resize"?"block":"none";
  enhancerSection.style.display = name==="enhance"?"block":"none";
}

/* ---------------- THEME SYSTEM (4 THEMES) ---------------- */
const themeBtn=$("themeBtn");
const themeModal=$("themeModal");
const closeTheme=$("closeTheme");

themeBtn.onclick=()=>themeModal.style.display="flex";
closeTheme.onclick=()=>themeModal.style.display="none";

document.querySelectorAll(".theme-card").forEach(card=>{
  card.onclick=()=>{
    document.body.className="theme-"+card.dataset.theme;
    localStorage.setItem("mm_theme",card.dataset.theme);
    themeModal.style.display="none";
  };
});

const savedTheme=localStorage.getItem("mm_theme")||"flaming-orange";
document.body.className="theme-"+savedTheme;

/* ---------------- AI ENHANCER PREVIEW (NO NEW WINDOW) ---------------- */
enhPreviewBtn.onclick=()=>{
  if(!enhanceCanvas.width) return alert("Upload image first");
  $("previewModal").style.display="flex";
  afterImg.src = enhanceCanvas.toDataURL("image/jpeg",0.92);
  beforeImg.style.display="none";
};

$("closePreview").onclick=()=> $("previewModal").style.display="none";

/* ---------------- TOOLTIP ENGINE ---------------- */
document.querySelectorAll(".help-tip").forEach(t=>{
  t.onmouseenter=()=>{
    const box=document.createElement("div");
    box.className="tooltip-box";
    box.innerText=t.dataset.tip;
    document.body.appendChild(box);
    const r=t.getBoundingClientRect();
    box.style.left=r.left+"px";
    box.style.top=(r.top-40)+"px";
    box.style.display="block";
    t._box=box;
  };
  t.onmouseleave=()=>t._box?.remove();
});
