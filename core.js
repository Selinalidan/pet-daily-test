export const START = '2026-09-11';
export const END = '2026-10-15';
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const stamp = key => Date.parse(key + 'T12:00:00Z');
export const addDays = (key, n) => new Date(stamp(key) + n * 86400000).toISOString().slice(0,10);
export const dayIndex = key => Math.floor((stamp(key) - stamp(START)) / 86400000);
export const daysUntil = (exam, today) => Math.round((stamp(exam) - stamp(today)) / 86400000);
export const isSunday = key => new Date(stamp(key)).getUTCDay() === 0;
export const wordsFor = (bank, key) => {
  const index = dayIndex(key);
  return index >= 0 && index < 35 ? bank.slice(index * 20, index * 20 + 20) : [];
};
export function initialState() {
  return {version:2, settings:{name:'茉莉', exam:'2026-10-17', effects:true, rate:0.85, testDate:'2026-09-11'}, learned:{}, attempts:[], sessions:{}, completed:{}};
}
export function validState(s) {
  const object = x => x && typeof x === 'object' && !Array.isArray(x);
  return s?.version === 2 && object(s.settings) && typeof s.settings.name === 'string' && s.settings.name.length <= 40 &&
    /^\d{4}-\d{2}-\d{2}$/.test(s.settings.exam) && (!s.settings.testDate || /^\d{4}-\d{2}-\d{2}$/.test(s.settings.testDate)) && typeof s.settings.effects === 'boolean' &&
    typeof s.settings.rate === 'number' && s.settings.rate >= 0.6 && s.settings.rate <= 1.2 &&
    object(s.learned) && Object.values(s.learned).every(x => /^\d{4}-\d{2}-\d{2}$/.test(x)) &&
    object(s.sessions) && Object.values(s.sessions).every(x => Number.isInteger(x.index) && x.index >= 0 && x.index <= 1000) &&
    object(s.completed) && Object.values(s.completed).every(x => x === true) &&
    Array.isArray(s.attempts) && s.attempts.every(a => typeof a.id === 'string' && typeof a.questionId === 'string' &&
      ['vocabulary','listening','reading'].includes(a.kind) && typeof a.correct === 'boolean' &&
      /^\d{4}-\d{2}-\d{2}$/.test(a.date) && Number.isInteger(a.choice) && typeof a.review === 'boolean');
}
// Keep first errors even when corrected later that day. Only a later-day review resolves daily debt.
export function dueMistakes(attempts, today) {
  const groups = new Map();
  for (const a of attempts) {
    if (a.date >= today) continue;
    if (!groups.has(a.questionId)) groups.set(a.questionId, []);
    groups.get(a.questionId).push(a);
  }
  const sunday = isSunday(today), weekStart = addDays(today, -6);
  const due = [];
  for (const [id, history] of groups) {
    const errors = history.filter(a => !a.correct);
    if (!errors.length) continue;
    const lastError = errors.at(-1);
    const reviewed = history.some(a => a.review && a.correct && a.date > lastError.date);
    const weekly = sunday && errors.some(a => a.date >= weekStart);
    const doneToday = attempts.some(a => a.questionId === id && a.date === today && a.review);
    if ((!reviewed || weekly) && !doneToday) due.push({id, kind:lastError.kind, count:errors.length, date:lastError.date});
  }
  return due.sort((a,b) => b.count-a.count || a.date.localeCompare(b.date));
}
export function wordChoices(word, bank) {
  const correct = word.meaning;
  const wrong = [...new Set(bank.filter(w => w.id !== word.id).map(w => w.meaning))].filter(m => m !== correct).slice(0, 3);
  const options = [correct, ...wrong];
  const shift = [...word.id].reduce((n,c) => n+c.charCodeAt(0),0) % options.length;
  return {options:options.slice(shift).concat(options.slice(0,shift)), answer:(options.length-shift)%options.length};
}
