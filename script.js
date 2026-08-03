const $ = id => document.getElementById(id);
const rows = $("runnerRows");
let lastPrediction = null;

function esc(value){return String(value ?? "").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));}

function renderSources(){
  $("sources").innerHTML = GAUDI_CONFIG.sources.map(([name,url],i)=>`
    <div class="source-item">
      <input type="checkbox" id="src${i}">
      <label for="src${i}" style="display:block;flex:1"><a href="${url}" target="_blank" rel="noopener">${esc(name)} ↗</a></label>
    </div>`).join("");
}

function addRow(data={}){
  const tr=document.createElement("tr");
  tr.innerHTML=`
    <td><input class="num small-input" inputmode="numeric" value="${esc(data.num||"")}"></td>
    <td><input class="name" value="${esc(data.name||"")}"></td>
    <td><input class="odds small-input" inputmode="decimal" value="${esc(data.odds||"")}"></td>
    <td><input class="form" placeholder="e.g. 3124" value="${esc(data.form||"")}"></td>
    <td><input class="barrier small-input" inputmode="numeric" value="${esc(data.barrier||"")}"></td>
    <td><input class="weight small-input" inputmode="decimal" value="${esc(data.weight||"")}"></td>
    <td><input class="jockey small-input" inputmode="decimal" placeholder="0-10" value="${esc(data.jockey||"")}"></td>
    <td><input class="trainer small-input" inputmode="decimal" placeholder="0-10" value="${esc(data.trainer||"")}"></td>
    <td><input class="td small-input" inputmode="decimal" placeholder="0-10" value="${esc(data.td||"")}"></td>
    <td><select class="move"><option>Stable</option><option>Firming</option><option>Drifting</option></select></td>
    <td><input class="scr" type="checkbox"></td>
    <td><button class="remove" title="Remove">✕</button></td>`;
  tr.querySelector(".move").value=data.move||"Stable";
  tr.querySelector(".remove").onclick=()=>tr.remove();
  rows.appendChild(tr);
}

