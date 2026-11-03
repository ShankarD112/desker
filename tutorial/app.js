(() => {
"use strict";
const $ = id => document.getElementById(id);
const STORE = "desker-fastq-tutorial-v1";
const assets = {};
let runs = [], selected = null, counter = 0;
try { runs = JSON.parse(localStorage.getItem(STORE) || "[]"); } catch { runs = []; }
counter = Math.max(0, ...runs.map(r => Number(r.number) || 0));
const keep = () => localStorage.setItem(STORE, JSON.stringify(runs));
const parseFASTA = text => {
  const result = {}; let name = null;
  for (const raw of text.trim().split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith(">")) { name = line.slice(1).split(/\s+/)[0]; result[name] = ""; }
    else if (name && line) result[name] += line.toUpperCase();
  }
  return result;
};
const parseFASTQ = text => {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length % 4) throw Error("Malformed FASTQ: incomplete record.");
  const out = [];
  for (let i = 0; i < lines.length; i += 4) {
    const [head,seq,plus,quality] = lines.slice(i,i+4);
    if (!head.startsWith("@") || !plus.startsWith("+") || quality.length !== seq.length) throw Error("Malformed FASTQ near line "+(i+1));
    out.push({name:head.slice(1).split(/\s+/)[0],seq:seq.toUpperCase()});
  }
  return out;
};
function align(read, genome, allowed) {
  let only = null, hits = 0;
  for (const [chrom, reference] of Object.entries(genome)) {
    for (let pos = 0; pos <= reference.length - read.length; pos++) {
      let mismatches = 0;
      for (let k = 0; k < read.length; k++) {
        if (read[k] !== reference[pos+k] && ++mismatches > allowed) break;
      }
      if (mismatches <= allowed) {
        hits++; only = {chrom,pos,mismatches};
        if (hits > 1) return {status:"ambiguous"};
      }
    }
  }
  return only ? {status:"mapped",...only} : {status:"unmapped"};
}
function execute(config) {
  const genome = assets[config.reference];
  const counts = Object.fromEntries(Object.keys(genome).map(x=>[x,0]));
  const mapped = []; const failures = [];
  let trimmed = 0, ambiguous = 0;
  for (const r of assets.reads) {
    const sequence = config.trim && r.seq.endsWith("GGGGGG") ? r.seq.slice(0,-6) : r.seq;
    if (sequence.length !== r.seq.length) trimmed++;
    const hit = align(sequence,genome,config.mismatches);
    if (hit.status === "mapped") { counts[hit.chrom]++; mapped.push({name:r.name,chrom:hit.chrom,pos:hit.pos,mismatches:hit.mismatches}); }
    else { failures.push({name:r.name,status:hit.status}); if (hit.status === "ambiguous") ambiguous++; }
  }
  return {counts,mapped:mapped.length,unmapped:failures.length-ambiguous,ambiguous,trimmed,total:assets.reads.length,failures,mapping:mapped};
}
function desc(r) {
  return r.reference.toUpperCase()+" · "+(r.trim?"trimmed":"untrimmed")+" · "+r.mismatches+" mismatches";
}
function newRun(config,parent=null) {
  const result=execute(config);
  const number=++counter;
  const run={id:"run-"+Date.now()+"-"+number,number,parent,created:new Date().toISOString(),...config,result};
  runs.push(run);
  selected=run.id;
  keep(); redraw(); return run;
}
function setFrom(r) {
  $("reference").value=r.reference;
  $("trim").value=r.trim?"yes":"no";
  $("mismatches").value=String(r.mismatches);
  $("base").value=r.id;
}
function runById(id) { return runs.find(r=>r.id===id); }
function signed(n) { return n>0?"+"+n:String(n); }
function compare() {
  const a=runById($("compareA").value),b=runById($("compareB").value);
  if (!a || !b) { $("diff").textContent="Make two runs to compare actual results."; return; }
  $("diff").innerHTML="";
  const label=document.createElement("div");
  label.textContent="Run #"+a.number+" → #"+b.number;
  label.style.fontWeight="750";
  $("diff").append(label);
  const summary=document.createElement("p");
  summary.textContent="Mapped reads: "+a.result.mapped+" → "+b.result.mapped+" ("+signed(b.result.mapped-a.result.mapped)+").";
  $("diff").append(summary);
  for(const chrom of Object.keys(a.result.counts)){
    const line=document.createElement("div");
    line.style.padding="4px 0";
    line.textContent=chrom+": "+a.result.counts[chrom]+" → "+b.result.counts[chrom]+" ("+signed(b.result.counts[chrom]-a.result.counts[chrom])+")";
    $("diff").append(line);
  }
  const overlapA=new Set(a.result.mapping.map(v=>v.name+"@"+v.chrom+":"+v.pos));
  const overlapB=new Set(b.result.mapping.map(v=>v.name+"@"+v.chrom+":"+v.pos));
  const gained=[...overlapB].filter(v=>!overlapA.has(v)).length;
  const lost=[...overlapA].filter(v=>!overlapB.has(v)).length;
  const note=document.createElement("p");
  note.textContent="New mapped placements: "+gained+"; lost/changed placements: "+lost+". These are actual computed alignment differences, not statistical significance tests.";
  $("diff").append(note);
}
function inspect() {
  const r=runById(selected);
  if(!r){
    $("heading").textContent="Tutorial results";
    $("explain").textContent="Use the controls to run an analysis. Each result is calculated from the 100-read FASTQ and chosen FASTA.";
    $("summary").innerHTML="";
    return;
  }
  $("heading").textContent="Run #"+r.number+" · "+r.result.mapped+" mapped";
  $("explain").textContent=desc(r)+". "+(r.parent?"Forked from run #"+(runById(r.parent)?.number??"?")+".":"Started from raw reads.");
  const mappedRatio=100*r.result.mapped/r.result.total;
  $("summary").innerHTML='<div class="metric"><span class="eyebrow">Mapped reads</span><b>'+r.result.mapped+' / '+r.result.total+'</b><span class="good">'+mappedRatio.toFixed(1)+'% mapping</span><div class="bar"><div class="fill" style="width:'+mappedRatio+'%"></div></div></div><div class="metric"><span class="eyebrow">Preprocessing / mapping</span><p>Adapter-trimmed: '+r.result.trimmed+'<br>Unmapped: '+r.result.unmapped+'<br>Ambiguous: '+r.result.ambiguous+'</p></div><div class="metric"><span class="eyebrow">Counts per gene</span><table><tbody>'+Object.entries(r.result.counts).map(([k,v])=>'<tr><td>'+k+'</td><td>'+v+'</td></tr>').join('')+'</tbody></table></div><div class="tiny">This is a synthetic educational benchmark; reference chromosomes correspond to simplified gene regions. No gene expression statistics are inferred.</div>';
}
function makeCard(id,x,y,title,description,klass="",run=null) {
  const el=document.createElement("div");
  el.className="card "+klass+(selected===id?" active":"");
  el.dataset.id=id;el.style.left=x+"px";el.style.top=y+"px";
  const h=document.createElement("h3"),p=document.createElement("p"),m=document.createElement("div");
  h.textContent=title;p.textContent=description;m.className="mini";m.textContent=run?run.result.mapped+" / "+run.result.total+" mapped":"Input artifact";
  el.append(h,p,m);
  let dragging=null;
  el.addEventListener("pointerdown",e=>{if(e.button!==0)return; dragging={x:e.clientX,y:e.clientY,l:parseFloat(el.style.left),t:parseFloat(el.style.top),moved:false};el.setPointerCapture(e.pointerId);});
  el.addEventListener("pointermove",e=>{if(!dragging)return;const dx=e.clientX-dragging.x,dy=e.clientY-dragging.y;if(Math.abs(dx)+Math.abs(dy)>4)dragging.moved=true;el.style.left=(dragging.l+dx)+"px";el.style.top=(dragging.t+dy)+"px";connect();});
  el.addEventListener("pointerup",()=>{if(!dragging)return;if(!dragging.moved && run){selected=id;setFrom(run);redraw();}dragging=null;});
  $("cards").append(el);
}
function connect() {
  const svg=$("edges");svg.innerHTML="";
  const cards=Array.from(document.querySelectorAll(".card"));
  const locate=id=>cards.find(c=>c.dataset.id===id);
  const edge=(a,b,dashed)=>{
    const x=locate(a),y=locate(b);if(!x||!y)return;
    const sx=x.offsetLeft+192,sy=x.offsetTop+45,ex=y.offsetLeft,ey=y.offsetTop+45;
    const p=document.createElementNS("http://www.w3.org/2000/svg","path");
    p.setAttribute("d","M"+sx+" "+sy+" C"+(sx+55)+" "+sy+" "+(ex-55)+" "+ey+" "+ex+" "+ey);
    p.setAttribute("stroke",dashed?"#d2aa72":"#586fa0");p.setAttribute("stroke-width","2");
    p.setAttribute("fill","none");if(dashed)p.setAttribute("stroke-dasharray","5 5");
    svg.append(p);
  };
  edge("fastq","align");edge("ref","align");edge("align","counts");
  for(const r of runs) edge(r.parent||"counts",r.id,true);
}
function renderCards() {
  $("cards").innerHTML="";
  makeCard("fastq",45,105,"▤ reads_100.fastq","100 synthetic reads · validated FASTQ");
  makeCard("ref",45,275,"▥ Reference FASTA","v1 and v2 differ by one base");
  makeCard("align",325,180,"⌘ Teaching aligner","Actual forward-strand matching");
  makeCard("counts",580,180,"▦ Gene counts","Mapped reads counted by contig");
  runs.forEach((r,i)=>{
    const depth=(()=>{let d=0,p=r.parent;while(p&&d<8){d++;p=runById(p)?.parent;}return d})();
    makeCard(r.id,840+depth*32,35+i*132,"⑂ Run #"+r.number,desc(r),"branch",r);
  });
  connect();
}
function populateSelect(el,includeEmpty=false) {
  const selectedVal=el.value;
  el.innerHTML="";
  if(includeEmpty){const opt=new Option("New branch from raw FASTQ","");el.add(opt);}
  for(const r of runs) el.add(new Option("#"+r.number+" · "+desc(r),r.id));
  if([...el.options].some(o=>o.value===selectedVal)) el.value=selectedVal;
}
function redraw() {
  populateSelect($("base"),true);
  populateSelect($("compareA"));
  populateSelect($("compareB"));
  if(runs.length>1 && $("compareA").value===$("compareB").value) $("compareB").value=runs[runs.length-1].id;
  $("runs").innerHTML="";
  for(const r of [...runs].reverse()){
    const block=document.createElement("div");block.className="result"+(r.id===selected?" active":"");
    const heading=document.createElement("strong");heading.textContent="Run #"+r.number+" · "+r.result.mapped+"/"+r.result.total+" mapped";
    const p=document.createElement("p");p.textContent=desc(r);
    const btn=document.createElement("button");btn.textContent="Inspect & branch";btn.style.marginTop="7px";
    btn.onclick=()=>{selected=r.id;setFrom(r);redraw();};
    block.append(heading,p,btn);$("runs").append(block);
  }
  inspect();compare();renderCards();
}
$("run").onclick=()=>{
  if(!assets.reads){$("status").textContent="Example files haven't loaded.";return;}
  const config={reference:$("reference").value,trim:$("trim").value==="yes",mismatches:Number($("mismatches").value)};
  newRun(config,$("base").value||null);
  $("status").textContent="Computed "+runs.length+" saved analysis branches in your browser.";
};
$("base").onchange=()=>{const r=runById($("base").value);if(r){$("reference").value=r.reference;$("trim").value=r.trim?"yes":"no";$("mismatches").value=r.mismatches;}};
$("preset").onclick=()=>{
  if(!assets.reads)return;
  runs=[];counter=0;
  const a=newRun({reference:"v1",trim:false,mismatches:0});
  newRun({reference:"v1",trim:true,mismatches:0},a.id);
  newRun({reference:"v2",trim:false,mismatches:0},a.id);
  const both=newRun({reference:"v2",trim:true,mismatches:0},a.id);
  selected=both.id;setFrom(both);$("compareA").value=a.id;$("compareB").value=both.id;keep();redraw();
  $("status").textContent="Four independent analyses computed; click any branch to revisit it.";
};
$("clear").onclick=()=>{if(!confirm("Remove saved tutorial branches in this browser?"))return;runs=[];counter=0;selected=null;keep();redraw();};
$("compareA").onchange=compare;$("compareB").onchange=compare;
(async()=>{
  try{
    const paths=["./tutorial/reads_100.fastq","./tutorial/reference_v1.fa","./tutorial/reference_v2.fa"];
    const texts=await Promise.all(paths.map(async p=>{const response=await fetch(p);if(!response.ok)throw Error("Could not fetch "+p+" ("+response.status+")");return response.text();}));
    assets.reads=parseFASTQ(texts[0]);assets.v1=parseFASTA(texts[1]);assets.v2=parseFASTA(texts[2]);
    $("nreads").textContent=assets.reads.length+" FASTQ reads loaded";
    $("status").textContent="Ready: real FASTQ and FASTA inputs. Run a branch.";
    if(runs.length){
      // Recompute stored runs from currently loaded assets rather than trusting stale cached results.
      for(const r of runs)r.result=execute({reference:r.reference,trim:r.trim,mismatches:r.mismatches});
      selected=runs[runs.length-1].id;keep();
    }
    redraw();
  }catch(error){
    $("nreads").textContent="Could not load files";
    $("status").textContent=error.message+" · Serve the repo over HTTP (python3 -m http.server 8000).";
    $("run").disabled=true;$("preset").disabled=true;
  }
})();
})();