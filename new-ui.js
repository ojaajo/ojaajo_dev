// New UI data bridge — card and list progress share Supabase persistence.
let lists={},listNames={},currentList='beginner',rangeStart=1,rangeEnd=1;
let showKo=true,showJa=true,allExamples=true,shuffleEnabled=false;
const WORDS_PER_PAGE=80;
const names=[['beginner','初級','beginnerWords'],['intermediate','中級','intermediateWords'],['advanced','上級','advancedWords'],['expressionup','表現力UP','expressionUpWords']];
function el(id){return document.getElementById(id)}
function safeText(id,s){if(el(id))el(id).textContent=s}
// Step 37: device-only view snapshots. No vocabulary or progress is stored here.
const LIST_VIEW_STORE='ojaajo.listViews.v1';
const LAST_VIEW_STORE='ojaajo.lastView.v1';
let listViewSnapshots={};
let initialViewRestored=false;
let restoringListView=false;
let viewSaveTimer=null;
try{const saved=JSON.parse(localStorage.getItem(LIST_VIEW_STORE)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))listViewSnapshots=saved}catch(e){console.warn('表示状態を読み込めませんでした',e)}
function saveListView(){
 if(restoringListView||el('listWordsView')?.hidden||!currentList)return;
 const root=el('appRoot');
 listViewSnapshots[currentList]={
  rangeStart,rangeEnd,search:el('search')?.value||'',searchOpen:!el('listSearchPanel')?.hidden,
  showKo,showJa,allExamples,shuffleEnabled,
  statuses:[...document.querySelectorAll('.dynamicStatusFilter:checked')].map(c=>c.value),
  scrollTop:root?.scrollTop||0,selectedWordIndex,
  pageRangeOpen:!el('pageRangePanel')?.hidden,settingsOpen:!el('listSettingsPanel')?.hidden
 };
 try{localStorage.setItem(LIST_VIEW_STORE,JSON.stringify(listViewSnapshots));localStorage.setItem(LAST_VIEW_STORE,JSON.stringify({page:'list',listKey:currentList}))}catch(e){console.warn('表示状態を保存できませんでした',e)}
}
function scheduleListViewSave(){if(restoringListView)return;clearTimeout(viewSaveTimer);viewSaveTimer=setTimeout(saveListView,180)}
function rememberPage(page){try{localStorage.setItem(LAST_VIEW_STORE,JSON.stringify({page}))}catch(e){}}
function restoreInitialView(){
 if(initialViewRestored)return;
 initialViewRestored=true;
 let previous;try{previous=JSON.parse(localStorage.getItem(LAST_VIEW_STORE)||'null')}catch(e){}
 if(previous?.page==='list'&&previous.listKey&&Object.hasOwn(lists,previous.listKey)){
  go('list');openWordList(previous.listKey);return;
 }
 if(previous?.page==='list'){go('list');return}
 if(['home','cards','settings'].includes(previous?.page)){go(previous.page);return}
 go('home');
}
function restoreListView(key){
 const state=listViewSnapshots[key]||{};
 const max=Math.max(1,Math.ceil(activeWords().length/WORDS_PER_PAGE));
 rangeStart=Math.max(1,Math.min(max,Number(state.rangeStart)||1));
 rangeEnd=Math.max(rangeStart,Math.min(max,Number(state.rangeEnd)||rangeStart));
 showKo=state.showKo!==false;showJa=state.showJa!==false;
 allExamples=state.allExamples!==false;shuffleEnabled=state.shuffleEnabled===true;
 for(const [id,value] of [['settingKo',showKo],['settingJa',showJa],['settingExamples',allExamples],['shuffleWords',shuffleEnabled]]){if(el(id))el(id).checked=value}
 const allowed=Array.isArray(state.statuses)?state.statuses:['known','unknown','unseen'];
 document.querySelectorAll('.dynamicStatusFilter').forEach(c=>c.checked=allowed.includes(c.value));
 if(el('search'))el('search').value=state.search||'';
 const searchOpen=!!state.searchOpen||!!state.search;
 if(el('listSearchPanel'))el('listSearchPanel').hidden=!searchOpen;
 if(el('listSearchToggle')){el('listSearchToggle').textContent=searchOpen?'×':'⌕';el('listSearchToggle').setAttribute('aria-expanded',String(searchOpen))}
 if(el('pageRangePanel'))el('pageRangePanel').hidden=!state.pageRangeOpen;
 if(el('listSettingsPanel'))el('listSettingsPanel').hidden=!state.settingsOpen;
 refreshPageSelectors();renderWords();
 const root=el('appRoot');
 // Wait until the newly rendered list has a measurable scroll height.
 requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(currentList!==key||el('listWordsView')?.hidden)return;
  if(root)root.scrollTop=Math.max(0,Number(state.scrollTop)||0);
  selectedWordIndex=Number.isInteger(state.selectedWordIndex)?Math.min(state.selectedWordIndex,visibleWordRows.length-1):-1;
  visibleWordRows.forEach((item,i)=>item.node.classList.toggle('selected-word',i===selectedWordIndex));
  restoringListView=false;
 }));
}
function go(page){if(!el('listWordsView')?.hidden)saveListView();if(initialViewRestored&&page!=='list')rememberPage(page);document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===page));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='list')showListIndex();if(page==='cards')showCardLists();el('appRoot')?.scrollTo(0,0);syncNavigatorVisibility()}
function activeWords(){return lists[currentList]||[]}
function updateHomeStats(){
  const words=Object.values(lists).flat();
  const known=words.filter(w=>w.status==='known').length;
  const unknown=words.filter(w=>w.status==='unknown').length;
  const unseen=words.length-known-unknown;
  const pct=words.length?Math.round(100*known/words.length):0;
  safeText('homeWordCount',words.length.toLocaleString());
  safeText('homeListCount',Object.keys(lists).length);
  safeText('homeKnownCount',known.toLocaleString());
  safeText('homeProgressPercent',pct+'%');
  safeText('homeProgressKnown',known.toLocaleString()+'語');
  safeText('homeProgressUnknown',unknown.toLocaleString()+'語');
  safeText('homeProgressUnseen',unseen.toLocaleString()+'語');
  const ring=el('homeProgressRing');if(ring)ring.style.setProperty('--progress',pct+'%');
  const detail=el('homeLevelProgress');
  if(detail){detail.replaceChildren();for(const [key,ws] of Object.entries(lists)){
    const n=ws.filter(w=>w.status==='known').length;
    const rate=ws.length?Math.round(n*100/ws.length):0;
    const item=document.createElement('div');item.className='home-level-row';
    const head=document.createElement('div');head.className='home-level-head';
    const name=document.createElement('span');name.textContent=listNames[key]||key;
    const value=document.createElement('span');value.textContent=`${rate}% (${n}/${ws.length}語)`;
    head.append(name,value);
    const track=document.createElement('div');track.className='home-level-track';
    const fill=document.createElement('div');fill.className='home-level-fill';fill.style.width=rate+'%';track.append(fill);
    item.append(head,track);detail.append(item);
  }}
}
// One shared list-card component for both the List and Cards entry screens.
function createListChoice(key, onSelect){
  const words=lists[key]||[];
  const known=words.filter(w=>w.known).length;
  const pct=words.length?Math.round(100*known/words.length):0;
  const button=document.createElement('button');
  button.type='button';button.className='list-index-card';
  const ring=document.createElement('span');ring.className='list-index-icon';
  ring.style.background=`conic-gradient(var(--accent) 0 ${pct}%,#343a35 ${pct}% 100%)`;
  const value=document.createElement('span');value.textContent=pct+'%';ring.append(value);
  const copy=document.createElement('span');copy.className='list-index-copy';
  const title=document.createElement('strong');title.textContent=listNames[key]||key;
  const info=document.createElement('small');info.textContent=`${words.length}語 ・ 暗記済み ${known}語`;
  const track=document.createElement('span');track.className='list-progress';
  const fill=document.createElement('span');fill.className='list-progress-fill';fill.style.width=pct+'%';track.append(fill);
  const detail=document.createElement('span');detail.className='list-progress-detail';
  const rate=document.createElement('span');rate.textContent=`進捗 ${pct}%`;
  const count=document.createElement('span');count.textContent=`${known} / ${words.length}語`;
  detail.append(rate,count);copy.append(title,info,track,detail);
  const arrow=document.createElement('span');arrow.className='list-index-arrow';arrow.textContent='›';
  button.append(ring,copy,arrow);button.addEventListener('click',onSelect);
  return button;
}
function renderListIndex(){
  const root=el('listIndex');if(!root)return;
  root.replaceChildren(...Object.keys(lists).map(key=>createListChoice(key,()=>openWordList(key))));
}
function renderCardLists(){
  const root=el('cardListChoices');if(!root)return;
  root.replaceChildren(...Object.keys(lists).map(key=>createListChoice(key,()=>chooseCardList(key))));
}
function showListIndex(){saveListView();try{localStorage.setItem(LAST_VIEW_STORE,JSON.stringify({page:'list'}))}catch(e){}el('listIndexView').hidden=false;el('listWordsView').hidden=true;renderListIndex();syncNavigatorVisibility()}
function openWordList(key){
 if(!Object.hasOwn(lists,key))return;
 if(!el('listWordsView')?.hidden)saveListView();
 restoringListView=true;revealedWords.clear();currentList=key;
 el('listIndexView').hidden=true;el('listWordsView').hidden=false;
 safeText('selectedListTitle',listNames[key]||key);
 el('renameListButton').hidden=isBuiltinList(key);el('deleteListButton').hidden=isBuiltinList(key);
 restoreListView(key);
 try{localStorage.setItem(LAST_VIEW_STORE,JSON.stringify({page:'list',listKey:key}))}catch(e){}
 syncNavigatorVisibility();
}
function toggleListSearch(){
  const panel=el('listSearchPanel'),button=el('listSearchToggle');if(!panel||!button)return;
  const opening=panel.hidden;panel.hidden=!opening;
  button.setAttribute('aria-expanded',String(opening));button.setAttribute('aria-label',opening?'検索を閉じる':'検索を開く');
  button.textContent=opening?'×':'⌕';
  if(opening){el('pageRangePanel').hidden=true;el('listSettingsPanel').hidden=true;el('search')?.focus()}
  else{el('search').value='';renderWords()}
}
function closeListSearch(){const panel=el('listSearchPanel'),button=el('listSearchToggle');if(panel)panel.hidden=true;if(button){button.textContent='⌕';button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','検索を開く')}if(el('search'))el('search').value=''}
function speakKorean(text){
  if(!text)return;
  if(!('speechSynthesis' in window)||!('SpeechSynthesisUtterance' in window)){
    alert('このブラウザでは音声読み上げを利用できません。');return;
  }
  const synth=window.speechSynthesis;
  const utterance=new SpeechSynthesisUtterance(text);
  utterance.lang='ko-KR';utterance.rate=0.9;utterance.volume=1;
  const voices=synth.getVoices();
  const korean=voices.find(v=>v.lang.toLowerCase().replace('_','-').startsWith('ko'));
  if(korean)utterance.voice=korean;
  utterance.onerror=e=>{console.warn('音声再生エラー',e.error);if(e.error!=='canceled'&&e.error!=='interrupted')alert('音声を再生できませんでした。端末の韓国語音声設定を確認してください。')};
  synth.cancel();synth.speak(utterance);
  if(synth.paused)synth.resume();
}
function playWordVoice(word){voiceFromOldApp(word)}
function refreshPageSelectors(){const max=Math.max(1,Math.ceil(activeWords().length/80));for(const id of ['startPage','endPage']){const s=el(id);s.replaceChildren();for(let n=1;n<=max;n++){const o=document.createElement('option');o.value=n;o.textContent=n+'ページ';s.append(o)}s.value=id==='startPage'?rangeStart:rangeEnd}updateRangeLabel()}
function updateRangeLabel(){safeText('rangeSummary',`${rangeStart}〜${rangeEnd}ページ`);safeText('rangeWordCount',`${Math.max(0,Math.min(activeWords().length,rangeEnd*80)-(rangeStart-1)*80)}語`)}
function togglePageRange(){el('pageRangePanel').hidden=!el('pageRangePanel').hidden;el('listSettingsPanel').hidden=true}
function toggleListSettings(){el('listSettingsPanel').hidden=!el('listSettingsPanel').hidden;el('pageRangePanel').hidden=true}
function validatePageRange(changed){const a=el('startPage'),b=el('endPage');if(+a.value>+b.value){if(changed==='start')b.value=a.value;else a.value=b.value}}
function applyPageRange(){rangeStart=+el('startPage').value;rangeEnd=+el('endPage').value;el('pageRangePanel').hidden=true;updateRangeLabel();renderWords()}
function setListVisibility(which,on){if(which==='ko')showKo=on;else showJa=on;revealedWords.clear();renderWords()}
function setListExamples(on){allExamples=on;renderWords()}
function toggleWordShuffle(on){shuffleEnabled=on;renderWords()}
let selectedWordIndex=-1;
let visibleWordRows=[];
let currentAudio=null;
const revealedWords=new Set();
function voiceFromOldApp(word){
  if(!word)return;
  if(currentAudio){currentAudio.pause();currentAudio.currentTime=0}
  const audio=new Audio('https://ojaajo-sound.vercel.app/api/tts?text='+encodeURIComponent(word));
  currentAudio=audio;
  audio.play().catch(err=>{console.error('旧音声の再生に失敗',err);alert('音声の再生に失敗しました。通信状態を確認してください。')});
}
function navigateWord(delta){
  if(!visibleWordRows.length)return;
  selectedWordIndex=Math.max(0,Math.min(visibleWordRows.length-1,selectedWordIndex+delta));
  focusSelectedWord(true);
}
function focusSelectedWord(shouldPlay){
  visibleWordRows.forEach((item,i)=>item.node.classList.toggle('selected-word',i===selectedWordIndex));
  const item=visibleWordRows[selectedWordIndex];if(!item)return;
  item.node.scrollIntoView({behavior:'smooth',block:'center'});
  if(shouldPlay)voiceFromOldApp(item.word.ko);
}
function repeatSelectedWord(){
  if(!visibleWordRows.length)return;
  if(selectedWordIndex<0)selectedWordIndex=0;
  focusSelectedWord(true);
}
// Step 33: paired examples are stored as newline-delimited strings in existing DB columns.
function examplePairs(ex,exja){
 const korean=String(ex||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const japanese=String(exja||'').split(/\r?\n/).map(x=>x.trim());
 return korean.map((ko,i)=>({ko,ja:japanese[i]||''}));
}
function buildExampleRows(ex,exja){
 const wrapper=document.createElement('div');wrapper.className='example-pairs';
 for(const pair of examplePairs(ex,exja)){
  const row=document.createElement('div');row.className='example-pair';
  const ko=document.createElement('div');ko.className='example-ko';ko.textContent=pair.ko;
  const ja=document.createElement('div');ja.className='example-ja';ja.textContent=pair.ja;
  if(!pair.ja)row.classList.add('no-translation');
  row.append(ko,ja);wrapper.append(row);
 }
 return wrapper;
}
function validateExampleLines(ex,exja){
 const ko=String(ex||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const ja=String(exja||'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(ja.length>ko.length)throw new Error('例文訳の行数が韓国語例文より多くなっています。');
}
function renderWords(){
  const root=el('wordList');if(!root)return;
  root.replaceChildren();visibleWordRows=[];selectedWordIndex=-1;
  const query=(el('search')?.value||'').trim().toLowerCase();
  const allowed=new Set([...document.querySelectorAll('.dynamicStatusFilter:checked')].map(x=>x.value));
  let words=activeWords().filter(w=>!query||`${w.ko} ${w.ja} ${w.ex||''} ${w.exja||''}`.toLowerCase().includes(query));
  if(!query)words=words.slice((rangeStart-1)*80,rangeEnd*80);
  if(shuffleEnabled)words=[...words].sort(()=>Math.random()-.5);
  words.filter(w=>allowed.has(w.status)).forEach(w=>{
    const a=document.createElement('article');a.className='word';
    const top=document.createElement('div');top.className='word-top';
    const body=document.createElement('div');body.style.flex='1';
    const koLine=document.createElement('div');koLine.className='word-ko-line';
    function wordPart(text,kind,visible){
      if(visible||revealedWords.has(currentList+'\0'+w.ko+'\0'+kind)){
        const label=document.createElement('div');label.className=kind==='ko'?'korean':'meaning';label.textContent=text;return label;
      }
      const reveal=document.createElement('button');reveal.type='button';reveal.className='word-reveal';reveal.textContent='…';
      reveal.title=kind==='ko'?'韓国語を表示':'日本語訳を表示';
      reveal.addEventListener('click',()=>{revealedWords.add(currentList+'\0'+w.ko+'\0'+kind);reveal.replaceWith(wordPart(text,kind,true))});
      return reveal;
    }
    koLine.append(wordPart(w.ko,'ko',showKo));
    const voice=document.createElement('button');voice.type='button';voice.className='audio-btn';voice.title='韓国語を再生';voice.setAttribute('aria-label',w.ko+' を再生');
    voice.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Zm4 4a5 5 0 0 1 0 6m3-9a9 9 0 0 1 0 12"/></svg>';
    voice.addEventListener('click',()=>voiceFromOldApp(w.ko));koLine.append(voice);
    body.append(koLine,wordPart(w.ja,'ja',showJa));
    const right=document.createElement('div');right.className='word-right';
    const status=document.createElement('button');status.type='button';status.className='status status-action '+(w.status==='known'?'known':w.status==='unknown'?'unknown':'');status.textContent=w.status==='known'?'✓ 暗記済み':w.status==='unknown'?'× 未暗記':'○ 未確認';status.title='タップして暗記状況を切り替え';status.setAttribute('aria-label',w.ko+'の暗記状況を切り替え');status.addEventListener('click',()=>cycleWordStatus(w,status));
    const menu=document.createElement('button');menu.type='button';menu.className='word-edit-menu';menu.textContent='⋮';menu.title='単語の編集';menu.setAttribute('aria-label','単語・訳・例文の編集');
    menu.addEventListener('click',()=>openWordEditor(w));right.append(status,menu);top.append(body,right);a.append(top);
    if(allExamples && String(w.ex||'').trim()){const ex=document.createElement('div');ex.className='example example-line';ex.append(buildExampleRows(w.ex,w.exja));a.append(ex)}
    const rowIndex=visibleWordRows.length;visibleWordRows.push({node:a,word:w});
    a.addEventListener('click',e=>{if(e.target.closest('button'))return;selectedWordIndex=rowIndex;focusSelectedWord(false)});
    root.append(a);
  });
  const list=activeWords();safeText('selectedListSummary',`${list.length}語 ・ 暗記済み ${list.filter(w=>w.known).length}語`);
  syncNavigatorVisibility();
}
// Keep the floating navigator outside the iOS scroll container so it stays visible.
function syncNavigatorVisibility(){
  const control=el('wordNavigator');if(!control)return;
  if(control.parentElement!==document.body)document.body.appendChild(control);
  const listPage=el('list');
  const visible=!!(listPage?.classList.contains('active')&&!el('listWordsView')?.hidden&&visibleWordRows.length);
  control.hidden=!visible;
}
// Shared persistence for list and card learning; use the legacy database values.
async function persistWordStatus(listKey,w,next){
  if(typeof supabaseClient==='undefined')throw new Error('クラウドに接続できません。');
  const {data:{user},error:authError}=await supabaseClient.auth.getUser();
  if(authError||!user)throw new Error('暗記状況の保存にはログインが必要です。');
  const scope=query=>query.eq('user_id',user.id).eq('list_key',listKey).eq('word',w.ko);
  const {data:existing,error:readError}=await scope(supabaseClient.from('word_progress').select('status'));
  if(readError)throw readError;
  const value=next==='known'?'暗記済':next==='unknown'?'未暗記':null;
  let result;
  if(value===null)result=await scope(supabaseClient.from('word_progress').delete());
  else if(existing?.length)result=await scope(supabaseClient.from('word_progress').update({status:value}));
  else result=await supabaseClient.from('word_progress').insert({user_id:user.id,list_key:listKey,word:w.ko,status:value});
  if(result.error)throw result.error;
  w.status=next;w.known=next==='known';
  updateHomeStats();populateExportLists();renderListIndex();renderCardLists();
  if(currentList===listKey){
    const words=activeWords();
    safeText('selectedListSummary',`${words.length}語 ・ 暗記済み ${words.filter(x=>x.known).length}語`);
  }
}
async function cycleWordStatus(w,button){
  if(button.disabled)return;
  const next={unseen:'known',known:'unknown',unknown:'unseen'}[w.status]||'known';
  button.disabled=true;
  try{
    await persistWordStatus(currentList,w,next);
    button.className='status status-action '+(next==='known'?'known':next==='unknown'?'unknown':'');
    button.textContent=next==='known'?'✓ 暗記済み':next==='unknown'?'× 未暗記':'○ 未確認';
  }catch(error){console.error('暗記状況の保存失敗',error);alert('暗記状況を保存できませんでした：'+error.message)}
  finally{button.disabled=false}
}
// Keep the existing Supabase login button and its handlers; move only its button into the header.
function placeCloudControl(){
  const button=el('sb-cloud-toggle'),slot=el('headerCloudSlot');
  if(button&&slot&&button.parentElement!==slot)slot.appendChild(button);
}
new MutationObserver(placeCloudControl).observe(document.body,{childList:true,subtree:true});
placeCloudControl();
// A close control inside the popup is needed because the popup covers the header cloud icon.
function ensureCloudPopupClose(){
  const panel=document.querySelector('section:has(#sb-auth-status)');
  if(!panel||panel.querySelector('.cloud-popup-close'))return;
  const close=document.createElement('button');close.type='button';close.className='cloud-popup-close';
  close.textContent='×';close.setAttribute('aria-label','クラウド設定を閉じる');
  close.style.cssText='position:sticky;top:0;float:right;z-index:2;width:32px;height:32px;border-radius:9px;background:#303741;color:#f4f5f7;font-size:24px;line-height:1';
  close.onclick=()=>{panel.style.display='none';el('sb-cloud-toggle')?.setAttribute('aria-expanded','false')};
  panel.prepend(close);
}
new MutationObserver(ensureCloudPopupClose).observe(document.body,{childList:true,subtree:true});
ensureCloudPopupClose();
// Hide the legacy connection banner; authentication remains accessible from the cloud control.
function hideLegacyConnectionBanner(){
  for(const node of document.querySelectorAll('body *')){
    if(node.children.length>2||!node.textContent||!/^\s*✅?\s*Supabase接続OK/.test(node.textContent))continue;
    const banner=node;
    if(banner.id==='sb-cloud-toggle'||banner.closest('section:has(#sb-auth-status)'))continue;
    banner.style.display='none';
  }
}
new MutationObserver(()=>hideLegacyConnectionBanner()).observe(document.body,{childList:true,subtree:true});
hideLegacyConnectionBanner();
async function getSignedInUser(){
  if(typeof supabaseClient==='undefined')throw new Error('Supabaseに接続できません。');
  const {data,error}=await supabaseClient.auth.getUser();
  if(error)throw error;
  if(!data?.user)throw new Error('ログインが必要です。');
  return data.user;
}
function isBuiltinList(key){return names.some(([k])=>k===key)}
// Separate legacy expression examples without changing the original words.js data.
function splitLegacyExample(meaning,example){
  const raw=String(meaning||'');
  if(example)return {meaning:raw,example:String(example)};
  const match=raw.match(/\s*<br\s*\/?\s*>\s*例[）):：]\s*/i);
  if(!match)return {meaning:raw,example:''};
  return {meaning:raw.slice(0,match.index).trim(),example:raw.slice(match.index+match[0].length).replace(/<br\s*\/?\s*>/gi,'\n').trim()};
}
// This is an explicit, idempotent import: existing cloud edits are never overwritten.
async function importExpressionExamples(){
  const source=typeof expressionUpWords!=='undefined'?expressionUpWords:[];
  const candidates=source.map(w=>({...splitLegacyExample(w.meaning,w.example),word:w.word,page:w.page||1})).filter(w=>w.example);
  if(!candidates.length){alert('移行対象の例文がありません。');return}
  if(!confirm(`表現力UPの例文 ${candidates.length} 件をクラウドへ登録します。既存の編集内容は上書きしません。続けますか？`))return;
  const button=el('importExpressionExamples');if(button)button.disabled=true;
  try{
    const user=await getSignedInUser();
    const {data:rows,error}=await supabaseClient.from('vocab_words').select('word').eq('user_id',user.id).eq('list_key','expressionup').range(0,9999);
    if(error)throw error;
    const existing=new Set((rows||[]).map(r=>r.word));
    const pending=candidates.filter(w=>!existing.has(w.word));
    let count=0;
    for(let i=0;i<pending.length;i+=100){
      const batch=pending.slice(i,i+100).map(w=>({user_id:user.id,list_key:'expressionup',word:w.word,meaning:w.meaning,example:w.example,page:w.page}));
      const result=await supabaseClient.from('vocab_words').insert(batch);
      if(result.error)throw result.error;
      count+=batch.length;
    }
    await loadRealData();
    alert(`例文を ${count} 件登録しました。既存データ ${candidates.length-count} 件は変更していません。`);
  }catch(e){showEditError(e)}finally{if(button)button.disabled=false}
}

function editableListKeys(){return Object.keys(lists).filter(k=>!isBuiltinList(k))}
function showEditError(e){console.error('単語保存エラー',e);alert('保存できませんでした：'+(e?.message||String(e)))}
// Step 34: keep example translations paired while editing.
function addWordExamplePair(ko='',ja=''){
 const root=el('editExamplePairs');if(!root)return;
 const pair=document.createElement('div');pair.className='example-editor-pair';
 const head=document.createElement('div');head.className='example-editor-pair-head';
 const number=document.createElement('span');
 const remove=document.createElement('button');remove.type='button';remove.className='example-remove-btn';remove.textContent='削除';
 remove.onclick=()=>{pair.remove();renumberWordExamplePairs()};head.append(number,remove);
 const fields=document.createElement('div');fields.className='example-editor-pair-fields';
 for(const [cls,labelText,value] of [['edit-pair-ko','韓国語の例文',ko],['edit-pair-ja','日本語訳（任意）',ja]]){
  const label=document.createElement('label');label.textContent=labelText;
  const area=document.createElement('textarea');area.className=cls;area.rows=2;area.value=value;
  area.placeholder=cls==='edit-pair-ko'?'韓国語の例文':'例文の日本語訳';
  label.append(area);fields.append(label);
 }
 pair.append(head,fields);root.append(pair);renumberWordExamplePairs();
}
function renumberWordExamplePairs(){
 [...el('editExamplePairs').children].forEach((node,i)=>node.querySelector('.example-editor-pair-head span').textContent='例文 '+(i+1));
}
function collectWordExamplePairs(){
 const pairs=[...el('editExamplePairs').children].map(node=>({ko:node.querySelector('.edit-pair-ko').value.trim(),ja:node.querySelector('.edit-pair-ja').value.trim()}));
 if(pairs.some(p=>!p.ko&&p.ja))throw new Error('日本語訳だけが入力されている例文があります。韓国語も入力してください。');
 if(pairs.some(p=>p.ko.includes('\n')||p.ja.includes('\n')))throw new Error('1組につき例文は1文ずつ入力してください。');
 const valid=pairs.filter(p=>p.ko);
 return {ex:valid.map(p=>p.ko).join('\n'),exja:valid.map(p=>p.ja).join('\n')};
}
async function openWordEditor(w){
  const dialog=el('wordEditDialog');if(!dialog)return;
  const listKey=currentList,original=w.ko;
  el('editWordKo').value=w.ko;el('editWordJa').value=w.ja;el('editExamplePairs').replaceChildren();for(const pair of examplePairs(w.ex,w.exja))addWordExamplePair(pair.ko,pair.ja);el('addEditExamplePair').onclick=()=>addWordExamplePair();
  dialog.showModal();
  el('deleteWordBtn').hidden=isBuiltinList(listKey);
  el('deleteWordBtn').onclick=()=>deleteCustomWord(listKey,original);
  el('saveWordEdit').onclick=async()=>{
    const button=el('saveWordEdit');if(button.disabled)return;
    const ko=el('editWordKo').value.trim(),ja=el('editWordJa').value.trim();let ex,exja;try{({ex,exja}=collectWordExamplePairs())}catch(error){alert(error.message);return}
    if(!ko||!ja){alert('韓国語と日本語訳は必須です。');return}
    try{validateExampleLines(ex,exja)}catch(error){alert(error.message);return}
    if(isBuiltinList(listKey)&&ko!==original){alert('標準リストの単語そのものは変更できません。意味と例文を編集してください。');return}
    // A word is the progress key. Renaming a studied word would orphan its progress;
    // defer that operation until a safe progress migration is implemented.
    if(ko!==original&&w.status!=='unseen'){
      alert('暗記記録がある単語の名前変更は、記録保護のため現在できません。意味と例文は編集できます。');return;
    }
    if(ko!==original&&(lists[listKey]||[]).some(item=>item.ko===ko)){
      alert('同じ単語がこのリストに存在します。');return;
    }
    button.disabled=true;
    try{
      const user=await getSignedInUser();
      let result;
      if(isBuiltinList(listKey)){
        const {data:found,error:readError}=await supabaseClient.from('vocab_words').select('word').eq('user_id',user.id).eq('list_key',listKey).eq('word',original).limit(1);
        if(readError)throw readError;
        if(found?.length)result=await supabaseClient.from('vocab_words').update({meaning:ja,example:ex,example_meaning:exja}).eq('user_id',user.id).eq('list_key',listKey).eq('word',original).select('word');
        else result=await supabaseClient.from('vocab_words').insert({user_id:user.id,list_key:listKey,word:original,meaning:ja,example:ex,example_meaning:exja,page:Math.max(1,Math.ceil((lists[listKey]||[]).findIndex(item=>item.ko===original)/80)+1)}).select('word');
      }else result=await supabaseClient.from('vocab_words').update({word:ko,meaning:ja,example:ex,example_meaning:exja}).eq('user_id',user.id).eq('list_key',listKey).eq('word',original).select('word');
      if(result.error)throw result.error;
      if(!result.data?.length)throw new Error('編集対象が見つかりません。');
      dialog.close();await loadRealData();
    }catch(e){showEditError(e)}finally{button.disabled=false}
  };
}
async function deleteCustomWord(key,word){
  if(isBuiltinList(key))return;
  if(!confirm(`「${word}」を削除しますか？\nこの単語の暗記状況も削除されます。元に戻せません。`))return;
  const button=el('deleteWordBtn');if(button.disabled)return;
  button.disabled=true;
  try{
    const user=await getSignedInUser();
    const filter=q=>q.eq('user_id',user.id).eq('list_key',key).eq('word',word);
    // Progress is keyed by word. Delete it before removing the word record.
    const progress=await filter(supabaseClient.from('word_progress').delete());
    if(progress.error)throw progress.error;
    const result=await filter(supabaseClient.from('vocab_words').delete().select('word'));
    if(result.error)throw result.error;
    if(!result.data?.length)throw new Error('削除対象の単語が見つかりません。');
    el('wordEditDialog').close();
    await loadRealData();
    refreshPageSelectors();renderWords();
  }catch(e){showEditError(e)}finally{button.disabled=false}
}
async function deleteCustomList(){
  const key=currentList;
  if(isBuiltinList(key))return;
  const title=listNames[key]||key,words=lists[key]||[];
  if(!confirm(`自作リスト「${title}」を削除しますか？\n${words.length}語の単語と暗記状況も削除されます。\nこの操作は元に戻せません。`))return;
  const typed=prompt(`削除を確定するには、リスト名「${title}」を入力してください。`);
  if(typed===null)return;
  if(typed!==title){alert('リスト名が一致しないため削除しませんでした。');return}
  const button=el('deleteListButton');if(button.disabled)return;
  button.disabled=true;
  try{
    const user=await getSignedInUser();
    const scope=q=>q.eq('user_id',user.id).eq('list_key',key);
    // Explicit child deletion avoids relying on database cascade settings.
    const progress=await scope(supabaseClient.from('word_progress').delete());
    if(progress.error)throw progress.error;
    const wordsResult=await scope(supabaseClient.from('vocab_words').delete());
    if(wordsResult.error)throw wordsResult.error;
    const result=await scope(supabaseClient.from('vocab_lists').delete().select('list_key'));
    if(result.error)throw result.error;
    if(!result.data?.length)throw new Error('削除対象のリストが見つかりません。');
    currentList='beginner';
    await loadRealData();
    showListIndex();
  }catch(e){showEditError(e)}finally{button.disabled=false}
}
function openActionChooser(){el('actionDialog')?.showModal()}
function closeActionChooser(){el('actionDialog')?.close()}
function openCreateList(){
  const dialog=el('createListDialog');
  if(!dialog)return;
  el('createListName').value='';
  dialog.showModal();
}
async function saveCreatedList(event){
  event.preventDefault();
  const name=el('createListName').value.trim();
  if(!name){alert('リスト名を入力してください。');return}
  if(Object.values(listNames).some(n=>n===name)){alert('同じ名前のリストがすでにあります。');return}
  const button=el('createListBtn');if(button.disabled)return;
  button.disabled=true;
  try{
    const user=await getSignedInUser();
    const key='custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
    const {data,error}=await supabaseClient.from('vocab_lists').insert({user_id:user.id,list_key:key,name}).select('list_key');
    if(error)throw error;
    if(!data?.length)throw new Error('作成したリストを確認できませんでした。');
    el('createListDialog').close();
    await loadRealData();
    go('list');
  }catch(e){showEditError(e)}finally{button.disabled=false}
}
function openRenameList(){
  if(isBuiltinList(currentList))return;
  const dialog=el('renameListDialog');if(!dialog)return;
  el('renameListName').value=listNames[currentList]||'';
  dialog.dataset.listKey=currentList;
  dialog.showModal();
}
async function saveRenamedList(event){
  event.preventDefault();
  const dialog=el('renameListDialog'),key=dialog.dataset.listKey;
  const name=el('renameListName').value.trim();
  if(!key||isBuiltinList(key))return;
  if(!name){alert('リスト名を入力してください。');return}
  if(Object.entries(listNames).some(([k,n])=>k!==key&&n===name)){alert('同じ名前のリストがすでにあります。');return}
  const button=el('renameListBtn');if(button.disabled)return;
  button.disabled=true;
  try{
    const user=await getSignedInUser();
    const {data,error}=await supabaseClient.from('vocab_lists').update({name}).eq('user_id',user.id).eq('list_key',key).select('list_key');
    if(error)throw error;
    if(!data?.length)throw new Error('変更対象のリストが見つかりません。');
    dialog.close();
    await loadRealData();
    safeText('selectedListTitle',listNames[key]||key);
  }catch(e){showEditError(e)}finally{button.disabled=false}
}

function openImport(){
 const d=el('importDialog'),s=el('importTargetList');
 s.replaceChildren();
 for(const key of Object.keys(lists)){
   const o=document.createElement('option');o.value=key;o.textContent=listNames[key]||key;s.append(o);
 }
 el('importMode').value=Object.keys(lists).length?'existing':'new';
 el('importFile').value='';el('importText').value='';el('newListName').value='';
 updateImportMode();d.showModal();
}
function updateImportMode(){
 const create=el('importMode').value==='new';
 el('existingListField').hidden=create;el('newListField').hidden=!create;
 el('newListName').required=create;el('importTargetList').required=!create;
}
async function readImportFile(){
 const file=el('importFile').files?.[0];if(!file)return;
 try{el('importText').value=await file.text()}catch(e){alert('ファイルを読めませんでした: '+e.message)}
}
function parseImport(text){
 const result=[],seen=new Set();let current=null,pending=null;
 const rows=text.replace(/^\uFEFF/,'').split(/\r?\n/);
 function finish(){
  if(!current)return;
  if(pending&&pending.ko){current.pairs.push(pending);pending=null}
  current.example=current.pairs.map(p=>p.ko).join('\n');
  current.example_meaning=current.pairs.map(p=>p.ja).join('\n');
  delete current.pairs;
 }
 for(let i=0;i<rows.length;i++){
  const line=rows[i].trim();if(!line)continue;
  if(/^例文[:：]/.test(line)){
   if(!current)throw new Error((i+1)+'行目：例文の前に単語が必要です。');
   const payload=line.replace(/^例文[:：]/,'');
   const m=payload.match(/^(.*?)例文訳[:：](.*)$/);
   if(pending){current.pairs.push(pending);pending=null}
   if(m){if(!m[1].trim())throw new Error((i+1)+'行目：韓国語例文が空です。');current.pairs.push({ko:m[1].trim(),ja:m[2].trim()})}
   else {if(!payload.trim())throw new Error((i+1)+'行目：韓国語例文が空です。');pending={ko:payload.trim(),ja:''}}
   continue;
  }
  if(/^例文訳[:：]/.test(line)){
   if(!current||!pending)throw new Error((i+1)+'行目：対応する韓国語例文がありません。');
   pending.ja=line.replace(/^例文訳[:：]/,'').trim();current.pairs.push(pending);pending=null;continue;
  }
  const pos=line.search(/[:：]/);if(pos<1)throw new Error((i+1)+'行目に「単語:意味」がありません。');
  const word=line.slice(0,pos).trim(),meaning=line.slice(pos+1).trim();
  if(!word||!meaning)throw new Error((i+1)+'行目の単語または意味が空です。');
  if(seen.has(word))throw new Error((i+1)+'行目：'+word+' が重複しています。');
  finish();current={word,meaning,pairs:[],example:'',example_meaning:''};result.push(current);seen.add(word);
 }
 finish();return result;
}
function exportWordList(){
 const key=el('exportListSelect')?.value||currentList;
 const rows=lists[key];if(!rows){alert('書き出すリストを選択してください。');return}
 const text=rows.map(w=>[w.ko+':'+w.ja,...examplePairs(w.ex,w.exja).map(p=>'例文:'+p.ko+(p.ja?'例文訳:'+p.ja:''))].join('\n')).join('\n\n')+'\n';
 const url=URL.createObjectURL(new Blob(['\uFEFF',text],{type:'text/plain;charset=utf-8'}));
 const link=document.createElement('a');link.href=url;link.download=(listNames[key]||key).replace(/[\\/:*?"<>|]/g,'_')+'.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
function populateExportLists(){const select=el('exportListSelect');if(!select)return;const value=select.value;select.replaceChildren();for(const key of Object.keys(lists)){const option=document.createElement('option');option.value=key;option.textContent=listNames[key]||key;select.append(option)}select.value=Object.hasOwn(lists,value)?value:currentList}
async function submitImport(e){
 e.preventDefault();const btn=el('doImport');if(btn.disabled)return;
 const mode=el('importMode').value,name=el('newListName').value.trim();let key=el('importTargetList').value;
 if(mode==='new'&&(!name||Object.values(listNames).includes(name))){alert('新しいリスト名を入力してください（既存名は不可）。');return}
 if(mode==='existing'&&!Object.hasOwn(lists,key)){alert('登録先を選択してください。');return}
 let parsed;try{parsed=parseImport(el('importText').value)}catch(err){alert(err.message);return}
 if(!parsed.length){alert('単語データがありません。');return}
 const policy=el('importDuplicatePolicy')?.value||'skip';
 const known=new Map(mode==='existing'?(lists[key]||[]).map(w=>[w.ko,w]):[]);
 const fresh=parsed.filter(w=>!known.has(w.word));
 const duplicates=parsed.filter(w=>known.has(w.word));
 const updates=policy==='skip'?[]:duplicates.filter(w=>policy==='overwrite'||((!known.get(w.word).ex&&w.example)||(!known.get(w.word).exja&&w.example_meaning)));
 if(!fresh.length&&!updates.length){alert('更新対象がありません。重複単語の扱いを確認してください。');return}
 const summary=`新規 ${fresh.length}語 / 更新 ${updates.length}語 / スキップ ${duplicates.length-updates.length}語。暗記状況は変更しません。実行しますか？`;
 if(!confirm(summary))return;
 btn.disabled=true;let saved=0,changed=0,created=false;
 try{
  const user=await getSignedInUser();
  if(mode==='new'){
   key='custom_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
   const r=await supabaseClient.from('vocab_lists').insert({user_id:user.id,list_key:key,name}).select('list_key');
   if(r.error)throw r.error;if(!r.data?.length)throw new Error('リスト作成を確認できませんでした。');created=true;
  }
  // Existing cloud rows can override bundled words.js entries; do not touch word_progress.
  const {data:cloudRows,error:cloudError}=await supabaseClient.from('vocab_words').select('word,meaning,example,example_meaning').eq('user_id',user.id).eq('list_key',key).range(0,9999);
  if(cloudError)throw cloudError;
  const cloudMap=new Map((cloudRows||[]).map(w=>[w.word,w]));
  const start=(lists[key]||[]).length;
  for(let i=0;i<fresh.length;i+=100){
   const batch=fresh.slice(i,i+100).map((w,j)=>({user_id:user.id,list_key:key,word:w.word,meaning:w.meaning,example:w.example,example_meaning:w.example_meaning,page:Math.floor((start+i+j)/80)+1}));
   const r=await supabaseClient.from('vocab_words').insert(batch).select('word');if(r.error)throw r.error;if(r.data?.length!==batch.length)throw new Error('登録件数が一致しません。');saved+=batch.length;
  }
  for(const w of updates){
   const old=known.get(w.word),cloud=cloudMap.get(w.word);
   // For fill-only, preserve existing meanings and examples.
   const data=policy==='overwrite'?{meaning:w.meaning,example:w.example,example_meaning:w.example_meaning}:{meaning:cloud?.meaning||old.ja,example:cloud?.example||old.ex||w.example,example_meaning:cloud?.example_meaning||old.exja||w.example_meaning};
   if(cloud){const r=await supabaseClient.from('vocab_words').update(data).eq('user_id',user.id).eq('list_key',key).eq('word',w.word).select('word');if(r.error)throw r.error;if(r.data?.length!==1)throw new Error(w.word+' の更新を確認できません。')}
   else{const r=await supabaseClient.from('vocab_words').insert({user_id:user.id,list_key:key,word:w.word,...data,page:old.page||Math.floor((lists[key]||[]).indexOf(old)/80)+1}).select('word');if(r.error)throw r.error;if(r.data?.length!==1)throw new Error(w.word+' の登録を確認できません。')}
   changed++;
  }
  el('importDialog').close();await loadRealData();alert(`登録 ${saved}語・更新 ${changed}語。暗記状況は維持しました。`);
 }catch(err){showEditError(new Error(err.message+(created||saved||changed?'（途中まで反映されている可能性があります。再試行前に確認してください）':'')));await loadRealData()}
 finally{btn.disabled=false}
}

function openAdd(){
  const keys=editableListKeys(),dialog=el('editDialog'),target=el('wordTargetList');
  if(!dialog||!target)return;
  if(!keys.length){alert('追加できる自作リストがありません。先に新しいリストを作成してください。');return}
  target.replaceChildren();
  for(const key of keys){const option=document.createElement('option');option.value=key;option.textContent=listNames[key]||key;target.append(option)}
  target.value=keys.includes(currentList)?currentList:keys[0];
  safeText('dialogTitle','単語を追加');
  for(const id of ['editKo','editJa','editEx','editExJa'])el(id).value='';
  dialog.showModal();
}
async function submitNewWord(event){
  event.preventDefault();
  const button=el('saveWordBtn');if(button.disabled)return;
  const key=el('wordTargetList').value;
  const ko=el('editKo').value.trim(),ja=el('editJa').value.trim(),ex=el('editEx').value.trim();
  const exja=el('editExJa').value.trim();
  if(!editableListKeys().includes(key)){alert('自作リストを選択してください。');return}
  if(!ko||!ja){alert('韓国語と日本語訳は必須です。');return}
  try{validateExampleLines(ex,exja)}catch(error){alert(error.message);return}
  if((lists[key]||[]).some(w=>w.ko===ko)){alert('このリストには同じ単語がすでにあります。');return}
  button.disabled=true;
  try{
    const user=await getSignedInUser();
    const page=Math.max(1,Math.ceil(((lists[key]||[]).length+1)/WORDS_PER_PAGE));
    const {data,error}=await supabaseClient.from('vocab_words')
      .insert({user_id:user.id,list_key:key,word:ko,meaning:ja,example:ex,example_meaning:exja,page})
      .select('word');
    if(error)throw error;
    if(!data?.length)throw new Error('追加した単語を確認できませんでした。');
    el('editDialog').close();
    await loadRealData();
    if(currentList===key&&!el('listWordsView').hidden){refreshPageSelectors();renderWords()}
  }catch(e){showEditError(e)}finally{button.disabled=false}
}
document.addEventListener('DOMContentLoaded',()=>{
  const form=el('wordForm');if(form)form.addEventListener('submit',submitNewWord);
  el('createListForm')?.addEventListener('submit',saveCreatedList);
  el('renameListForm')?.addEventListener('submit',saveRenamedList);
  el('importForm')?.addEventListener('submit',submitImport);
  el('importMode')?.addEventListener('change',updateImportMode);
  el('importFile')?.addEventListener('change',readImportFile);
});

// Card learning: settings and navigation use real words and shared progress persistence.
let cardListKey='beginner',cardDeck=[],cardIndex=0,meaningRevealed=false,exampleShown=false;
function showCardLists(){el('cardListView').hidden=false;el('cardSetupView').hidden=true;el('cardQuizView').hidden=true;renderCardLists()}
function chooseCardList(key){
  if(!lists[key])return;
  cardListKey=key;
  safeText('cardSetupTitle',listNames[key]||key);
  const pages=Math.max(1,Math.ceil(lists[key].length/WORDS_PER_PAGE));
  for(const id of ['cardStartPage','cardEndPage']){
    const select=el(id);select.replaceChildren();
    for(let i=1;i<=pages;i++){const option=document.createElement('option');option.value=String(i);option.textContent=i+'ページ';select.append(option)}
    select.value=id==='cardStartPage'?'1':String(pages);
  }
  document.querySelectorAll('.card-status').forEach(c=>c.checked=true);
  el('cardShuffle').checked=true;el('cardAutoVoice').checked=false;
  showCardSetup();window.scrollTo(0,0);
}
function showCardSetup(){el('cardListView').hidden=true;el('cardSetupView').hidden=false;el('cardQuizView').hidden=true;updateCardEstimate()}
function validateCardPages(changed){
  const a=el('cardStartPage'),b=el('cardEndPage');
  if(Number(a.value)>Number(b.value)){if(changed==='start')b.value=a.value;else a.value=b.value}
  updateCardEstimate();
}
function buildCardDeck(){
  const from=(Number(el('cardStartPage').value)-1)*WORDS_PER_PAGE;
  const to=Number(el('cardEndPage').value)*WORDS_PER_PAGE;
  const allowed=new Set([...document.querySelectorAll('.card-status:checked')].map(c=>c.value));
  return (lists[cardListKey]||[]).map((_,i)=>i).slice(from,to).filter(i=>allowed.has(lists[cardListKey][i].status));
}
function updateCardEstimate(){safeText('cardEstimatedCount',`出題予定：${buildCardDeck().length}語`)}
function startCardQuiz(){
  cardDeck=buildCardDeck();
  if(!cardDeck.length){alert('対象の単語がありません。表示範囲やステータスを確認してください。');return}
  if(el('cardShuffle').checked){for(let i=cardDeck.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[cardDeck[i],cardDeck[j]]=[cardDeck[j],cardDeck[i]]}}
  cardIndex=0;meaningRevealed=false;exampleShown=false;
  el('cardListView').hidden=true;el('cardSetupView').hidden=true;el('cardQuizView').hidden=false;
  renderCard();playCardVoice();window.scrollTo(0,0);
}
function currentCardWord(){return (lists[cardListKey]||[])[cardDeck[cardIndex]]}
function renderCard(){
  if(el('cardQuizView').hidden)return;
  const w=currentCardWord();if(!w)return;
  safeText('cardCounter',`${cardIndex+1} / ${cardDeck.length}`);
  document.querySelectorAll('#cardQuizView [id="cardListName"]').forEach(n=>n.textContent=listNames[cardListKey]||cardListKey);
  safeText('cardKorean',w.ko);safeText('cardMeaning',meaningRevealed?w.ja:'…');
  safeText('revealBtn',meaningRevealed?'意味を隠す':'意味を表示する');
  el('cardExample').hidden=!exampleShown;
  safeText('cardExampleToggleBtn',exampleShown?'例文を非表示':'例文を表示');
  const target=el('cardExampleText');target.replaceChildren();if(w.ex)target.append(buildExampleRows(w.ex,w.exja));else target.textContent='例文は未登録です。';safeText('cardExampleMeaning','');
}
function playCardVoice(force=false){
  if(!force&&!el('cardAutoVoice').checked)return;
  const w=currentCardWord();if(w)voiceFromOldApp(w.ko);
}
function revealMeaning(){meaningRevealed=!meaningRevealed;renderCard()}
function toggleCardExample(){exampleShown=!exampleShown;renderCard()}
let cardSaveBusy=false;
async function markCard(remembered){
  if(cardSaveBusy||!cardDeck.length)return;
  const w=currentCardWord();if(!w)return;
  cardSaveBusy=true;
  const buttons=[...document.querySelectorAll('#cardQuizView .card-controls button')];
  buttons.forEach(b=>b.disabled=true);
  try{
    await persistWordStatus(cardListKey,w,remembered?'known':'unknown');
    // Keep the selected deck stable, even when status filters would now exclude this word.
    nextCard();
  }catch(error){console.error('カードの暗記状況保存失敗',error);alert('暗記状況を保存できませんでした：'+error.message)}
  finally{cardSaveBusy=false;buttons.forEach(b=>b.disabled=false)}
}
function nextCard(){if(!cardDeck.length)return;cardIndex=(cardIndex+1)%cardDeck.length;meaningRevealed=false;renderCard();playCardVoice()}
function prevCard(){if(!cardDeck.length)return;cardIndex=(cardIndex-1+cardDeck.length)%cardDeck.length;meaningRevealed=false;renderCard();playCardVoice()}
function mapStatus(s){if(s==='暗記済み'||s==='暗記済'||s==='correct'||s===true)return 'known';if(s==='未暗記'||s==='incorrect'||s===false)return 'unknown';return 'unseen'}
async function loadRealData(){if(typeof supabaseClient==='undefined'){safeText('cloudStatusText','接続できません');return}try{const {data:auth,error:authErr}=await supabaseClient.auth.getUser();if(authErr)throw authErr;const user=auth?.user;safeText('cloudStatusText',user?'ログイン中：'+user.email:'未ログイン');safeText('cloudStatusBadge',user?'接続中':'未接続');lists={};listNames={};for(const [key,name,variable] of names){const builtin={beginner:typeof beginnerWords!=='undefined'?beginnerWords:[],intermediate:typeof intermediateWords!=='undefined'?intermediateWords:[],advanced:typeof advancedWords!=='undefined'?advancedWords:[],expressionup:typeof expressionUpWords!=='undefined'?expressionUpWords:[]};const source=builtin[key];lists[key]=(Array.isArray(source)?source:[]).map(w=>{const parsed=splitLegacyExample(w.meaning,w.example);return {ko:w.word,ja:parsed.meaning,ex:parsed.example,exja:w.example_meaning||'',status:'unseen',known:false,page:w.page}});listNames[key]=name}if(user){const results=await Promise.all([supabaseClient.from('vocab_lists').select('list_key,name').eq('user_id',user.id),supabaseClient.from('vocab_words').select('list_key,word,meaning,example,example_meaning,page').eq('user_id',user.id).range(0,9999),supabaseClient.from('word_progress').select('list_key,word,status').eq('user_id',user.id).range(0,9999)]);for(const r of results)if(r.error)throw r.error;const [listRows,wordRows,progressRows]=results.map(r=>r.data||[]);for(const row of listRows){listNames[row.list_key]=row.name||row.list_key;lists[row.list_key]=[]}for(const w of wordRows){if(!lists[w.list_key])continue;const parsed=splitLegacyExample(w.meaning,w.example);const existing=isBuiltinList(w.list_key)?lists[w.list_key].find(item=>item.ko===w.word):null;if(existing){existing.ja=parsed.meaning;existing.ex=parsed.example;existing.exja=w.example_meaning||''}else lists[w.list_key].push({ko:w.word,ja:parsed.meaning,ex:parsed.example,exja:w.example_meaning||'',status:'unseen',known:false,page:w.page})}const progress=new Map(progressRows.map(w=>[w.list_key+'\u0000'+w.word,mapStatus(w.status)]));for(const [key,words] of Object.entries(lists))for(const w of words){w.status=progress.get(key+'\u0000'+w.ko)||'unseen';w.known=w.status==='known'}}updateHomeStats();populateExportLists();renderListIndex();renderCardLists();if(!el('listWordsView').hidden)renderWords();restoreInitialView()}catch(e){console.error('新UI読込失敗',e);safeText('cloudStatusText','読み込みエラー：'+e.message)}}
// Prevent prototype forms from submitting data until persistence is implemented.

document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();go(b.dataset.page)}));
supabaseClient.auth.onAuthStateChange(()=>setTimeout(loadRealData,0));
loadRealData();go('home');

document.addEventListener('DOMContentLoaded',()=>{el('importExpressionExamples')?.addEventListener('click',importExpressionExamples)});


// Keep the most recent list view even when Safari suspends or reloads the page.
el('appRoot')?.addEventListener('scroll',()=>{if(!el('listWordsView')?.hidden)scheduleListViewSave()},{passive:true});
for(const eventName of ['input','change','click']){
 el('listWordsView')?.addEventListener(eventName,()=>scheduleListViewSave());
}
window.addEventListener('pagehide',()=>{clearTimeout(viewSaveTimer);saveListView()});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){clearTimeout(viewSaveTimer);saveListView()}});

// Step 22: mount the legacy auth UI outside the scrollable .app so Safari cannot clip it.
function mountCloudPopup(){
  const status=document.getElementById('sb-auth-status');
  const panel=status?.closest('section');
  if(!panel)return;
  if(panel.id!=='sb-cloud-popup')panel.id='sb-cloud-popup';
  if(panel.parentElement!==document.body)document.body.appendChild(panel);
  const oldHeading=panel.querySelector('h3');
  if(oldHeading)oldHeading.remove();
  if(!panel.querySelector('.cloud-popup-heading')){
    const head=document.createElement('div');head.className='cloud-popup-heading';
    const icon=document.createElement('span');icon.className='cloud-popup-heading-icon';icon.textContent='☁';
    const title=document.createElement('span');title.className='cloud-popup-heading-title';title.textContent='クラウド同期';
    head.append(icon,title);
    panel.prepend(head);
  }
  status.classList.toggle('cloud-signed-in',status.textContent.includes('ログイン中'));
}
new MutationObserver(mountCloudPopup).observe(document.body,{childList:true,subtree:true});
mountCloudPopup();
