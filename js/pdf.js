/* PDF-Export: befüllt das offizielle freebooters.org-Rostersheet. */
import { DRAMATIS, HIREDSWORDS, MAXPROF, SHEET, WARBANDS } from '../data/index.js';
import { HR, S, aDisp, dl, dpRatingTotal, effProfile, enItem, enRules, eqDisplayParts, eqListFor, houseDeviations, hsChosenEq, hsEqParts, hsEquipOn, hsExp, hsRatingTotal, isHeroModel, isLeaderModel, leaderRuleText, markRulesFor, maxInfo, raceEN, safeName, skillText, spellLabel, svLabel, svOfEntry, svOfModel, totalLarge, totalModels, totalRating, unitDef } from './app.js';

/* Cache for the roster-sheet PDF template bytes. Local to this module because
   loadSheetTemplate() assigns to it — an imported binding would be read-only. */
let _sheetBytes = null;

function _sheetTxt(pg,f,s,x,top,size,opt){ opt=opt||{};
  if(s==null||s==='') return;
  pg.drawText(String(s),{x:opt.center?x-f.widthOfTextAtSize(String(s),size)/2:(opt.right?x-f.widthOfTextAtSize(String(s),size):x),
    y:SHEET.H-top, size, font:f}); }

function _sheetWrap(pg,f,s,x,top,w,size,lh,maxLines){
  if(!s) return; const words=String(s).split(/\s+/); let line='',n=0;
  for(const wd of words){ const t=line?line+' '+wd:wd;
    if(f.widthOfTextAtSize(t,size)>w && line){ _sheetTxt(pg,f,line,x,top+n*lh,size); n++; line=wd;
      if(maxLines&&n>=maxLines){ return; } }
    else line=t; }
  if(line&&(!maxLines||n<maxLines)) _sheetTxt(pg,f,line,x,top+n*lh,size); }

function _sheetWrapCount(pg,f,s,x,top,w,size,lh){
  if(!s) return 0; const words=String(s).split(/\s+/); let line='',n=0;
  for(const wd of words){ const t=line?line+' '+wd:wd;
    if(f.widthOfTextAtSize(t,size)>w && line){ _sheetTxt(pg,f,line,x,top+n*lh,size); n++; line=wd; }
    else line=t; }
  if(line){ _sheetTxt(pg,f,line,x,top+n*lh,size); n++; }
  return n; }

function _sheetStats(pg,f,p,top,size,sv){ const k=["M","WS","BS","S","T","W","I","A","Ld"];
  k.forEach((key,i)=>_sheetTxt(pg,f,(p&&p[key]!==undefined)?p[key]:'',SHEET.statX[i],top,size,{center:true}));
  if(sv!==undefined&&sv!==null) _sheetTxt(pg,f,sv,SHEET.statX[9],top,size,{center:true}); }

function _sheetXPboxes(pg,f,xp,blockTop,cfg,rowTops){ if(!xp||xp<=0) return; let n=0;
  const {rgb}=PDFLib; const sz=cfg.size||6.6, ins=1.1;
  for(const rt of rowTops){ for(const x of cfg.xs){ if(n>=xp) return;
    pg.drawRectangle({x:x-sz/2+ins, y:SHEET.H-(blockTop+rt)-sz+ins, width:sz-2*ins, height:sz-2*ins, color:rgb(0,0,0)});
    n++; } } }

function _sheetEqPerModel(m){
  const def=unitDef(m.uid_def); const out=[]; const q=Math.max(1,Number(m.qty)||1);
  if(def.gear) def.gear.forEach(g=>out.push(g));
  if(def.eq){ const list=eqListFor(def);
    for(const cat in list) for(const [nm] of list[cat]){
      const tot=Number((m.eq||{})[nm])||0; if(!tot) continue;
      const per=Math.max(1,Math.round(tot/q));
      out.push(per>1?(enItem?enItem(nm):nm)+' \u00d7'+per:(enItem?enItem(nm):nm)); } }
  return out; }

async function loadSheetTemplate(){
  if(_sheetBytes) return _sheetBytes;
  if(typeof SHEET_TPL_B64!=='undefined' && SHEET_TPL_B64)
    _sheetBytes=Uint8Array.from(atob(SHEET_TPL_B64),c=>c.charCodeAt(0));
  else {
    const r=await fetch(new URL('../assets/sheet.pdf', import.meta.url));
    _sheetBytes=new Uint8Array(await r.arrayBuffer());
  }
  return _sheetBytes; }

