import {dateKey,addDays,dayIndex,daysUntil,isSunday,wordsFor,initialState,validState,dueMistakes} from './core.js';
import {GuidePlayer,wordSteps,effect} from './audio.js';

const KEY='pet-study-v2', $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state=initialState(), storageBlocked=false, bank=[], materials=[], active=null, media=null;
const app=$('#app'),modal=$('#exercise'),body=$('#exerciseBody'),TEST_DATES=['2026-09-11','2026-09-12','2026-09-13'];
const today=()=>state.settings.testDate||dateKey();
const names={vocabulary:'单词',listening:'听力',reading:'阅读'};
try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(!validState(parsed))throw Error();state=parsed;}else{const old=JSON.parse(localStorage.getItem('pet-study-v1')||'null');if(typeof old?.settings?.name==='string')state.settings.name=old.settings.name;}}catch{storageBlocked=true;}
function notify(text){$('#toast').textContent=text;$('#toast').style.display='block';clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').style.display='none',5000);}
function save(){if(storageBlocked){notify('记录无法读取，已停止覆盖。请先导出原记录。');return false;}try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{notify('未能保存，请到家长空间导出备份。');return false;}}
const player=new GuidePlayer(updatePlayer,()=>{if(active?.type==='words'){active.played=true;$('#wordDone').disabled=false;if(active.auto)completeWord();}});
function stopAudio(){player.stop();if(media){media.pause();media=null;}}
function close(){stopAudio();active=null;if(modal.open)modal.close();render();}
modal.addEventListener('close',()=>{stopAudio();active=null;render();});
modal.addEventListener('cancel',stopAudio);
window.addEventListener('pagehide',()=>{player.pause();if(media)media.pause();save();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){player.pause();if(media)media.pause();}else if(!modal.open)render();});
function updatePlayer(info){
  const status=$('#playStatus');if(status)status.textContent=info.message||({idle:'准备好了',speaking:info.step?.label||'听一听',waiting:'轮到你读',paused:'已暂停',done:'这一遍读完了',error:'声音未能播放'}[info.status]);
  const b=$('#togglePlay');if(b)b.textContent=['speaking','waiting'].includes(info.status)?'暂停':'播放';
  const p=$('#audioProgress');if(p){p.max=Math.max(1,player.steps.length);p.value=info.index+(info.status==='done'?1:0);}
  const line=$('#spokenLine');if(line)line.textContent=info.step?.text||'';
  const more=$('#moreTime');if(more)more.disabled=!(info.status==='waiting'||info.status==='paused'&&player.resumeType==='waiting');
}
function controls(){return `<div class="player"><div class="player-state"><span id="playStatus" role="status">准备好了</span><progress id="audioProgress" max="1" value="0" aria-label="带读进度"></progress></div><p id="spokenLine" class="spoken" lang="en"></p><div class="actions"><button id="togglePlay">播放</button><button id="repeatAudio" class="quiet">重听本句</button><button id="moreTime" class="quiet" disabled>多等3秒</button><label class="speed">语速<select id="speechRate"><option value="0.7">慢一点</option><option value="0.85">舒缓</option><option value="1">自然</option></select></label></div><p class="muted player-help">“多等3秒”只在“轮到你读”时可用。</p></div>`;}
function wirePlayer(steps){
  $('#speechRate').value=String(state.settings.rate);$('#speechRate').onchange=e=>{state.settings.rate=Number(e.target.value);save();player.steps.forEach(s=>{if(s.lang!=='zh-CN')s.rate=state.settings.rate;});};
  $('#togglePlay').onclick=()=>{if(media)media.pause();if(['speaking','waiting'].includes(player.status))player.pause();else if(player.status==='paused')player.resume();else player.start(steps());};
  $('#repeatAudio').onclick=()=>{if(media)media.pause();if(player.steps.length)player.repeat();else player.start(steps());};$('#moreTime').onclick=()=>player.extend();
}
const completed=key=>!!state.completed[`${today()}:${key}`];
function markComplete(key){state.completed[`${active?.date||today()}:${key}`]=true;save();}
function task(key,title,detail,kind='vocabulary',disabled=false){return `<article class="task ${completed(key)?'done':''}"><div class="number">${completed(key)?'✓':kind==='listening'?'听':kind==='reading'?'读':'词'}</div><div><h2>${esc(title)}</h2><p>${esc(detail)}</p></div><button data-task="${key}" ${disabled?'disabled':''}>${completed(key)?'再看看':'开始'}</button></article>`;}
function countdown(){const d=daysUntil(state.settings.exam,today());const [y,m,day]=state.settings.exam.split('-');return `<aside class="countdown" aria-label="PET考试倒计时"><span>${esc(state.settings.name)} · ${Number(m)}月${Number(day)}日 PET</span><strong>${d>0?`还有 <b>${d}</b> 天`:d===0?'今天考试':'考试已结束'}</strong></aside>`;}
function render(){
  const view=location.hash.slice(1)||'today';if(view==='parent'){renderParent();return;}
  const n=dayIndex(today()),due=dueMistakes(state.attempts,today()),inTest=TEST_DATES.includes(today());
  app.innerHTML=`${storageBlocked?'<p class="notice">本机记录未能读取，已停止覆盖。请在家长空间导出原记录。</p>':''}<section class="intro"><div><div class="date">${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</div><h1>${esc(state.settings.name)}，${view==='review'?'再熟悉一点':view==='progress'?'一步一步来':'今天一起读'}</h1><p class="summary">${inTest?`内测第 ${TEST_DATES.indexOf(today())+1} / 3 天 · 每天20个新词`:n>=0&&n<35?`第 ${n+1} / 35 天 · 每天20个新词`:n<0?'9月11日开始':'新词计划已结束，继续巩固'}</p></div>${countdown()}</section><nav class="tabs" aria-label="学习导航">${[['today','今天'],['review','错题本'],['progress','学习记录']].map(([id,label])=>`<a href="#${id}" ${view===id?'aria-current="page" class="active"':''}>${label}</a>`).join('')}</nav>`;
  if(view==='review'){renderReview(due);return;}if(view==='progress'){renderProgress();return;}
  if(!inTest){app.innerHTML+='<section class="test-finish"><h2>三天内测已完成</h2><p>请从家长空间切换到第1、2或3天，回看体验；后续32天将在内测确认后开放。</p></section>';return;}
  const words=wordsFor(bank.slice(0,60),today()),previous=wordsFor(bank.slice(0,60),addDays(today(),-1)).filter(w=>state.learned[w.id]);
  if(previous.length)app.innerHTML+=task('check','昨天的单词',`${previous.length} 词 · 词义检查`);
  if(due.length){app.innerHTML+=`<h2>${isSunday(today())?'本周回顾':'复习一下'}</h2>`;for(const kind of ['vocabulary','listening','reading']){const count=due.filter(d=>d.kind===kind).length;if(count)app.innerHTML+=task('review-'+kind,names[kind]+'再试一次',`${count} 题 · ${isSunday(today())?'本周错题':'到期错题'}`,kind);}}
  if(words.length)app.innerHTML+=task('words','今日20词',`${words.filter(w=>state.learned[w.id]).length} / 20 已跟读 · 约25分钟`);
  if(!isSunday(today())||inTest){app.innerHTML+=task('listening','听力带练','互动试听 · 1组','listening',!materials.some(m=>m.kind==='listening'));app.innerHTML+=task('reading','阅读带读','重点词提示 · 1组','reading',!materials.some(m=>m.kind==='reading'));}else if(!due.length)app.innerHTML+='<p class="empty">本周没有待复习的错题。</p>';
  app.innerHTML+=`<p class="source">内测：第 ${TEST_DATES.indexOf(today())+1} / 3 天 · 已跟读 ${Object.keys(state.learned).length} / 60 词</p>`;
}
function renderReview(due){
  const errors=state.attempts.filter(a=>!a.correct),ids=[...new Set(errors.map(a=>a.questionId))];if(!ids.length){app.innerHTML+='<p class="empty">还没有错题。</p>';return;}
  for(const kind of ['vocabulary','listening','reading']){const subset=ids.filter(id=>errors.find(e=>e.questionId===id).kind===kind);if(!subset.length)continue;app.innerHTML+=`<h2>${names[kind]} · ${subset.length}题</h2>`+subset.map(id=>{const q=resolveQuestion(id);if(!q)return '';return `<article class="task"><div class="number">↻</div><div><h2>${esc(q.title||q.prompt)}</h2><p>${due.some(d=>d.id===id)?'到期复习':'记录保留'} · 答错${errors.filter(e=>e.questionId===id).length}次</p></div><button data-review="${esc(id)}">重做</button></article>`;}).join('');}
}
function renderProgress(){const dates=[...new Set([...Object.values(state.learned),...state.attempts.map(a=>a.date)])].sort().reverse();app.innerHTML+=dates.length?dates.map(d=>`<div class="dayrow"><strong>${d}</strong><span>${Object.values(state.learned).filter(x=>x===d).length}词 · ${state.attempts.filter(a=>a.date===d).length}次作答</span></div>`).join(''):'<p class="empty">完成第一组后，这里会留下记录。</p>';app.innerHTML+='<p class="muted">跟读完成不代表发音评分；旧题复习不作为模考成绩。</p>';}
function renderParent(){
  app.innerHTML=`<a href="#today">返回今天</a><h1>家长空间</h1><p class="notice">这是三天内测版。记录仅保存在此浏览器，尚未跨设备同步。学习配音使用设备语音，不调用付费 AI。</p><form id="settings"><label class="field">称呼<input name="name" maxlength="40" required value="${esc(state.settings.name)}"></label><label class="field">考试日期<input name="exam" type="date" value="${esc(state.settings.exam)}" required></label><label class="field">内测日期<select name="testDate">${TEST_DATES.map((d,i)=>`<option value="${d}" ${today()===d?'selected':''}>第${i+1}天 · ${d.slice(5).replace('-', '月')}日</option>`).join('')}</select></label><label class="toggle"><input name="effects" type="checkbox" ${state.settings.effects?'checked':''}>答题提示音</label><button>保存</button></form><section class="section"><h2>内测内容</h2><p>60个不同词 · 3天，每天20词；3组阅读带读和3组听力交互。</p><p class="muted">试听听力只验证界面与答题节奏，不冒充原版录音。原版音频将在内测确认后接入。</p></section><section class="section"><h2>记录备份</h2><div class="actions"><button id="export">导出当前记录</button><button id="exportOriginal" class="quiet">导出原始记录</button><label class="field">恢复备份<input id="import" type="file" accept=".json,application/json"></label></div><p class="muted">旧版记录仍保留；恢复前会下载当前备份。</p></section>`;
  $('#settings').onsubmit=e=>{e.preventDefault();const f=new FormData(e.target);state.settings.name=String(f.get('name')).trim()||'同学';state.settings.exam=String(f.get('exam'));state.settings.testDate=String(f.get('testDate'));state.settings.effects=f.has('effects');save();notify('已保存');location.hash='today';render();};
  $('#export').onclick=()=>download(JSON.stringify(state,null,2),'pet-backup');$('#exportOriginal').onclick=()=>{try{download(JSON.stringify({v2:localStorage.getItem(KEY),v1:localStorage.getItem('pet-study-v1')},null,2),'pet-original');}catch{notify('浏览器阻止读取存储。');}};
  $('#import').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>5000000)throw Error();const incoming=JSON.parse(await f.text());if(!validState(incoming))throw Error();if(!confirm('恢复会替换当前浏览器的新版记录，继续吗？'))return;download(JSON.stringify(state,null,2),'pet-before-restore');localStorage.setItem(KEY,JSON.stringify(incoming));state=incoming;storageBlocked=false;render();notify('已恢复');}catch{notify('恢复失败：备份格式不正确，或浏览器不允许保存。');}};
}
function download(text,name){const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`${name}-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),5000);}
function show(){if(!modal.open)modal.showModal();}
function startWords(){const words=wordsFor(bank.slice(0,60),today());if(!words.length)return;const key=today()+':words';let index=state.sessions[key]?.index||0;if(index>=words.length)index=0;active={type:'words',words,index,key,auto:true,date:today()};showWord();}
function showWord(){
  stopAudio();const w=active.words[active.index];active.played=false;show();body.innerHTML=`<div class="tag">今日20词 · ${active.index+1} / 20</div><h2 class="word" lang="en">${esc(w.word)}</h2><p class="ipa">/${esc(w.ipa)}/</p><p class="meaning">${esc(w.meaning)}</p><div class="word-example"><p lang="en">${esc(w.sentence)}</p><p>${esc(w.translation)}</p></div><p class="source">${esc(w.sentenceKind)} · ${esc(w.source)}</p>${controls()}<div class="word-footer"><label class="toggle"><input id="autoWords" type="checkbox" ${active.auto?'checked':''}>连续带读</label><button id="wordDone" disabled>读好了，下一词</button></div>`;
  $('#autoWords').onchange=e=>active.auto=e.target.checked;$('#wordDone').onclick=completeWord;wirePlayer(()=>wordSteps(w,state.settings.rate));
}
function completeWord(){if(active?.type!=='words'||!active.played)return;const w=active.words[active.index];state.learned[w.id] ||= active.date;active.index++;state.sessions[active.key]={index:active.index};save();if(active.index>=active.words.length){markComplete('words');stopAudio();body.innerHTML='<h2>今天的20词读完了</h2><p>明天再来认一认。</p><button id="backToday">返回今天</button>';$('#backToday').onclick=close;return;}const auto=active.auto;showWord();if(auto)player.start(wordSteps(active.words[active.index],state.settings.rate));}
function vocabQuestion(w){const others=bank.filter(x=>x.id!==w.id&&!x.meaning.split(/[；，]/).some(m=>w.meaning.includes(m))),seed=[...w.id].reduce((n,c)=>n+c.charCodeAt(0),0),options=[w.meaning];for(let i=0;options.length<4&&i<others.length;i++){const m=others[(seed+i)%others.length].meaning;if(!options.includes(m))options.push(m);}const shift=seed%options.length;return {id:w.id,kind:'vocabulary',title:w.word,prompt:w.word,options:options.slice(shift).concat(options.slice(0,shift)),answer:(options.length-shift)%options.length,explain:w.meaning,word:w};}
function resolveQuestion(id){const w=bank.find(w=>w.id===id);if(w)return vocabQuestion(w);for(const m of materials){const q=m.questions.find(q=>q.id===id);if(q)return {...q,kind:m.kind,material:m};}return null;}
function startQuiz(qs,key,review=false){if(!qs.length){notify('现在没有待复习的题。');return;}const sessionKey=today()+':'+key;let index=state.sessions[sessionKey]?.index||0;if(index>=qs.length)index=0;active={type:'quiz',qs,index,key,sessionKey,review,date:today()};showQuestion();}
function materialPanel(m,q){
  const passage=`<details ${m.kind==='reading'?'open':''}><summary>${esc(m.title)} · 原文</summary><div class="passage" lang="en">${annotate(m.text,m.glossary)}</div></details>`;
  const trial=m.kind==='listening'?'<p class="notice compact">这是内测试听：用于验证播放、作答和错题流程；正式版再接入原版音频。</p>':'';
  const image=q.image?`<img class="question-image" src="${esc(q.image)}" alt="原题选项图片">`:'';
  return `<p class="source">${esc(m.source)}</p>${trial}${m.kind==='listening'?controls()+passage:passage+controls()}${image}`;
}
function showQuestion(){
  stopAudio();show();const q=active.qs[active.index];active.answered=false;const m=q.material;
  body.innerHTML=`<div class="tag">${names[q.kind]}${active.review?'复习':'带练'} · ${active.index+1} / ${active.qs.length}</div><h2 lang="en">${esc(q.prompt)}</h2>${m?materialPanel(m,q):'<button id="sayWord" class="quiet">听单词</button>'}<form id="answerForm"><fieldset class="options"><legend class="sr-only">选择答案</legend>${q.options.map((o,i)=>`<label class="option"><input type="radio" name="answer" value="${i}" required><span>${String.fromCharCode(65+i)}. ${esc(o)}</span></label>`).join('')}</fieldset><button>核对答案</button></form><div id="feedback" aria-live="polite"></div>`;
  if(m)wirePlayer(()=>m.text.split(/(?<=[.!?])\s+/).map(text=>({text,lang:'en-GB',rate:state.settings.rate,label:m.kind==='listening'?'试听内容':'带读原文'})));
  if(q.kind==='vocabulary')$('#sayWord').onclick=()=>player.start([{text:q.word.word,lang:'en-GB',rate:state.settings.rate,label:'听单词'}]);
  $('#answerForm').onsubmit=e=>{e.preventDefault();if(active.answered)return;active.answered=true;stopAudio();const choice=Number(new FormData(e.target).get('answer')),correct=choice===q.answer;state.attempts.push({id:crypto.randomUUID(),questionId:q.id,kind:q.kind,date:active.date,choice,correct,review:active.review});save();effect(correct,state.settings.effects);e.target.querySelectorAll('input,button').forEach(el=>el.disabled=true);$('#feedback').innerHTML=`<div class="feedback ${correct?'correct':'incorrect'}"><strong>${correct?'✓ 答对了':'再熟悉一下'}</strong><p>${correct?'':'正确答案：'+String.fromCharCode(65+q.answer)+'。 '}${esc(q.explain)}</p></div><button id="nextQuestion">${active.index+1===active.qs.length?'完成这组':'下一题'}</button>`;$('#nextQuestion').onclick=()=>{active.index++;state.sessions[active.sessionKey]={index:active.index};save();if(active.index>=active.qs.length){markComplete(active.key);body.innerHTML='<h2>这一组完成了</h2><p>复习记录已经留下。</p><button id="backToday">返回今天</button>';$('#backToday').onclick=close;}else showQuestion();};};
}
function annotate(text,glossary={}){const keys=Object.keys(glossary).sort((a,b)=>b.length-a.length);if(!keys.length)return esc(text).replace(/\n/g,'<br>');const pattern=new RegExp('\\b('+keys.map(k=>k.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')\\b','gi');let out='',last=0;for(const m of text.matchAll(pattern)){out+=esc(text.slice(last,m.index))+`<span class="vocab-mark">${esc(m[0])}<small>（${esc(glossary[m[0].toLowerCase()])}）</small></span>`;last=m.index+m[0].length;}return (out+esc(text.slice(last))).replace(/\n/g,'<br>');}
app.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.review){const q=resolveQuestion(b.dataset.review);if(q)startQuiz([q],'single-'+q.id,true);return;}const key=b.dataset.task;if(!key)return;if(key==='words'){startWords();return;}if(key==='check'){startQuiz(wordsFor(bank.slice(0,60),addDays(today(),-1)).filter(w=>state.learned[w.id]).map(vocabQuestion),'check');return;}if(key.startsWith('review-')){startQuiz(dueMistakes(state.attempts,today()).filter(d=>d.kind===key.slice(7)).map(d=>resolveQuestion(d.id)).filter(Boolean),key,true);return;}const list=materials.filter(m=>m.kind===key);if(!list.length)return;const m=list[Math.max(0,TEST_DATES.indexOf(today()))%list.length];startQuiz(m.questions.map(q=>({...q,kind:m.kind,material:m})),key);});
$('#parentButton').onclick=()=>{close();location.hash='parent';};
window.addEventListener('hashchange',()=>{stopAudio();if(modal.open)modal.close();render();});
let lastDate=today();setInterval(()=>{if(lastDate!==today()&&!modal.open){lastDate=today();render();}},30000);
app.innerHTML='<p role="status">正在准备今天的学习…</p>';
try{const v=await fetch('./vocabulary.json');if(!v.ok)throw Error();bank=await v.json();if(bank.length<60||new Set(bank.map(w=>w.word)).size!==bank.length)throw Error();const r=await fetch('./materials.json');if(!r.ok)throw Error();materials=await r.json();render();}catch{app.innerHTML='<p class="notice">学习资料没有加载成功，请检查网络后刷新。原有记录不会被清空。</p><button id="reload">重新加载</button>';$('#reload').onclick=()=>location.reload();}
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
