
const screen=document.getElementById('screen');
const progress=document.getElementById('progress');
const BRAND_MODELS={"PEUGEOT": ["208", "308", "3008"], "RENAULT": ["Clio", "Mégane", "Captur"], "MERCEDES": ["Classe A", "Classe C"], "VOLKSWAGEN": ["Golf", "Polo"], "AUTRE": []};

let state={immat:'',km:'',marque:'',modele:''};
let step=0;
const steps=['immat','km','marque','modele','done'];

function normalizeImmat(v){
  const raw=(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const m=raw.match(/^([A-Z]{2})([0-9]{3})([A-Z]{2})$/);
  if(!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function showError(m){screen.innerHTML+='<div class="error">'+m+'</div>';}

function render(){
  progress.textContent=`Étape ${step+1}/${steps.length}`;
  if(steps[step]==='immat'){
    screen.innerHTML=`<div class=card><h3>Immatriculation</h3>
    <input id=i placeholder="AB123CD">
    <button onclick=saveImmat()>Suivant</button></div>`;
  } else if(steps[step]==='km'){
    screen.innerHTML=`<div class=card><h3>Kilométrage</h3>
    <input id=k type=number>
    <button onclick=saveKm()>Suivant</button></div>`;
  } else if(steps[step]==='marque'){
    const opts=Object.keys(BRAND_MODELS).map(b=>`<option>${b}</option>`).join('');
    screen.innerHTML=`<div class=card><h3>Marque</h3>
    <select id=m><option></option>${opts}</select>
    <button onclick=saveMarque()>Suivant</button></div>`;
  } else if(steps[step]==='modele'){
    const models=BRAND_MODELS[state.marque]||[];
    const opts=models.map(m=>`<option>${m}</option>`).join('');
    screen.innerHTML=`<div class=card><h3>Modèle</h3>
    <select id=mo><option></option>${opts}</select>
    <button onclick=saveModele()>Suivant</button></div>`;
  } else {
    screen.innerHTML=`<div class=card><pre>${JSON.stringify(state,null,2)}</pre></div>`;
  }
}

function saveImmat(){
  const v=normalizeImmat(document.getElementById('i').value);
  if(!v) return showError('Immatriculation invalide. Format AB-123-CD');
  state.immat=v; step++; render();
}
function saveKm(){ state.km=document.getElementById('k').value; step++; render(); }
function saveMarque(){ state.marque=document.getElementById('m').value; step++; render(); }
function saveModele(){ state.modele=document.getElementById('mo').value; step++; render(); }

render();
