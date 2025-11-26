(() => {

const $ = id => document.getElementById(id);
const AUTH_KEY = "mm_auth";
const PASSWORD = "Meta@123";

const pwModal = $("pwModal");
const pwInput = $("pwInput");
const pwBtn = $("pwBtn");
const pwMsg = $("pwMsg");
const statusText = $("statusText");
const home = $("home");
const enhancer = $("enhancerSection");
const btnEnhancer = $("btnEnhancer");
const backHome = $("backHomeFromEnhancer");

function showSection(name){
  home.style.display = name === "home" ? "flex" : "none";
  enhancer.style.display = name === "enhance" ? "block" : "none";
}

function unlock(){
  if(pwInput.value === PASSWORD){
    localStorage.setItem(AUTH_KEY, "true");
    pwModal.style.display = "none";
    statusText.textContent = "Unlocked";
    showSection("home");
  } else {
    pwMsg.textContent = "Incorrect password";
  }
}

pwBtn.onclick = unlock;
pwInput.onkeydown = e => { if(e.key === "Enter") unlock(); }

if(localStorage.getItem(AUTH_KEY) === "true"){
  pwModal.style.display = "none";
  statusText.textContent = "Unlocked";
  showSection("home");
} else {
  pwModal.style.display = "flex";
}

btnEnhancer.onclick = () => showSection("enhance");
backHome.onclick = () => showSection("home");

/* ---- IMAGE TOOL ---- */
const dropEnhance = $("dropEnhance");
const enhanceInput = $("enhanceInput");
const beforeImg = $("beforeImg");
const afterImg = $("afterImg");

dropEnhance.onclick = () => enhanceInput.click();
enhanceInput.onchange = e =>{
  const file = e.target.files[0];
  if(!file) return;
  const url = URL.createObjectURL(file);
  beforeImg.src = url;
  afterImg.src = url;
};

})();
