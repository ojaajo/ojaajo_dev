// New UI data bridge — card and list progress share Supabase persistence.
let lists={},listNames={},currentList='beginner',rangeStart=1,rangeEnd=1;
let showKo=true,showJa=true,allExamples=false,shuffleEnabled=false;
const WORDS_PER_PAGE=80;
const names=[['beginner','初級','beginnerWords'],['intermediate','中級','intermediateWords'],['advanced','上級','advancedWords'],['expressionup','表現力UP','expressionUpWords']];
function el(id){return document.getElementById(id)}
function safeText(id,s){if(el(id))el(id).textContent=s}
function unsupported(){alert('この操作は現在移行中です。旧画面から操作してください。');}
function go(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===page));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='list')showListIndex();if(page==='cards')showCardLists();window.scrollTo(0,0)}
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
function showListIndex(){el('listIndexView').hidden=false;el('listWordsView').hidden=true;renderListIndex()}
function openWordList(key){revealedWords.clear();closeListSearch();currentList=key;rangeStart=1;rangeEnd=1;el('listIndexView').hidden=true;el('listWordsView').hidden=false;safeText('selectedListTitle',listNames[key]||key);el('search').value='';refreshPageSelectors();renderWords();window.scrollTo(0,0)}
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
function renderWords(){
  const root=el('wordList');if(!root)return;
  root.replaceChildren();visibleWordRows=[];selectedWordIndex=-1;
  const query=(el('search')?.value||'').trim().toLowerCase();
  const allowed=new Set([...document.querySelectorAll('.dynamicStatusFilter:checked')].map(x=>x.value));
  let words=activeWords().filter(w=>!query||`${w.ko} ${w.ja} ${w.ex||''}`.toLowerCase().includes(query));
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
    if(w.ex){const btn=document.createElement('button');btn.className='btn small';btn.textContent='例文を見る';const ex=document.createElement('div');ex.className='example';ex.hidden=!allExamples;ex.textContent=w.ex;btn.onclick=()=>{ex.hidden=!ex.hidden;btn.textContent=ex.hidden?'例文を見る':'例文を隠す'};a.append(btn,ex)}
    const rowIndex=visibleWordRows.length;visibleWordRows.push({node:a,word:w});
    a.addEventListener('click',e=>{if(e.target.closest('button'))return;selectedWordIndex=rowIndex;focusSelectedWord(false)});
    root.append(a);
  });
  const list=activeWords();safeText('selectedListSummary',`${list.length}語 ・ 暗記済み ${list.filter(w=>w.known).length}語`);
  const controls=el('wordNavigator');if(controls)controls.hidden=!visibleWordRows.length;
}
// Shared persistence for list and card learning; use the legacy database values.
async function persistWordStatus(listKey,w,next){
  if(typeof supabaseClient==='undefined')throw new Error('クラウドに接続できません。');
  const {data:{user},error:authError}=await supabaseClient.auth.getUser();
  if(authError||!user)throw new Error('暗記状況の保存にはログインが必要です。');
  const base=()=>supabaseClient.from('word_progress').eq('user_id',user.id).eq('list_key',listKey).eq('word',w.ko);
  const {data:existing,error:readError}=await base().select('status');
  if(readError)throw readError;
  const value=next==='known'?'暗記済':next==='unknown'?'未暗記':null;
  let result;
  if(value===null)result=await base().delete();
  else if(existing?.length)result=await base().update({status:value});
  else result=await supabaseClient.from('word_progress').insert({user_id:user.id,list_key:listKey,word:w.ko,status:value});
  if(result.error)throw result.error;
  w.status=next;w.known=next==='known';
  updateHomeStats();renderListIndex();renderCardLists();
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
async function openWordEditor(w){
  const dialog=el('wordEditDialog');if(!dialog)return;
  el('editWordKo').value=w.ko;el('editWordJa').value=w.ja;el('editWordEx').value=w.ex||'';
  dialog.showModal();
  el('saveWordEdit').onclick=async()=>{
    const ko=el('editWordKo').value.trim(),ja=el('editWordJa').value.trim(),ex=el('editWordEx').value.trim();
    if(!ko||!ja){alert('韓国語と日本語訳は必須です。');return}
    const {data:{user},error:authError}=await supabaseClient.auth.getUser();
    if(authError||!user){alert('保存するにはログインが必要です。');return}
    // Built-in lists are stored in words.js, not vocab_words. Never pretend to save them.
    if(names.some(([key])=>key===currentList)){alert('標準リストの編集はまだ対応していません。元データを保護するため保存しません。');return}
    const {data,error}=await supabaseClient.from('vocab_words').update({word:ko,meaning:ja,example:ex}).eq('user_id',user.id).eq('list_key',currentList).eq('word',w.ko).select('word');
    if(error||!data?.length){alert('保存できませんでした。'+(error?.message||'対象が見つかりません'));return}
    dialog.close();await loadRealData();
  };
}

function openActionChooser(){unsupported()}function openCreateList(){unsupported()}function openImport(){unsupported()}function openAdd(){unsupported()}
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
  safeText('cardExampleText',w.ex||'例文は未登録です。');safeText('cardExampleMeaning',w.exja||'');
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
function nextCard(){if(!cardDeck.length)return;cardIndex=(cardIndex+1)%cardDeck.length;meaningRevealed=false;exampleShown=false;renderCard();playCardVoice()}
function prevCard(){if(!cardDeck.length)return;cardIndex=(cardIndex-1+cardDeck.length)%cardDeck.length;meaningRevealed=false;exampleShown=false;renderCard();playCardVoice()}
function mapStatus(s){if(s==='暗記済み'||s==='暗記済'||s==='correct'||s===true)return 'known';if(s==='未暗記'||s==='incorrect'||s===false)return 'unknown';return 'unseen'}
async function loadRealData(){if(typeof supabaseClient==='undefined'){safeText('cloudStatusText','接続できません');return}try{const {data:auth,error:authErr}=await supabaseClient.auth.getUser();if(authErr)throw authErr;const user=auth?.user;safeText('cloudStatusText',user?'ログイン中：'+user.email:'未ログイン');safeText('cloudStatusBadge',user?'接続中':'未接続');lists={};listNames={};for(const [key,name,variable] of names){const builtin={beginner:typeof beginnerWords!=='undefined'?beginnerWords:[],intermediate:typeof intermediateWords!=='undefined'?intermediateWords:[],advanced:typeof advancedWords!=='undefined'?advancedWords:[],expressionup:typeof expressionUpWords!=='undefined'?expressionUpWords:[]};const source=builtin[key];lists[key]=(Array.isArray(source)?source:[]).map(w=>({ko:w.word,ja:w.meaning,ex:w.example||'',status:'unseen',known:false}));listNames[key]=name}if(user){const results=await Promise.all([supabaseClient.from('vocab_lists').select('list_key,name').eq('user_id',user.id),supabaseClient.from('vocab_words').select('list_key,word,meaning,example,page').eq('user_id',user.id).range(0,9999),supabaseClient.from('word_progress').select('list_key,word,status').eq('user_id',user.id).range(0,9999)]);for(const r of results)if(r.error)throw r.error;const [listRows,wordRows,progressRows]=results.map(r=>r.data||[]);for(const row of listRows){listNames[row.list_key]=row.name||row.list_key;lists[row.list_key]=[]}for(const w of wordRows){if(!lists[w.list_key])continue;lists[w.list_key].push({ko:w.word,ja:w.meaning,ex:w.example||'',status:'unseen',known:false,page:w.page})}const progress=new Map(progressRows.map(w=>[w.list_key+'\u0000'+w.word,mapStatus(w.status)]));for(const [key,words] of Object.entries(lists))for(const w of words){w.status=progress.get(key+'\u0000'+w.ko)||'unseen';w.known=w.status==='known'}}updateHomeStats();renderListIndex();renderCardLists();if(!el('listWordsView').hidden)renderWords()}catch(e){console.error('新UI読込失敗',e);safeText('cloudStatusText','読み込みエラー：'+e.message)}}
// Prevent prototype forms from submitting data until persistence is implemented.
document.querySelectorAll('dialog form').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();unsupported()}));
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();go(b.dataset.page)}));
supabaseClient.auth.onAuthStateChange(()=>setTimeout(loadRealData,0));
loadRealData();go('home');