function val(el, fallback=0){const n=parseFloat(el.value);return Number.isFinite(n)?n:fallback;}
function formScore(s){
  const digits=String(s||"").match(/[0-9]/g)||[];
  if(!digits.length)return 4.5;
  const pts=digits.slice(-5).map(d=>d==="0"?1:Math.max(0,11-Number(d)));
  return pts.reduce((a,b)=>a+b,0)/pts.length;
}
function readRunners(){
  return [...rows.querySelectorAll("tr")].map(tr=>({
    num:tr.querySelector(".num").value.trim(),
    name:tr.querySelector(".name").value.trim()||"Unnamed runner",
    odds:val(tr.querySelector(".odds"),99),
    form:tr.querySelector(".form").value.trim(),
    barrier:val(tr.querySelector(".barrier"),8),
    weight:val(tr.querySelector(".weight"),56),
    jockey:Math.min(10,Math.max(0,val(tr.querySelector(".jockey"),5))),
    trainer:Math.min(10,Math.max(0,val(tr.querySelector(".trainer"),5))),
    td:Math.min(10,Math.max(0,val(tr.querySelector(".td"),5))),
    move:tr.querySelector(".move").value,
    scratched:tr.querySelector(".scr").checked
  })).filter(r=>r.num && !r.scratched);
}
function scoreRunner(r){
  const market = r.odds>0 ? Math.max(0, 12 - Math.log(r.odds+1)*3.1) : 0;
  const recent = formScore(r.form);
  const barrier = Math.max(0,10-Math.abs(r.barrier-5)*.7);
  const weight = Math.max(0,10-Math.abs(r.weight-55)*.45);
  const movement = r.move==="Firming"?9:r.move==="Drifting"?3.5:6;
  const raw = market*2.7 + recent*2 + barrier*.7 + weight*.5 + r.jockey*1.3 + r.trainer*1.1 + r.td*1.4 + movement*.8;
  return Math.max(1,Math.min(99,Math.round(raw)));
}
function label(r){return `#${r.num} ${r.name}`;}
function first4Combos(top){
  const a=top.slice(0,5);
  const idx=[[0,1,2,3],[0,1,3,2],[0,2,1,3],[1,0,2,3]];
  return idx.map(x=>x.map(i=>a[i]||a[a.length-1]).filter(Boolean).map(label).join(" → "));
}
function analyse(){
  const runners=readRunners();
  if(runners.length<4){alert("Please enter at least four visible runners.");return;}
  const ranked=runners.map(r=>({...r,score:scoreRunner(r)})).sort((a,b)=>b.score-a.score);
  const spread=ranked[0].score-ranked[Math.min(3,ranked.length-1)].score;
  const confidence=Math.min(90,Math.max(45,55+spread*2));
  const risk=spread>=12?"Lower":spread>=6?"Medium":"High";
  const outsider=ranked.filter(r=>r.odds>=8).sort((a,b)=>b.score-a.score)[0]||ranked[ranked.length-1];

  $("resultHeading").textContent=`${$("track").value||"Race"} ${$("raceNo").value?`R${$("raceNo").value}`:""} selections`;
  $("confidence").textContent=`${confidence}%`;
  $("risk").textContent=risk;
  $("rankings").innerHTML=ranked.slice(0,3).map((r,i)=>`
    <article class="rank-card">
      <div class="rank-num">RANK ${i+1}</div>
      <h3>${esc(label(r))}</h3>
      <div class="score">${r.score}/99</div>
      <p>Odds ${esc(r.odds)} • Barrier ${esc(r.barrier)} • Form ${esc(r.form||"N/A")}</p>
    </article>`).join("");

  $("singleWin").textContent=label(ranked[0]);
  $("exacta").textContent=`${label(ranked[0])} → ${label(ranked[1])}`;
  $("exactaBox").textContent=`${label(ranked[0])}, ${label(ranked[1])}`;
  $("trifecta").textContent=`${label(ranked[0])} → ${label(ranked[1])} → ${label(ranked[2])}`;
  $("trifectaBox").textContent=ranked.slice(0,3).map(label).join(", ");
  $("outsider").textContent=label(outsider);
  const combos=first4Combos(ranked);
  $("first4").innerHTML=combos.map(c=>`<li>${esc(c)}</li>`).join("");

  lastPrediction={ranked,confidence,risk,combos};
  $("resultsCard").classList.remove("hidden");
  $("resultsCard").scrollIntoView({behavior:"smooth"});
}
function resultText(){
  if(!lastPrediction)return "";
  const r=lastPrediction.ranked;
  return [
    `${$("track").value||"Race"} ${$("raceNo").value?`R${$("raceNo").value}`:""}`,
    `Confidence: ${lastPrediction.confidence}% | Risk: ${lastPrediction.risk}`,
    `Single Win: ${label(r[0])}`,
    `Exacta: ${label(r[0])} → ${label(r[1])}`,
    `Exacta Box: ${label(r[0])}, ${label(r[1])}`,
    `Trifecta: ${label(r[0])} → ${label(r[1])} → ${label(r[2])}`,
    `Trifecta Box: ${r.slice(0,3).map(label).join(", ")}`,
    `First 4:\n${lastPrediction.combos.map((x,i)=>`${i+1}. ${x}`).join("\n")}`,
    `Best outsider: ${$("outsider").textContent}`,
    `Prediction only — no guarantee.`
  ].join("\n");
}
function compare(){
  if(!lastPrediction)return;
  const official=$("officialResult").value.split(/[,>\-\s]+/).filter(Boolean);
  if(official.length<3){$("comparison").textContent="Enter at least the first three official horse numbers.";return;}
  const picks=lastPrediction.ranked.map(r=>r.num);
  const win=picks[0]===official[0];
  const exacta=picks[0]===official[0]&&picks[1]===official[1];
  const trifecta=picks.slice(0,3).join(",")===official.slice(0,3).join(",");
  const box3=official.slice(0,3).every(n=>picks.slice(0,3).includes(n));
  $("comparison").innerHTML=`<p><strong>Single Win:</strong> ${win?"Won":"Lost"}<br>
  <strong>Exacta:</strong> ${exacta?"Won":"Lost"}<br><strong>Trifecta:</strong> ${trifecta?"Won":"Lost"}<br>
  <strong>Trifecta Box:</strong> ${box3?"Won":"Lost"}</p>`;
}

$("addRunner").onclick=()=>addRow();
$("analyse").onclick=analyse;
$("clear").onclick=()=>{if(confirm("Clear all entered runners?")){rows.innerHTML="";for(let i=0;i<6;i++)addRow();$("resultsCard").classList.add("hidden");}};
$("copyResults").onclick=async()=>{try{await navigator.clipboard.writeText(resultText());alert("Prediction summary copied.");}catch{alert("Copy failed. Select and copy manually.");}};
$("compare").onclick=compare;
$("screenshot").onchange=e=>{const f=e.target.files[0];if(!f)return;const img=$("preview");img.src=URL.createObjectURL(f);img.classList.remove("hidden");};

renderSources();
for(let i=0;i<6;i++)addRow();
if("serviceWorker" in navigator){window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js").catch(()=>{}));}
