let step=0;
const screen=document.getElementById('screen');
const data={};
function render(){
screen.innerHTML='';
if(step===0){screen.innerHTML='<h2>Immatriculation</h2><input onchange="save(\'immat\',this.value);next()">';}
else if(step===1){screen.innerHTML='<h2>Kilométrage</h2><input type=number onchange="save(\'km\',this.value);next()">';}
else if(step===2){screen.innerHTML='<h2>Mécano</h2><button onclick="save(\'mecano\',\'Sylvain\');next()">SYLVAIN</button><button onclick="other()">AUTRE</button>'; }
else if(step===3){screen.innerHTML='<h2>100 points</h2><button onclick="next()">100 points effectués</button>'; }
else if(step===4){screen.innerHTML='<h2>Fiche A5</h2><button onclick="next()">Prendre fiche A5</button>'; }
else if(step===5){screen.innerHTML='<h2>BL</h2><button onclick="next()">Prendre BL</button>'; }
else{screen.innerHTML='<h2>Facture</h2><pre>'+JSON.stringify(data,null,2)+'</pre>';}
}
function save(k,v){data[k]=v;}
function next(){step++;render();}
function other(){const n=prompt('Prénom mécano');if(n){save('mecano',n);next();}}
render();