function defaultWarbandName(){ const wb=WARBANDS[S.wb]; if(!wb) return 'Warband';
  const sub=(S.subtype&&wb.subtypes)?(wb.subtypes.find(x=>x.key===S.subtype)||{}).name:'';
  return sub?`${sub} ${wb.name}`:wb.name; }

async function exportOfficialSheet(){
  if(!S.wb){ alert('Choose a warband first.'); return; }
  if(typeof PDFLib==='undefined'){ alert('PDF library not loaded.'); return; }
  const {PDFDocument,StandardFonts}=PDFLib;
  const bytes=await loadSheetTemplate();
  const tpl=await PDFDocument.load(bytes);
  const doc=await PDFDocument.create();
  const f=await doc.embedFont(StandardFonts.Helvetica);
  const fb=await doc.embedFont(StandardFonts.HelveticaBold);

  const NOTES=new Map();
  // Sort by the unit's fixed position in the warband's roster list (WARBANDS[wb].units),
  // NOT by recruitment order — e.g. a Marauder Chieftain must print before a Seer even if
  // the Seer was added to the warband first. Ties (several models of the same unit) keep
  // their relative recruitment order via a stable sort.
  const _rosterOrder=(WARBANDS[S.wb]&&WARBANDS[S.wb].units)||[];
  const _orderIdx=(m)=>{ const i=_rosterOrder.findIndex(u=>u.id===m.uid_def); return i<0?_rosterOrder.length:i; };
  const _byRosterOrder=(a,b)=>_orderIdx(a)-_orderIdx(b);
  const heroes=S.models.filter(m=>isHeroModel(m)).sort(_byRosterOrder);
  const hench=S.models.filter(m=>!isHeroModel(m)&&!unitDef(m.uid_def).vehicle).sort(_byRosterOrder);
  const veh=S.models.filter(m=>unitDef(m.uid_def).vehicle).sort(_byRosterOrder);
  const dpAll=(S.dp||[]).map(d=>({rec:d,e:DRAMATIS[d.key],kind:'Dramatis Personae'}));
  const hsAll=(S.hired||[]).map(h=>({rec:h,e:HIREDSWORDS[h.key],kind:'Hired Sword'}));
  const extra=[...dpAll,...hsAll];

  const wbName=WARBANDS[S.wb]?WARBANDS[S.wb].name:'';
  const sub=(S.subtype&&WARBANDS[S.wb]&&WARBANDS[S.wb].subtypes)?(WARBANDS[S.wb].subtypes.find(x=>x.key===S.subtype)||{}).name:'';
  const wbType=wbName+(sub?' ('+sub+')':'');

  /* ---- Seite 1 (Helden) + ggf. weitere ---- */
  const heroPages=Math.max(1,Math.ceil(heroes.length/6));
  for(let pi=0;pi<heroPages;pi++){
    const [pg]=await doc.copyPages(tpl,[0]); doc.addPage(pg);
    _sheetTxt(pg,fb,S.name||defaultWarbandName(),180,50,11);
    _sheetTxt(pg,f,wbType,447,50,9);
    if(pi===0){
      _sheetTxt(pg,f,(S.stash&&S.stash.gold)||0,106,83,9);
      _sheetTxt(pg,f,((S.stash&&S.stash.wyrd)||0)+' wyrdstone',88,100,8);
      const gx=S.models.reduce((t,m)=>t+((m.exp||0)*(m.qty||1)),0);
      _sheetTxt(pg,f,gx,357,78,9,{right:true});
      // Large creatures are worth 20 INSTEAD of 5 (mordheimer, Warband
      // Rating), so the members x5 line excludes them - the line items then
      // sum to the printed rating. Counted by flag, not by text-matching the
      // rules blurb (which falsely caught the Trade Wagon and the Maneaters'
      // "is NOT a Large Target" youths).
      const lg=totalLarge();
      _sheetTxt(pg,f,totalModels()-lg,233,90,8,{center:true});
      _sheetTxt(pg,f,(totalModels()-lg)*5,357,90,9,{right:true});
      _sheetTxt(pg,f,lg,264,101,8,{center:true});
      _sheetTxt(pg,f,lg*20,357,101,9,{right:true});
      _sheetTxt(pg,f,typeof hsRatingTotal==='function'?hsRatingTotal():0,357,112,9,{right:true});
      _sheetTxt(pg,f,typeof dpRatingTotal==='function'?dpRatingTotal():0,357,124,9,{right:true});
      _sheetTxt(pg,fb,totalRating(),357,139,11,{right:true});
      const items=((S.stash&&S.stash.items)||[]).map(i=>typeof i==='string'?i:(i.name||'')).filter(Boolean);
      _sheetWrap(pg,f,items.join(', '),420,76,148,6,7,10);
    }
    heroes.slice(pi*6,pi*6+6).forEach((m,i)=>{
      const T=SHEET.heroTops[i], def=unitDef(m.uid_def);
      _sheetTxt(pg,fb,m.name||def.name,79,T+10,9);
      const _mi0=maxInfo(m);
      const _race=_mi0?raceEN(_mi0.key):'';
      _sheetTxt(pg,f,def.name,69,T+24,8);
      const sk=(def.sk||[]).map(x=>String(x).toLowerCase());
      [['combat',44],['shooting',72],['academic',102],['strength',135],['speed',164]].forEach(([k,x])=>{
        if(sk.includes(k)) _sheetTxt(pg,fb,'x',x,T+37,7,{center:true}); });
      if(def.sksp||(def.sk||[]).some(x=>!['combat','shooting','academic','strength','speed'].includes(String(x).toLowerCase())))
        _sheetTxt(pg,fb,'x',189,T+37,7,{center:true});
      const p=effProfile(m)||{}; const pp=Object.assign({},p); pp.A=aDisp(m,p);
      _sheetStats(pg,f,pp,T+65,9,svLabel(svOfModel(m)));
      const mi=maxInfo(m); if(mi&&mi.prof) _sheetStats(pg,f,mi.prof,T+75,6.5);
      _sheetWrap(pg,f,eqDisplayParts(m).join(', '),222,T+16,170,5.5,6.5,5);
      const inj=(m.inj||[]).map(j=>j.name||j.code);
      inj.forEach((t,n)=>{ if(n<6) _sheetWrap(pg,f,t,220,T+58+n*10.5,28,5,5,2); });
      const _isLeader=(typeof isLeaderModel==='function')?isLeaderModel(m):/\bLeader:/.test(def.sp||'');
      const _mk=(typeof markRulesFor==='function')?markRulesFor(m):[];
      _mk.forEach(x=>NOTES.set(x[0],x[1]));
      const sp=[...(_isLeader?['Leader']:[]),..._mk.map(x=>x[0]),...(m.skills||[]),...((m.spells||[]).map(x=>spellLabel(x.name)))];
      sp.forEach(nm=>{ const t=(typeof skillText==='function')?skillText(nm):''; if(t) NOTES.set(nm,t); });
      if(_isLeader && typeof leaderRuleText==='function') NOTES.set('Leader',leaderRuleText());
      _sheetWrap(pg,f,sp.join(', '),400,T+16,172,6,7,5);
      _sheetTxt(pg,fb,m.exp||0,546,T+90,10,{center:true});
      _sheetXPboxes(pg,f,m.exp||0,T,SHEET.heroXP,SHEET.heroXP.rows);
    });
  }

  /* ---- Seite 2 (Henchmen) + Zusatzblatt (DP & HS, gleiches Layout) ---- */
  const allHen=[...hench,...veh];
  const henPages=Math.max(1,Math.ceil(allHen.length/7));
  const exPages=Math.ceil(extra.length/7);
  for(let pi=0;pi<henPages+exPages;pi++){
    const [pg]=await doc.copyPages(tpl,[1]); doc.addPage(pg);
    const isEx=pi>=henPages;
    if(isEx){
      const slice=extra.slice((pi-henPages)*7,(pi-henPages)*7+7);
      slice.forEach((x,i)=>{
        const T=SHEET.henTops[i], e=x.e; if(!e) return;
        _sheetTxt(pg,fb,(x.rec.name||e.name),79,T+10,9);
        const rl=raceEN(e.race);
        _sheetTxt(pg,f,e.name,69,T+23,8);
        const kw=x.kind==='Hired Sword'?['Hired','Sword']:['Dramatis','Personae'];
        _sheetTxt(pg,f,kw[0],186,T+19,5.5);
        _sheetTxt(pg,f,kw[1],186,T+25,5.5);
        _sheetStats(pg,f,e.profile||{},T+51,9,svLabel(svOfEntry(e,x.rec)));
        if(e.pair&&e.profile2) _sheetStats(pg,f,e.profile2.p||{},T+60,6.5);
        else if(e.race&&typeof MAXPROF!=='undefined'&&MAXPROF[e.race]) _sheetStats(pg,f,MAXPROF[e.race],T+60,6.5);
        let eq=(typeof hsChosenEq==='function')?hsChosenEq(x.rec,e):(e.eq||'');
        if(typeof hsEquipOn==='function'&&hsEquipOn()){ const ex2=hsEqParts(x.rec); if(ex2.length) eq+=', '+ex2.join(', '); }
        _sheetWrap(pg,f,eq,222,T+15,170,5.5,6.5,4);
        const meta=e.name+' ('+e.grade+') \u00b7 '+(e.hire>0?'Hire '+e.hire+' gc':'Hire: special')+(e.upkeep>0?', Upkeep '+e.upkeep+' gc':'')+' \u00b7 Rating +'+e.rating+'. ';
        const allSk=[...(e.skills||[]),...((x.rec.skills)||[])];
        allSk.forEach(nm=>{ const t=(typeof skillText==='function')?skillText(nm,e):''; if(t) NOTES.set(nm,t); });
        const ruleNames=enRules(e.sp||'').map(r=>r.split(':')[0]).filter(Boolean);
        _sheetWrap(pg,f,[...allSk,...ruleNames].join(', '),400,T+15,172,6,7,6);
        const xpv=(x.kind==='Hired Sword'&&typeof hsExp==='function')?hsExp(x.rec):0;
        _sheetTxt(pg,fb,e.noXP?'\u2014':xpv,487,T+62,9);
        if(!e.noXP&&xpv>0) _sheetXPboxes(pg,f,xpv,T,SHEET.henXP,[SHEET.henXP.top]);
      });
      continue;
    }
    allHen.slice(pi*7,pi*7+7).forEach((m,i)=>{
      const T=SHEET.henTops[i], def=unitDef(m.uid_def);
      _sheetTxt(pg,fb,m.name||def.name,79,T+10,9);
      const _mh=maxInfo(m); const _rh=_mh?raceEN(_mh.key):'';
      _sheetTxt(pg,f,def.name,69,T+23,8);
      _sheetTxt(pg,f,m.qty||1,187,T+23,8);
      const p=effProfile(m)||{}; const pp=Object.assign({},p); if(p&&Object.keys(p).length) pp.A=aDisp(m,p);
      if(!def.vehicle) _sheetStats(pg,f,pp,T+51,9,svLabel(svOfModel(m)));
      const mi=maxInfo(m); if(mi&&mi.prof&&!def.vehicle) _sheetStats(pg,f,mi.prof,T+60,6.5);
      _sheetWrap(pg,f,_sheetEqPerModel(m).join(', '),222,T+15,170,5.5,6.5,4);
      const rules=enRules(def.sp).map(r=>r.split(':')[0]);
      (m.skills||[]).forEach(nm=>{ const t=(typeof skillText==='function')?skillText(nm):''; if(t) NOTES.set(nm,t); });
      _sheetWrap(pg,f,[...(m.skills||[]),...rules].filter(Boolean).join(', '),400,T+15,172,6,7,6);
      _sheetTxt(pg,fb,m.exp||0,487,T+62,9);
      _sheetXPboxes(pg,f,m.exp||0,T,SHEET.henXP,[SHEET.henXP.top]);
    });
    if(pi===henPages-1){
      _sheetTxt(pg,fb,allHen.reduce((s,m)=>s+(m.exp||0),0),540,558,11,{center:true});
      const notes=[];
      [...NOTES.entries()].forEach(([nm,t])=>notes.push(nm+': '+String(t).replace(/<[^>]+>/g,'')));
      S.models.filter(m=>(m.inj||[]).length).forEach(m=>notes.push('INJURY \u2014 '+(m.name||unitDef(m.uid_def).name)+': '+(m.inj||[]).map(j=>j.name||j.code).join(', ')));
      if(typeof houseDeviations==='function'){ houseDeviations().forEach(function(x){ notes.push('HOUSE RULE \u2014 '+x.label+': '+x.value); }); }
      else if(HR&&HR().notes) notes.push('HOUSE RULES: '+HR().notes);
      let ny=586;
      for(const line of notes){ if(ny>700) break;
        const used=_sheetWrapCount(pg,f,line,44,ny,520,6,7.2);
        ny+=used*7.2+1; }
    }
  }
  const out=await doc.save();
  dl(out,(typeof safeName==='function'?safeName():'warband')+'_official_sheet.pdf','application/pdf');
}

export { loadSheetTemplate, defaultWarbandName, exportOfficialSheet };
