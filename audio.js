export class GuidePlayer {
  constructor(onState, onEnd) { this.onState=onState; this.onEnd=onEnd; this.token=0; this.steps=[]; this.index=0; this.status='idle'; }
  start(steps) { this.stop(); this.steps=steps; this.index=0; this.run(); }
  stop() { this.token++; clearTimeout(this.timer); clearTimeout(this.watchdog); if ('speechSynthesis' in window) speechSynthesis.cancel(); this.status='idle'; }
  pause() {
    if (this.status==='waiting') this.remaining=Math.max(0,this.deadline-performance.now());
    if (!['speaking','waiting'].includes(this.status)) return;
    this.resumeType=this.status; this.token++; clearTimeout(this.timer); clearTimeout(this.watchdog);
    speechSynthesis.cancel(); this.status='paused'; this.emit();
  }
  resume() { if(this.status!=='paused') return; this.run(this.resumeType==='waiting'?this.remaining:undefined); }
  extend() { if(this.status==='waiting'){this.remaining=Math.max(0,this.deadline-performance.now())+3000; clearTimeout(this.timer); this.wait(this.remaining);} else if(this.status==='paused'&&this.resumeType==='waiting'){this.remaining+=3000;this.emit();} }
  repeat() { if(!this.steps.length)return; if(this.steps[this.index]?.wait&&this.index>0)this.index--; this.token++;clearTimeout(this.timer);clearTimeout(this.watchdog);speechSynthesis.cancel();this.run(); }
  emit(extra={}) { this.onState({status:this.status,index:this.index,step:this.steps[this.index],...extra}); }
  fail(message) { this.stop(); this.status='error';this.emit({message}); }
  wait(ms) { this.status='waiting';this.deadline=performance.now()+ms;this.emit();const token=this.token; this.timer=setTimeout(()=>{if(token===this.token){this.index++;this.run();}},ms); }
  run(remaining) {
    if(this.index>=this.steps.length){this.status='done';this.emit();this.onEnd();return;}
    const step=this.steps[this.index];
    if(step.wait){this.wait(remaining??step.wait);return;}
    if(!('speechSynthesis' in window)) {this.fail('当前浏览器不能朗读，请用 Safari 打开。');return;}
    const utterance=new SpeechSynthesisUtterance(step.text);const lang=step.lang||'en-GB';
    const voices=speechSynthesis.getVoices(); const voice=voices.find(v=>v.lang===lang)||voices.find(v=>v.lang.startsWith(lang.slice(0,2)));
    if(voices.length&&!voice){this.fail(lang.startsWith('en')?'设备缺少英语声音，请在系统设置中下载英语语音。':'设备缺少中文声音，请在系统设置中下载中文语音。');return;}
    if(voice)utterance.voice=voice; utterance.lang=lang;utterance.rate=step.rate||0.85;
    const token=++this.token; this.status='speaking';this.emit();
    utterance.onend=()=>{if(token!==this.token)return;clearTimeout(this.watchdog);this.index++;this.run();};
    utterance.onerror=e=>{if(token===this.token&& !['canceled','interrupted'].includes(e.error))this.fail('声音未能播放，请点重听重试。');};
    this.watchdog=setTimeout(()=>{if(token===this.token)this.fail('朗读没有响应，请点重听重试。');},Math.max(15000,step.text.length*250));
    this.utterance=utterance;speechSynthesis.speak(utterance);
  }
}
export function wordSteps(w, rate) {
  const speak=(text,lang='en-GB',label='听一听')=>({text,lang,rate:lang==='zh-CN'?0.95:rate,label});
  const wait=(ms,label='轮到你读')=>({wait:ms,label});
  const wordWait=Math.max(3000,w.word.length*430);
  const sentenceWait=Math.max(4500,w.sentence.split(/\s+/).length/110*60000*1.35);
  return [speak(w.word),speak(w.word),speak(w.word),wait(wordWait),
    speak(w.meaning,'zh-CN'),speak(w.meaning,'zh-CN'),speak(w.meaning,'zh-CN'),wait(Math.max(3000,w.meaning.length*380)),
    speak(w.sentence),speak(w.translation,'zh-CN'),speak('请跟读','zh-CN'),wait(sentenceWait),speak(w.sentence),wait(sentenceWait)];
}
let context;
export function effect(correct, enabled=true) {
  if(!enabled)return;
  try {
    context ||= new (window.AudioContext||window.webkitAudioContext)();context.resume();
    const notes=correct?[523.25,783.99]:[293.66];
    notes.forEach((hz,i)=>{const o=context.createOscillator(),g=context.createGain(),t=context.currentTime+i*.15;o.type='sine';o.frequency.value=hz;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.08,t+.015);g.gain.exponentialRampToValueAtTime(.001,t+.24);o.connect(g);g.connect(context.destination);o.start(t);o.stop(t+.25);});
  }catch{/* Visual feedback remains available when sound is unavailable. */}
}
