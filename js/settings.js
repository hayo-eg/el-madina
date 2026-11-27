const DEF = { quality: 'auto', handling: 'realistic', steer: 1, camDist: 1, volume: 0.8, shadows: true, hiRes: false, npc: 'high', traffic: 'normal', police: 'normal', autoAim: false, shoulder: false, radio: true, kmh: true };
let saved = {};
try { saved = JSON.parse(localStorage.getItem('madina_settings') || '{}'); } catch (e) {}
export const S = Object.assign({}, DEF, saved);
export function save() { try { localStorage.setItem('madina_settings', JSON.stringify(S)); } catch (e) {} }

const ROWS = [
  ['quality', 'الجودة', 'select', [['auto', 'تلقائي (حسب الموبايل)'], ['low', 'خفيفة (موبايل ضعيف)'], ['medium', 'متوسطة'], ['high', 'عالية']]],
  ['handling', 'نظام السواقة', 'select', [['realistic', 'واقعي'], ['arcade', 'أركيد (سهل)']]],
  ['steer', 'حساسية الدريكسيون', 'range', [0.5, 1.6, 0.1]],
  ['camDist', 'بعد الكاميرا', 'range', [0.7, 1.5, 0.1]],
  ['volume', 'الصوت', 'range', [0, 1, 0.05]],
  ['police', 'صعوبة البوليس', 'select', [['easy', 'سهل'], ['normal', 'عادي'], ['hard', 'صعب']]],
  ['npc', 'عدد الناس', 'select', [['low', 'قليل'], ['normal', 'عادي'], ['high', 'كتير']]],
  ['traffic', 'كثافة العربيات', 'select', [['low', 'خفيف'], ['normal', 'عادي'], ['high', 'زحمة']]],
  ['autoAim', 'مساعدة التصويب (خفيفة)', 'check'],
  ['shoulder', 'كاميرا فوق الكتف عند التصويب', 'check'],
  ['radio', 'راديو (موسيقى الثمانينات)', 'check'],
  ['shadows', 'الظلال', 'check'],
  ['hiRes', 'دقة عالية (أبطأ)', 'check'],
  ['kmh', 'السرعة كم/س (إلغاء = ميل/س)', 'check'],
];

export function buildSettingsUI(onChange) {
  const body = document.getElementById('settingsBody');
  body.innerHTML = '';
  for (const [key, label, type, opt] of ROWS) {
    const row = document.createElement('div'); row.className = 'row';
    const lb = document.createElement('span'); lb.textContent = label; row.appendChild(lb);
    let el;
    if (type === 'select') {
      el = document.createElement('select');
      for (const [v, t] of opt) { const o = document.createElement('option'); o.value = v; o.textContent = t; el.appendChild(o); }
      el.value = S[key];
      el.addEventListener('change', () => { S[key] = el.value; save(); onChange(key); });
    } else if (type === 'range') {
      el = document.createElement('input'); el.type = 'range'; el.min = opt[0]; el.max = opt[1]; el.step = opt[2]; el.value = S[key];
      el.addEventListener('input', () => { S[key] = parseFloat(el.value); save(); onChange(key); });
    } else {
      el = document.createElement('input'); el.type = 'checkbox'; el.checked = !!S[key];
      el.addEventListener('change', () => { S[key] = el.checked; save(); onChange(key); });
    }
    row.appendChild(el); body.appendChild(row);
  }
}
