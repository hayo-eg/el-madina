// Hero look data: barber styles, clothes, saved look. No THREE here, so player.js can import it safely.
export const LOOK_KEY = 'madina_look_v1';
export const HAIR = [
  { id: 'buzz', n: 'حلاقة ماكينة', p: 40 }, { id: 'crop', n: 'كروب قصير', p: 50 }, { id: 'lowfade', n: 'فيد واطي', p: 70 },
  { id: 'highfade', n: 'فيد عالي', p: 70 }, { id: 'taper', n: 'تدريج ناعم', p: 80 }, { id: 'side', n: 'فرق جنب', p: 70 },
  { id: 'quiff', n: 'كويف', p: 90 }, { id: 'curlyfade', n: 'كيرلي وفيد', p: 90 }, { id: 'wavy', n: 'شعر موجة', p: 100 },
  { id: 'slick', n: 'ورا مسرّح', p: 90 }, { id: 'manbun', n: 'طويل معقود', p: 100 }, { id: 'beardfade', n: 'دقن وفيد', p: 110 },
];
export const HAIRCOL = ['#15110e', '#2a1d14', '#4a3626', '#6b4a2b', '#8c8c8c'];
export const TOPS = [
  { id: 't1', n: 'تيشيرت كحلي', p: 60, o: { shirt: 'solid', top: '#24325a', sleeves: false } },
  { id: 't2', n: 'تيشيرت مقلّم', p: 70, o: { shirt: 'stripe', top: '#f2efe6', c2: '#c0392b', sleeves: false } },
  { id: 't3', n: 'تيشيرت كورة', p: 90, o: { shirt: 'jersey', top: '#2b6cb0', c2: '#ffffff', sleeves: false } },
  { id: 't4', n: 'بولو أخضر', p: 100, o: { shirt: 'polo', top: '#2f6b3f', sleeves: false } },
  { id: 't5', n: 'هودي رمادي', p: 130, o: { shirt: 'hoodie', top: '#4a4d52', sleeves: true } },
  { id: 't6', n: 'قميص جينز', p: 120, o: { shirt: 'vstripe', top: '#8fb3d6', c2: '#ffffff', sleeves: true } },
  { id: 't7', n: 'قميص كاروهات', p: 120, o: { shirt: 'check', top: '#b8262a', c2: '#151515', sleeves: true } },
  { id: 't8', n: 'تيشيرت أسود برسمة', p: 110, o: { shirt: 'tee', top: '#141414', c2: '#d4b074', sleeves: false } },
  { id: 't9', n: 'هينلي زيتي', p: 110, o: { shirt: 'polo', top: '#5f6b3c', sleeves: true } },
  { id: 't10', n: 'جاكيت رياضي', p: 150, o: { shirt: 'vstripe', top: '#7a1f2a', c2: '#ffffff', sleeves: true } },
  { id: 't0', n: 'هودي أصفر (الأصلي)', p: 0, o: { shirt: 'hoodie', top: '#e0a030', sleeves: true } },
];
export const PANTS = [
  { id: 'p1', n: 'جينز غامق', p: 80, o: { bottom: '#2f3a4f' } },
  { id: 'p2', n: 'جينز فاتح', p: 80, o: { bottom: '#7fa6cf' } },
  { id: 'p3', n: 'كارجو زيتي', p: 100, o: { bottom: '#5c6038', pants: 'cargo' } },
  { id: 'p4', n: 'جوجر أسود', p: 90, o: { bottom: '#17181b', pants: 'jogger' } },
  { id: 'p5', n: 'سويت رمادي', p: 70, o: { bottom: '#9a9c9f', pants: 'jogger' } },
  { id: 'p6', n: 'تشينو كحلي', p: 90, o: { bottom: '#2b3558' } },
  { id: 'p7', n: 'تشينو بيج', p: 90, o: { bottom: '#c4b08a' } },
  { id: 'p8', n: 'بنطلون رسمي', p: 110, o: { bottom: '#3a3c40' } },
  { id: 'p9', n: 'بنطلون بني', p: 90, o: { bottom: '#6b4a2e' } },
  { id: 'p10', n: 'شورت جينز', p: 60, o: { bottom: '#7fa6cf', pants: 'shorts' } },
  { id: 'p0', n: 'جينز أزرق (الأصلي)', p: 0, o: { bottom: '#3b4f78' } },
];
export const SHOES = [
  { id: 's1', n: 'سنيكرز أزرق', p: 90, o: { shoe: '#3b6ea8' } },
  { id: 's2', n: 'بوت بني', p: 130, o: { shoe: '#6b4426', shoeStyle: 'boot' } },
  { id: 's3', n: 'موكاسين أسود', p: 100, o: { shoe: '#101010' } },
  { id: 's4', n: 'رياضي أبيض', p: 90, o: { shoe: '#f0f0ee' } },
  { id: 's5', n: 'كونفرس أحمر', p: 80, o: { shoe: '#c0392b', shoeStyle: 'hi' } },
  { id: 's6', n: 'شيلسي رمادي', p: 120, o: { shoe: '#7d7f84', shoeStyle: 'hi' } },
  { id: 's7', n: 'صندل', p: 40, o: { shoe: '#c9a67a' } },
  { id: 's8', n: 'بوت زيتي', p: 140, o: { shoe: '#4d5a38', shoeStyle: 'boot' } },
  { id: 's9', n: 'أكسفورد كحلي', p: 130, o: { shoe: '#262d4e' } },
  { id: 's0', n: 'رمادي (الأصلي)', p: 0, o: { shoe: '#8a8a88' } },
];
export const GLASSES = [
  { id: 'g0', n: 'من غير نظارة', p: 0, o: { glasses: 'none' } },
  { id: 'g1', n: 'طيّار أسود', p: 60, o: { glasses: 'shades' } },
  { id: 'g2', n: 'ويفارر سلحفاة', p: 70, o: { glasses: 'color', glassColor: '#4a2a14' } },
  { id: 'g3', n: 'دايرة دهبي', p: 60, o: { glasses: 'specs' } },
  { id: 'g4', n: 'رياضية زرقا', p: 70, o: { glasses: 'color', glassColor: '#1f8cff' } },
  { id: 'g5', n: 'تك أسود', p: 70, o: { glasses: 'color', glassColor: '#111111' } },
  { id: 'g6', n: 'قطة وردي', p: 60, o: { glasses: 'color', glassColor: '#ee82b4' } },
  { id: 'g7', n: 'كلوب ماستر', p: 80, o: { glasses: 'color', glassColor: '#2a2018' } },
  { id: 'g8', n: 'مراية فضي', p: 90, o: { glasses: 'color', glassColor: '#b8bcc4' } },
];
export const HATS = [
  { id: 'h0', n: 'من غير طاقية', p: 0, o: {} },
  { id: 'h1', n: 'كاب كحلي', p: 50, o: { hat: 'cap', hatColor: '#2a3a66' } },
  { id: 'h2', n: 'بيني رمادي', p: 40, o: { hat: 'beanie', hatColor: '#80848a' } },
  { id: 'h3', n: 'فيدورا بني', p: 90, o: { hat: 'fedora', hatColor: '#6b4a32' } },
  { id: 'h4', n: 'قبعة قش', p: 70, o: { hat: 'straw' } },
  { id: 'h5', n: 'شنطة ضهر', p: 80, o: { pack: '#6b3f24' } },
];
const BASE = { female: false, kind: 'casual', skin: '#cf9a6a', hair: '#15110e', style: 'short', stache: false, beard: null, old: false, scale: 1.0, look: true };
export const DEFAULT_LOOK = { hair: 'fixed', hairCol: 0, top: 't0', pants: 'p0', shoe: 's0', glasses: 'g3', hat: 'h5' };
const find = (arr, id) => arr.find(x => x.id === id) || arr[0];
export function lookOpts(L) {
  const o = Object.assign({}, BASE, { hair: HAIRCOL[L.hairCol || 0] });
  o.style = L.hair === 'fixed' ? 'short' : L.hair;
  Object.assign(o, find(TOPS, L.top).o, find(PANTS, L.pants).o, find(SHOES, L.shoe).o, find(GLASSES, L.glasses).o, find(HATS, L.hat).o);
  // data-driven: any item may carry glb:'file.glb' (whole-model variant, later one wins: tops, then hair)
  const g = [find(TOPS, L.top), HAIR.find(h => h.id === L.hair)].map(x => x && x.glb).filter(Boolean);
  if (g.length) o.glb = g[g.length - 1];
  return o;
}
export function loadLook() {
  try { const s = JSON.parse(localStorage.getItem(LOOK_KEY)); if (s && s.look) return { look: Object.assign({}, DEFAULT_LOOK, s.look), owned: s.owned || [] }; } catch (e) {}
  return { look: Object.assign({}, DEFAULT_LOOK), owned: [] };
}
export function saveLook(look, owned) { try { localStorage.setItem(LOOK_KEY, JSON.stringify({ look, owned })); } catch (e) {} }
export const ITEM_LISTS = { hair: HAIR, top: TOPS, pants: PANTS, shoe: SHOES, glasses: GLASSES, hat: HATS };
