// New UI data bridge — read-only until write workflows are migrated.
let lists={},listNames={},currentList='beginner',rangeStart=1,rangeEnd=1;
let showKo=true,showJa=true,allExamples=false,shuffleEnabled=false;
const WORDS_PER_PAGE=80;
const names=[['beginner','初級','beginnerWords'],['intermediate','中級','intermediateWords'],['advanced','上級','advancedWords'],['expressionup','表現力UP','expressionUpWords']];
function el(id){return document.getElementById(id)}
function safeText(id,s){if(el(id))el(id).textContent=s}
function unsupported(){alert('この操作は現在移行中です。旧画面から操作してください。');}
function go(page){document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===page));document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===page));if(page==='list')showListIndex();if(page==='cards')renderCardLists();window.scrollTo(0,0)}
function activeWords(){return lists[currentList]||[]}
function updateHomeStats(){let words=Object.values(lists).flat();safeText('homeWordCount',words.length);safeText('homeListCount',Object.keys(lists).length);safeText('homeKnownCount',words.filter(w=>w.known).length)}
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
function openWordList(key){currentList=key;rangeStart=1;rangeEnd=1;el('listIndexView').hidden=true;el('listWordsView').hidden=false;safeText('selectedListTitle',listNames[key]||key);el('search').value='';refreshPageSelectors();renderWords();window.scrollTo(0,0)}
function refreshPageSelectors(){const max=Math.max(1,Math.ceil(activeWords().length/80));for(const id of ['startPage','endPage']){const s=el(id);s.replaceChildren();for(let n=1;n<=max;n++){const o=document.createElement('option');o.value=n;o.textContent=n+'ページ';s.append(o)}s.value=id==='startPage'?rangeStart:rangeEnd}updateRangeLabel()}
function updateRangeLabel(){safeText('rangeSummary',`${rangeStart}〜${rangeEnd}ページ`);safeText('rangeWordCount',`${Math.max(0,Math.min(activeWords().length,rangeEnd*80)-(rangeStart-1)*80)}語`)}
function togglePageRange(){el('pageRangePanel').hidden=!el('pageRangePanel').hidden;el('listSettingsPanel').hidden=true}
function toggleListSettings(){el('listSettingsPanel').hidden=!el('listSettingsPanel').hidden;el('pageRangePanel').hidden=true}
function validatePageRange(changed){const a=el('startPage'),b=el('endPage');if(+a.value>+b.value){if(changed==='start')b.value=a.value;else a.value=b.value}}
function applyPageRange(){rangeStart=+el('startPage').value;rangeEnd=+el('endPage').value;el('pageRangePanel').hidden=true;updateRangeLabel();renderWords()}
function setListVisibility(which,on){if(which==='ko')showKo=on;else showJa=on;renderWords()}
function setListExamples(on){allExamples=on;renderWords()}
function toggleWordShuffle(on){shuffleEnabled=on;renderWords()}
function renderWords(){const root=el('wordList');root.replaceChildren();const query=el('search').value.trim().toLowerCase();const allowed=new Set([...document.querySelectorAll('.dynamicStatusFilter:checked')].map(x=>x.value));let words=activeWords().filter(w=>!query||`${w.ko} ${w.ja} ${w.ex||''}`.toLowerCase().includes(query));if(!query)words=words.slice((rangeStart-1)*80,rangeEnd*80);if(shuffleEnabled)words=[...words].sort(()=>Math.random()-.5);words.filter(w=>allowed.has(w.status)).forEach(w=>{const a=document.createElement('article');a.className='word';const top=document.createElement('div');top.className='word-top';const body=document.createElement('div');body.style.flex='1';const ko=document.createElement('div');ko.className='korean'+(showKo?'':' hidden-text');ko.textContent=w.ko;const ja=document.createElement('div');ja.className='meaning'+(showJa?'':' hidden-text');ja.textContent=w.ja;body.append(ko,ja);const status=document.createElement('span');status.className='status '+(w.status==='known'?'known':w.status==='unknown'?'unknown':'');status.textContent=w.status==='known'?'✓ 暗記済み':w.status==='unknown'?'× 未暗記':'○ 未確認';top.append(body,status);a.append(top);if(w.ex){const btn=document.createElement('button');btn.className='btn small';btn.textContent='例文を見る';const ex=document.createElement('div');ex.className='example';ex.hidden=!allExamples;ex.textContent=w.ex;btn.onclick=()=>{ex.hidden=!ex.hidden;btn.textContent=ex.hidden?'例文を見る':'例文を隠す'};a.append(btn,ex)}root.append(a)});const list=activeWords();safeText('selectedListSummary',`${list.length}語 ・ 暗記済み ${list.filter(w=>w.known).length}語`)}
function openActionChooser(){unsupported()}function openCreateList(){unsupported()}function openImport(){unsupported()}function openAdd(){unsupported()}
function showCardLists(){unsupported()}function chooseCardList(){unsupported()}function showCardSetup(){unsupported()}function validateCardPages(){}function updateCardEstimate(){}function startCardQuiz(){unsupported()}function revealMeaning(){unsupported()}function toggleCardExample(){unsupported()}function markCard(){unsupported()}function prevCard(){unsupported()}function nextCard(){unsupported()}
function mapStatus(s){if(s==='暗記済み'||s==='暗記済'||s==='correct'||s===true)return 'known';if(s==='未暗記'||s==='incorrect'||s===false)return 'unknown';return 'unseen'}
async function loadRealData(){if(typeof supabaseClient==='undefined'){safeText('cloudStatusText','接続できません');return}try{const {data:auth,error:authErr}=await supabaseClient.auth.getUser();if(authErr)throw authErr;const user=auth?.user;safeText('cloudStatusText',user?'ログイン中：'+user.email:'未ログイン');safeText('cloudStatusBadge',user?'接続中':'未接続');lists={};listNames={};for(const [key,name,variable] of names){const builtin={beginner:typeof beginnerWords!=='undefined'?beginnerWords:[],intermediate:typeof intermediateWords!=='undefined'?intermediateWords:[],advanced:typeof advancedWords!=='undefined'?advancedWords:[],expressionup:typeof expressionUpWords!=='undefined'?expressionUpWords:[]};const source=builtin[key];lists[key]=(Array.isArray(source)?source:[]).map(w=>({ko:w.word,ja:w.meaning,ex:w.example||'',status:'unseen',known:false}));listNames[key]=name}if(user){const results=await Promise.all([supabaseClient.from('vocab_lists').select('list_key,name').eq('user_id',user.id),supabaseClient.from('vocab_words').select('list_key,word,meaning,example,page').eq('user_id',user.id).range(0,9999),supabaseClient.from('word_progress').select('list_key,word,status').eq('user_id',user.id).range(0,9999)]);for(const r of results)if(r.error)throw r.error;const [listRows,wordRows,progressRows]=results.map(r=>r.data||[]);for(const row of listRows){listNames[row.list_key]=row.name||row.list_key;lists[row.list_key]=[]}for(const w of wordRows){if(!lists[w.list_key])continue;lists[w.list_key].push({ko:w.word,ja:w.meaning,ex:w.example||'',status:'unseen',known:false,page:w.page})}const progress=new Map(progressRows.map(w=>[w.list_key+'\u0000'+w.word,mapStatus(w.status)]));for(const [key,words] of Object.entries(lists))for(const w of words){w.status=progress.get(key+'\u0000'+w.ko)||'unseen';w.known=w.status==='known'}}updateHomeStats();renderListIndex();renderCardLists();if(!el('listWordsView').hidden)renderWords()}catch(e){console.error('新UI読込失敗',e);safeText('cloudStatusText','読み込みエラー：'+e.message)}}
// Prevent prototype forms from submitting data until persistence is implemented.
document.querySelectorAll('dialog form').forEach(form=>form.addEventListener('submit',e=>{e.preventDefault();unsupported()}));
document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',e=>{e.preventDefault();go(b.dataset.page)}));
supabaseClient.auth.onAuthStateChange(()=>setTimeout(loadRealData,0));
loadRealData();go('home');
