import * as THREE from 'three';
import { blockCoord, clamp } from './config.js';
import { makePerson, animateWalk } from './npc.js';
import { S } from './settings.js';

// ---------------------------------------------------------------- places
const R = 23.5;
const sw = (k, l, side, t = 0) => { const cx = blockCoord(k), cz = blockCoord(l); return side === 0 ? { x: cx + R, z: cz + t } : side === 1 ? { x: cx - R, z: cz + t } : side === 2 ? { x: cx + t, z: cz + R } : { x: cx + t, z: cz - R }; };
const STALL = { x: -13, z: -4 };
const D1 = sw(2, 2, 0, 8), D2 = sw(4, 2, 1, -8), D3 = sw(3, 4, 3, 12);
const GARAGE = sw(5, 4, 1, -6), HALA_P = sw(0, 5, 0, 0), SAFE = sw(1, 4, 0, 0);
const TOWER_DOOR = { x: 24, z: -14 }, VAULT = { x: 14, z: -3 };
const MURAD_P = sw(1, 1, 2, 0), WAREH = sw(6, 5, 0, 0);

// ---------------------------------------------------------------- cast
const LOOK = {
  saber: { female: false, kind: 'galabeya', old: true, skin: '#b07a50', hair: '#8c8c8c', style: 'short', stache: true, beard: 'stubble', top: '#d8d0bc', scale: 0.97, glasses: 'none' },
  gamal: { female: false, kind: 'casual', skin: '#b07a50', hair: '#15110e', style: 'short', stache: true, beard: 'stubble', shirt: 'polo', top: '#2f4f6f', bottom: '#2b2b33', hat: 'cap', hatColor: '#3a3a3a', glasses: 'none', noOld: true },
  hala: { female: true, kind: 'casual', hijab: true, skin: '#e6b68a', hair: '#2a1d14', style: 'long', shirt: 'solid', top: '#3d6b6b', bottom: '#2a2a35', glasses: 'none', noOld: true },
  murad: { female: false, kind: 'casual', uniform: 'police', skin: '#cf9a6a', hair: '#15110e', style: 'short', stache: true, glasses: 'none', noOld: true, scale: 1.04 },
  fathy: { female: false, kind: 'casual', old: true, skin: '#cf9a6a', hair: '#8c8c8c', style: 'side', stache: true, beard: 'goatee', shirt: 'solid', top: '#9aa0ae', bottom: '#6b707e', glasses: 'specs', scale: 1.0 },
  zizo: { female: false, kind: 'casual', skin: '#cf9a6a', hair: '#15110e', style: 'curly', shirt: 'jersey', top: '#d93a3a', c2: '#ffffff', bottom: '#2a3a66', scale: 0.9, glasses: 'none', noOld: true },
  goon1: { female: false, kind: 'casual', skin: '#80523a', hair: '#15110e', style: 'bald', beard: 'full', shirt: 'solid', top: '#15161a', bottom: '#222222', glasses: 'shades', scale: 1.06, noOld: true },
  goon2: { female: false, kind: 'casual', skin: '#e6b68a', hair: '#15110e', style: 'fade', beard: 'stubble', shirt: 'solid', top: '#1b1b20', bottom: '#222222', glasses: 'shades', scale: 1.02, noOld: true },
  off1: { female: false, kind: 'casual', uniform: 'police', skin: '#b07a50', hair: '#15110e', style: 'short', stache: true, glasses: 'none', noOld: true },
};
const NAMES = { yassin: 'ياسين', saber: 'عم صابر', gamal: 'أسطى جمال', hala: 'هالة', murad: 'كابتن مراد', fathy: 'الحاج فتحي', zizo: 'زيزو', goon1: 'رجل فتحي', goon2: 'رجل فتحي', off1: 'ظابط' };
const VOICE = { yassin: [1.0, 1.0], saber: [0.7, 0.88], gamal: [0.85, 1.0], hala: [1.3, 1.0], murad: [0.65, 0.95], fathy: [0.55, 0.88], zizo: [1.6, 1.1], goon1: [0.5, 0.95], goon2: [0.6, 1.0], off1: [0.8, 1.0] };
const COL = { yassin: '#ffb347', saber: '#e8d9a8', gamal: '#7fc4ff', hala: '#ff9ad5', murad: '#9be37f', fathy: '#ff6b6b', zizo: '#ffe066', goon1: '#c0c0c0', goon2: '#c0c0c0', off1: '#9be37f' };

// ---------------------------------------------------------------- cutscenes
const B = (who, text, o = {}) => Object.assign({ who, text }, o);
const CUTS = {
  A: { actors: [['yassin', STALL.x - 2.2, STALL.z + 1.4, 'saber'], ['saber', STALL.x + 0.6, STALL.z + 0.2, 'yassin']], beats: [
    B('saber', 'صباح الخير يا ياسين. صاحي بدري ليه النهاردة؟', { cam: 'wide' }),
    B('yassin', 'مفيش نوم يا عمّ صابر. وشّك مش مظبوط. فيه إيه؟'),
    B('saber', 'الحاج فتحي بعت رجالته إمبارح. عايز الدين كله، خمسين ألف جنيه، قبل ما الشمس تغيب.'),
    B('yassin', 'خمسين ألف؟! إنت مأخدتش غير عشرة!'),
    B('saber', 'الفايدة يا ابني. الفايدة بتاكل الأخضر واليابس. وعربية الكشري دي مليش غيرها.'),
    B('yassin', 'متقلقش. هلاقي حل. بس الأول، فيه طلبات الكشري مستنية. هوصّلها وأجيب بقشيش.'),
    B('saber', 'ربنا يحفظك. معاك تلات طلبات والزباين مبيستناش. اجري!', { cam: 'two' }),
  ] },
  B: { actors: [['yassin', 12.5, 32.5, 'zizo'], ['zizo', 15.2, 31.6, 'yassin']], beats: [
    B('zizo', 'ياسين! استنى! رجالة الحاج فتحي بتسأل عليك في الحارة كلها!', { cam: 'wide' }),
    B('yassin', 'عليا أنا؟ وعملت إيه؟'),
    B('zizo', 'قالوا إنك بتلم فلوس لعم صابر. مين قالهم، مش عارف.'),
    B('yassin', 'يعني فيه حد من الحارة بيبلّغ.'),
    B('zizo', 'أسطى جمال عايزك حالًا عند الكراج. قال الموضوع كبير أوي.'),
    B('yassin', 'تمام. روح اقعد عند عم صابر وماتتحركش.', { cam: 'two' }),
  ] },
  C: { actors: [['yassin', GARAGE.x - 2.6, GARAGE.z - 1.5, 'gamal'], ['gamal', GARAGE.x, GARAGE.z, 'yassin']], beats: [
    B('gamal', 'الحمد لله إنك جيت يا ياسين. اسمع كويس.', { cam: 'wide' }),
    B('gamal', 'فيه بنت اسمها هالة، محاسبة عند الحاج فتحي. هربت ومعاها دفتر الحسابات الحقيقي.'),
    B('yassin', 'وإيه اللي في الدفتر؟'),
    B('gamal', 'كل حاجة. الديون المزوّرة، الفوايد، حتى عقود بيوت الحارة. فتحي بيسرق الحارة بالورق.'),
    B('yassin', 'يعني الدفتر ده ممكن يمسح دين عمّ صابر؟'),
    B('gamal', 'ويمسح دين الحارة كلها. هي مستخبية في آخر الحارة الغربية. خد التاكسي وهاتها. وحافظ عليه يا بطل.', { cam: 'two' }),
  ] },
  D: { actors: [['yassin', HALA_P.x + 3, HALA_P.z - 1, 'hala'], ['hala', HALA_P.x, HALA_P.z, 'yassin']], beats: [
    B('hala', 'إنت ياسين؟ أسطى جمال قال إنك هتيجي. بسرعة، مفيش وقت.', { cam: 'wide' }),
    B('yassin', 'اركبي. هوديكي مكان آمن.'),
    B('hala', 'فتحي اشترى ناس في القسم. أول ما يعرف إني معاك، البوليس هيطاردنا.'),
    B('yassin', 'يبقى نسوق كويس. اتمسكي.', { cam: 'over' }),
  ] },
  E: { actors: [['yassin', SAFE.x - 2.6, SAFE.z - 1, 'hala'], ['hala', SAFE.x, SAFE.z, 'yassin']], beats: [
    B('hala', 'الله يكرمك. خلاص، هنا آمنين.', { cam: 'wide' }),
    B('yassin', 'إنتي بتقولي إن الدفتر عندك. فين هو؟'),
    B('hala', 'نصّه بس. نصه التاني في خزنة مكتب فتحي في البرج. لازم الاتنين مع بعض.'),
    B('yassin', 'يعني لازم أدخل برج فتحي.'),
    B('hala', 'من الباب الخلفي. وبعدها نوصّل الدفتر لكابتن مراد. هو الوحيد النضيف في القسم.', { cam: 'two' }),
  ] },
  F1: { actors: [['yassin', TOWER_DOOR.x - 1.8, TOWER_DOOR.z + 1.5, 'zizo'], ['zizo', TOWER_DOOR.x + 0.8, TOWER_DOOR.z + 2.2, 'yassin']], beats: [
    B('zizo', 'أنا جيت وراك. هقف هنا أراقب.', { cam: 'wide' }),
    B('yassin', 'قلتلك تقعد عند عم صابر!'),
    B('zizo', 'والله ما أقدر. الخزنة في الدور الأرضي. لو شفت حد هصفّر.'),
    B('yassin', 'هدخل وأطلع. ماتتحركش.', { cam: 'two' }),
  ] },
  F2: { actors: [['yassin', VAULT.x - 1.8, VAULT.z + 1.8, 'fathy'], ['fathy', VAULT.x + 2.2, VAULT.z - 1.0, 'yassin'], ['goon1', VAULT.x + 4.2, VAULT.z + 1.2, 'yassin'], ['goon2', VAULT.x + 3.4, VAULT.z + 3.4, 'yassin']], beats: [
    B('fathy', 'ياسين بتاع الكشري. جاي تقرا في دفاتر الناس؟', { cam: 'wide' }),
    B('yassin', 'جاي أخد اللي ليّا وليّ الحارة.'),
    B('fathy', 'الحارة دي أنا اللي اشتريتها. وإنت لسه بتحلم إن ليك فيها حاجة.'),
    B('yassin', 'الدفتر هيقول مين اللي اشترى مين.'),
    B('fathy', 'اتصلوا بالبوليس. قولولهم لصّ دخل برجي. وخدوا اللي في إيده.'),
    B('yassin', 'مش هتاخدوا حاجة!', { cam: 'low' }),
  ] },
  G: { actors: [['yassin', MURAD_P.x - 2.6, MURAD_P.z - 0.2, 'murad'], ['murad', MURAD_P.x, MURAD_P.z, 'yassin']], beats: [
    B('murad', 'إنت اللي بتدور عليك رجالة فتحي. اتكلم بسرعة.', { cam: 'wide' }),
    B('yassin', 'معايا نص دفتر الحسابات. ومعاه نص هالة. فيه كل حاجة.'),
    B('murad', 'ده مش كفاية يا بني. عايز شحنة جاية الليلة عند المرسى: فيها عقود الحارة المزوّرة.'),
    B('yassin', 'وأنا أجيبها.'),
    B('murad', 'هتلاقي رجالته هناك. هات الشحنة وارجع هنا. وسوق كويس.', { cam: 'two' }),
  ] },
  H: { actors: [['yassin', MURAD_P.x - 2.6, MURAD_P.z - 0.2, 'murad'], ['murad', MURAD_P.x, MURAD_P.z, 'yassin']], beats: [
    B('murad', 'برافو. الشحنة كاملة. دي كفاية تسجنه سنين.', { cam: 'wide' }),
    B('off1', 'كابتن! بلاغ من الحارة. فتحي ورجالته عند ميدان الحارة، بيهددوا عم صابر!'),
    B('yassin', 'عم صابر! لازم أروح دلوقتي!'),
    B('murad', 'روح. هحصّلك بالقوة. يلا يا ياسين!', { cam: 'two' }),
  ] },
  I: { actors: [['yassin', STALL.x - 1.8, STALL.z + 0.9, 'fathy'], ['saber', STALL.x + 0.6, STALL.z + 0.2, 'fathy'], ['fathy', STALL.x - 1.0, STALL.z + 3.4, 'saber'], ['goon1', STALL.x + 2.2, STALL.z + 3.2, 'saber'], ['goon2', STALL.x - 3.6, STALL.z + 3.0, 'saber'], ['zizo', STALL.x + 3.0, STALL.z + 0.6, 'fathy']], beats: [
    B('fathy', 'الميعاد انتهى يا صابر. الخمسين ألف أو العربية تتحرق.', { cam: 'wide' }),
    B('saber', 'أنا مديون بعشرة بس. الباقي فوايدك الحرام.'),
    B('yassin', 'مفيش حاجة هتتحرق يا حاج فتحي.', { cam: 'low' }),
    B('fathy', 'إنت تاني؟ فين الدفتر؟'),
    B('yassin', 'عند اللي يستاهل. الحارة كلها هتعرف الحقيقة.'),
    B('murad', 'اقبضوا عليه. حاج فتحي، إنت متهم بالنصب والتزوير والرشوة.', { cam: 'wide', enter: [['murad', STALL.x - 6, STALL.z + 2, 'fathy'], ['off1', STALL.x - 6.5, STALL.z + 4.5, 'fathy']] }),
    B('fathy', 'إنت مش عارف بتتعامل مع مين! أنا بيّ...', { cam: 'close' }),
    B('murad', 'عارف كويس. وشكرًا يا ياسين، الحارة مدينة لك.', { cam: 'over' }),
  ] },
  J: { actors: [['yassin', STALL.x - 2.0, STALL.z + 1.2, 'saber'], ['saber', STALL.x + 0.8, STALL.z + 0.1, 'yassin'], ['zizo', STALL.x - 0.6, STALL.z + 2.6, 'yassin'], ['hala', STALL.x + 3.2, STALL.z + 1.8, 'yassin'], ['gamal', STALL.x - 3.6, STALL.z + 0.2, 'saber'], ['murad', STALL.x + 1.8, STALL.z + 3.6, 'yassin']], beats: [
    B('saber', 'يا ابني، مش عارف أقولك إيه. الدين اتمسح وعربيتي لسه واقفة.', { cam: 'wide' }),
    B('gamal', 'والعقود رجعت لأصحابها. الحارة رجعت لأهلها.'),
    B('hala', 'والدفتر هيفضل شاهد على اللي حصل.'),
    B('zizo', 'وأنا قلتلكم إن ياسين بطل من الأول!'),
    B('saber', 'الكشري على حساب الحارة النهاردة. اتفضلوا كلكم!'),
    B('yassin', 'الحارة دي مش بتتباع. الحارة دي بتتحب.', { cam: 'two' }),
  ] },
};

// ---------------------------------------------------------------- chapters
const CH = [
  { title: 'كشري عم صابر', steps: [
    { k: 'actor', id: 'saber', x: STALL.x + 0.6, z: STALL.z + 0.2, face: 'yassin' },
    { k: 'cut', cut: 'A' },
    { k: 'unactor', id: 'zizo' },
    { k: 'seq', pts: [D1, D2, D3], texts: ['وصّل الطلب الأول', 'وصّل الطلب التاني', 'وصّل الطلب الأخير'], timer: 190, reward: 60 },
    { k: 'cut', cut: 'B' },
    { k: 'cash', n: 300 },
  ] },
  { title: 'الأسطى جمال', steps: [
    { k: 'actor', id: 'gamal', x: GARAGE.x, z: GARAGE.z, face: 'yassin' },
    { k: 'car', id: 'taxi', x: GARAGE.x - 3.2, z: GARAGE.z + 4, color: '#f2b705', type: 'taxi', h: 1.2 },
    { k: 'go', p: GARAGE, r: 4.5, text: 'روح لأسطى جمال عند الكراج', timer: 0 },
    { k: 'cut', cut: 'C' },
    { k: 'unactor', id: 'gamal' },
    { k: 'go', need: 'car:taxi', p: HALA_P, r: 6, text: 'اركب التاكسي وروح لهالة في آخر الغرب' },
    { k: 'cut', cut: 'D' },
    { k: 'stars', n: 2 },
    { k: 'go', need: 'car:taxi', p: SAFE, r: 6, text: 'وصّل هالة للمكان الآمن واهرب من البوليس', stars0: true },
    { k: 'cut', cut: 'E' },
    { k: 'cash', n: 500 },
  ] },
  { title: 'برج الحاج فتحي', steps: [
    { k: 'actor', id: 'zizo', x: TOWER_DOOR.x + 0.8, z: TOWER_DOOR.z + 2.2, face: 'yassin' },
    { k: 'go', p: TOWER_DOOR, r: 4.5, text: 'روح للباب الخلفي لبرج الحاج فتحي (عند الميدان)' },
    { k: 'cut', cut: 'F1' },
    { k: 'go', p: VAULT, r: 4, text: 'اطلع الخزنة بتاعة فتحي' },
    { k: 'cut', cut: 'F2' },
    { k: 'unactor', id: 'fathy' }, { k: 'unactor', id: 'goon1' }, { k: 'unactor', id: 'goon2' }, { k: 'unactor', id: 'zizo' },
    { k: 'car', id: 'getaway', x: 29.5, z: -24, color: '#2b6cb0', type: 'sedan', h: 0 },
    { k: 'stars', n: 3 },
    { k: 'go', need: 'car:getaway', p: GARAGE, r: 7, text: 'اهرب بالعربية للكراج وسيب البوليس وراك', stars0: true },
    { k: 'cash', n: 700 },
  ] },
  { title: 'الكابتن مراد', steps: [
    { k: 'actor', id: 'murad', x: MURAD_P.x, z: MURAD_P.z, face: 'yassin' },
    { k: 'go', need: 'car', p: MURAD_P, r: 6, text: 'روح لكابتن مراد في الشمال الغربي', timer: 0 },
    { k: 'cut', cut: 'G' },
    { k: 'unactor', id: 'murad' },
    { k: 'stars', n: 2 },
    { k: 'go', need: 'car', p: WAREH, r: 6, text: 'روح للمرسى (آخر الشرق) وهات شحنة العقود', timerFn: 45 },
    { k: 'go', need: 'car', p: MURAD_P, r: 6, text: 'ارجع بالشحنة للكابتن مراد وماتخليش البوليس يمسكك', stars0: true, timerFn: 45 },
    { k: 'actor', id: 'murad', x: MURAD_P.x, z: MURAD_P.z, face: 'yassin' }, { k: 'actor', id: 'off1', x: MURAD_P.x + 2.2, z: MURAD_P.z + 2.0, face: 'murad' },
    { k: 'cut', cut: 'H' },
    { k: 'unactor', id: 'murad' }, { k: 'unactor', id: 'off1' },
    { k: 'cash', n: 900 },
  ] },
  { title: 'الحارة المفتوحة', steps: [
    { k: 'actor', id: 'saber', x: STALL.x + 0.6, z: STALL.z + 0.2, face: 'fathy' },
    { k: 'actor', id: 'fathy', x: STALL.x - 1.0, z: STALL.z + 3.4, face: 'saber' }, { k: 'actor', id: 'goon1', x: STALL.x + 2.2, z: STALL.z + 3.2, face: 'saber' }, { k: 'actor', id: 'goon2', x: STALL.x - 3.6, z: STALL.z + 3.0, face: 'saber' },
    { k: 'go', need: 'car', p: { x: -27, z: STALL.z }, r: 8, text: 'اجري على ميدان الحارة قبل ما يحرقوا عربية عم صابر', timerFn: 40, stars0: true },
    { k: 'cut', cut: 'I' },
    { k: 'unactor', id: 'fathy' }, { k: 'unactor', id: 'goon1' }, { k: 'unactor', id: 'goon2' }, { k: 'unactor', id: 'murad' }, { k: 'unactor', id: 'off1' },
    { k: 'cash', n: 1500 },
    { k: 'cut', cut: 'J' },
    { k: 'end' },
  ] },
];

export const CHAPTER_TITLES = CH.map(c => c.title);

// ---------------------------------------------------------------- helpers
const AR_NUM = ['الأول', 'التاني', 'التالت', 'الرابع', 'الخامس'];
function tagTex(text) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(10,14,22,.78)'; g.beginPath(); (g.roundRect || g.rect).call(g, 6, 8, 244, 46, 14); g.fill();
  g.fillStyle = '#ffd166'; g.font = 'bold 26px Tahoma, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl'; g.fillText(text, 128, 33, 228);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function addBeret(m) {
  if (m.userData.imported) return;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, 7, 0, 1.45), new THREE.MeshLambertMaterial({ color: '#15171b' }));
  cap.scale.set(1.1, 0.55, 1.15); cap.position.set(0.01, 1.83, -0.01); m.add(cap);
}
const wrap = a => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };

// ---------------------------------------------------------------- Story
export class Story {
  constructor(scene, camera, ctx) {
    this.scene = scene; this.camera = camera; this.ctx = ctx;
    this.ch = 0; this.st = 0; this.done = false; this.active = false; this.paused = false;
    this.actors = {}; this.cars = {}; this.cine = null; this.cineActive = false; this.fov = 50;
    this.timer = 0; this.timerMax = 0; this.seqI = 0; this.cur = null; this.seen = {};
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.8, 0.38, 10, 28), new THREE.MeshBasicMaterial({ color: '#4fc3ff' }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 70, 14, 1, true), new THREE.MeshBasicMaterial({ color: '#4fc3ff', transparent: true, opacity: 0.26, fog: false, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.y = 35;
    this.marker = new THREE.Group(); this.marker.add(ring, beam); this.marker.visible = false; this.ring = ring; scene.add(this.marker);
    this.pt = null;
    this._buildCart(); this._buildUI();
    const L = ctx.saved.story; if (L) { this.ch = L.ch || 0; this.st = L.st || 0; this.done = !!L.done; }
  }

  // ---- the koshary cart (a real prop with a collider)
  _buildCart() {
    const g = new THREE.Group(), M = (c) => new THREE.MeshLambertMaterial({ color: c });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 1.1), M('#8a5a2b')); base.position.y = 0.95; g.add(base);
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 1.2), M('#d9d4c8')); top.position.y = 1.45; g.add(top);
    for (const x of [-0.85, 0.85]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 14), M('#222')); w.rotation.z = Math.PI / 2; w.position.set(x, 0.45, 0.7); g.add(w); const w2 = w.clone(); w2.position.z = -0.7; g.add(w2); }
    for (const [x, c] of [[-0.6, '#c9ccd1'], [0, '#b8bcc4'], [0.6, '#c9ccd1']]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.26, 0.34, 14), M(c)); p.position.set(x, 1.66, 0); g.add(p); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.5, 6), M('#555')); pole.position.set(1.0, 2.2, -0.45); g.add(pole);
    const can = new THREE.Mesh(new THREE.ConeGeometry(1.9, 0.55, 12), M('#c0392b')); can.position.set(0, 2.9, 0); g.add(can);
    const c = document.createElement('canvas'); c.width = 256; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#fff4c8'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#7a1f12'; x.font = 'bold 38px Tahoma, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.direction = 'rtl'; x.fillText('كشري صابر', 128, 34);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; const sg = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.48), new THREE.MeshBasicMaterial({ map: t })); sg.position.set(0, 1.08, 0.56); g.add(sg);
    g.position.set(STALL.x, 0.34, STALL.z - 1.7); g.rotation.y = 0; this.scene.add(g); this.cart = g;
    this.ctx.colliders.push({ minX: g.position.x - 1.3, maxX: g.position.x + 1.3, minZ: g.position.z - 0.8, maxZ: g.position.z + 0.8, h: 1.6 });
  }

  _buildUI() {
    const d = document.createElement('div'); d.id = 'cine';
    d.innerHTML = '<div class="cbar t"></div><div class="cbar b"></div><div id="cName"></div><div id="cText"></div><button id="cSkip">تخطي</button><div id="cNext">اضغط للتكملة</div>';
    document.body.appendChild(d);
    const ct = document.createElement('div'); ct.id = 'chTitle'; ct.innerHTML = '<small></small><b></b>'; document.body.appendChild(ct);
    this.ui = { d, name: d.querySelector('#cName'), text: d.querySelector('#cText'), ct };
    d.addEventListener('pointerdown', e => { if (e.target.id === 'cSkip') this.skipCut(); else this.nextBeat(true); });
    const st = document.createElement('style');
    st.textContent = '#cine{position:fixed;inset:0;z-index:40;display:none;touch-action:none}#cine .cbar{position:absolute;left:0;right:0;height:13vh;background:#000}#cine .t{top:0}#cine .b{bottom:0}#cName{position:absolute;bottom:calc(13vh + 74px);left:0;right:0;text-align:center;font-weight:900;font-size:clamp(14px,3.6vh,20px);text-shadow:0 2px 6px #000}#cText{position:absolute;bottom:calc(13vh + 12px);left:6vw;right:6vw;text-align:center;color:#fff;font-weight:700;font-size:clamp(15px,4vh,24px);line-height:1.35;text-shadow:0 2px 8px #000,0 0 3px #000;direction:rtl;height:60px;display:flex;align-items:center;justify-content:center}#cSkip{position:absolute;top:calc(13vh + 8px);right:14px;background:rgba(0,0,0,.55);color:#fff;border:1px solid #fff5;border-radius:10px;padding:7px 14px;font-family:inherit;font-size:14px;pointer-events:auto}#cNext{position:absolute;bottom:calc(13vh - 24px);right:16px;color:#ffffffaa;font-size:11px}body.cine .hud,body.cine #touchUI,body.cine #btnGear,body.cine #btnFull,body.cine #btnMenu,body.cine #ver{display:none!important}#chTitle{position:fixed;left:0;right:0;top:30%;z-index:41;text-align:center;color:#fff;pointer-events:none;opacity:0;direction:rtl}#chTitle small{display:block;color:#ffd166;font-size:clamp(14px,4vh,22px);letter-spacing:2px}#chTitle b{display:block;font-size:clamp(28px,9vh,56px);font-weight:900;text-shadow:0 4px 24px #000}#chTitle.show{animation:chT 3.4s ease both}@keyframes chT{0%{opacity:0;transform:translateY(12px)}15%,75%{opacity:1;transform:none}100%{opacity:0}}';
    document.head.appendChild(st);
  }

  // ---- actors
  _actor(id, x, z, face) {
    let a = this.actors[id];
    if (!a) {
      const mesh = makePerson(Object.assign({ role: 'story' }, LOOK[id]));
      if (LOOK[id].uniform === 'police') addBeret(mesh);
      const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex(NAMES[id]), depthTest: false, transparent: true })); tag.scale.set(1.5, 0.375, 1); tag.position.y = 2.35 / (LOOK[id].scale || 1); tag.renderOrder = 996; mesh.add(tag);
      this.scene.add(mesh); a = this.actors[id] = { id, mesh, x, z, yaw: 0, ty: 0, talk: 0, tag, head: 0.34 + 1.72 * (LOOK[id].scale || 1) };
    }
    a.x = x; a.z = z; a.mesh.position.set(x, 0.34, z); a.mesh.visible = true;
    if (face) this._face(a, face, true);
    return a;
  }
  _unactor(id) { const a = this.actors[id]; if (!a) return; this.scene.remove(a.mesh); delete this.actors[id]; }
  _pos(id) { if (id === 'yassin') { const P = this.ctx.P(); return { x: P.px, z: P.pz }; } const a = this.actors[id]; return a ? { x: a.x, z: a.z } : null; }
  _face(a, toId, snap) { const t = this._pos(toId); if (!t) return; a.ty = Math.atan2(t.x - a.x, t.z - a.z); if (snap) { a.yaw = a.ty; a.mesh.rotation.y = a.yaw; } }

  // ---- save
  save() { return { ch: this.ch, st: this.st, done: this.done }; }
  objective() { return this.done ? 'القصة خلصت: الحارة بقت مفتوحة' : (this.cur && this.cur.text) || 'الفصل ' + AR_NUM[this.ch] + ': ' + CH[this.ch].title; }

  // ---- lifecycle
  begin() {
    if (this.done) { this.active = false; return; }
    this.active = true; this.paused = false;
    // resuming mid-chapter: pull visible NPC cast back in; fresh chapter shows its title card
    if (this.st === 0) this._title();
    this._enter();
  }
  pause(on) {
    this.paused = on;
    if (on) { this.marker.visible = false; this.ctx.hud.timer(null); this.ctx.restore(); }
    else { this.active = !this.done; this._enter(); }
  }
  _title() { const c = this.ui.ct; c.querySelector('small').textContent = 'الفصل ' + AR_NUM[this.ch]; c.querySelector('b').textContent = CH[this.ch].title; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show'); }
  restartChapter(i) { this._clearAll(); this.ch = i; this.st = 0; this.done = false; this.paused = false; this.active = true; this._title(); this._enter(); this.ctx.save(); }
  _clearAll() { for (const id of Object.keys(this.actors)) this._unactor(id); this.marker.visible = false; this.ctx.hud.timer(null); this.timer = 0; this.cur = null; }

  onDeath() { if (!this.active || this.paused || this.cineActive) return; this.ctx.banner('فشلت. حاول تاني', '#ff6b6b', 1800); this._enter(true); }

  // ---- step engine
  _enter(retry) {
    const steps = CH[this.ch].steps, s = steps[this.st];
    this.cur = null; this.marker.visible = false; this.ctx.hud.timer(null); this.timer = 0; this.timerMax = 0; this.seqI = 0;
    if (!s) return this._endChapter();
    const k = s.k;
    if (k === 'cut') { if (this.seen[this.ch + ':' + this.st] && this._resumed) { this._next(); return; } this._startCut(CUTS[s.cut], s); return; }
    if (k === 'actor') { this._actor(s.id, s.x, s.z, s.face); this._next(); return; }
    if (k === 'unactor') { this._unactor(s.id); this._next(); return; }
    if (k === 'cash') { this.ctx.addCash(s.n); this.ctx.banner('+' + s.n + ' ج', '#7ee787', 1800); this.ctx.audio.success(); this._next(); return; }
    if (k === 'stars') { this.ctx.wantStars(s.n); this._next(); return; }
    if (k === 'car') {
      let c = this.cars[s.id];
      if (!c) { c = this.cars[s.id] = this.ctx.spawnCar(s.x, s.z, s.color, s.type); c.heading = s.h || 0; c.mesh.rotation.y = c.heading; }
      this._next(); return;
    }
    if (k === 'end') { this.done = true; this.active = false; this.ctx.save(); this.ctx.banner('النهاية... والحارة لسه فيها حكايات', '#ffd166', 4200); this.ctx.hud.mission('القصة خلصت. العب حر أو اعمل مهام جانبية', ''); this.ctx.restore(); return; }
    if (k === 'seq') {
      this.cur = { s, p: s.pts[0], text: s.texts[0] };
      if (!retry || !this.timer) { this.timer = this.timerMax = s.timer; }
    } else if (k === 'go') {
      this.cur = { s, p: s.p, text: s.text };
      if (s.timerFn) { const P = this.ctx.P(); this.timer = this.timerMax = Math.hypot(s.p.x - P.px, s.p.z - P.pz) / 14 + s.timerFn; }
    }
    this._hud(); this._mark(this.cur.p);
  }
  _next() { this.st++; this.ctx.save(); this._enter(); }
  _endChapter() {
    if (this.ch + 1 >= CH.length) { this.done = true; this.active = false; this.ctx.save(); return; }
    this.ch++; this.st = 0; this._title(); this.ctx.save(); this._enter();
  }
  _hud() { const c = this.cur; if (!c) return; this.ctx.hud.mission(c.text, 'الفصل ' + AR_NUM[this.ch] + ': ' + CH[this.ch].title); }
  _mark(p) { if (!p) { this.marker.visible = false; return; } this.marker.position.set(p.x, 0, p.z); this.marker.visible = true; this.pt = p; }
  markerPos() { return this.active && !this.paused && this.marker.visible ? this.pt : null; }

  _carObj(id) { return this.cars[id]; }
  update(dt, frozen) {
    if (this.cineActive) { this._cineUpdate(dt); }
    this._idleActors(dt);
    if (frozen || !this.active || this.paused || this.cineActive || !this.cur) return;
    this.ring.scale.setScalar(1 + Math.sin(performance.now() / 250) * 0.12);
    const s = this.cur.s, P = this.ctx.P(), inCar = this.ctx.getCar();
    if (this.timerMax > 0) {
      this.timer -= dt; this.ctx.hud.timer(clamp(this.timer / this.timerMax, 0, 1));
      if (this.timer <= 0) { this.ctx.banner('الوقت خلص. حاول تاني', '#ff6b6b', 2000); this.ctx.hud.timer(null); this.timerMax = 0; this._enter(true); return; }
    }
    let target = this.cur.p;
    if (s.k === 'go' && s.need) {
      const want = s.need.startsWith('car:') ? this._carObj(s.need.slice(4)) : null;
      const okCar = !!inCar && (!want || inCar.mesh === want.mesh);
      if (!okCar) {
        if (want) { target = { x: want.x, z: want.z }; this._mark(target); this.ctx.hud.mission(want ? 'اركب ' + (s.need === 'car:taxi' ? 'تاكسي أسطى جمال' : 'العربية') : 'اركب عربية', 'الفصل ' + AR_NUM[this.ch]); }
        else { const near = this.ctx.nearestCar && this.ctx.nearestCar(); if (near) { target = { x: near.x, z: near.z }; this._mark(target); } this.ctx.hud.mission('اركب أي عربية', 'الفصل ' + AR_NUM[this.ch]); }
        return;
      } else { this._hud(); this._mark(s.p); }
    }
    const d = Math.hypot(this.cur.p.x - P.px, this.cur.p.z - P.pz);
    if (d > (s.r || 4.5)) return;
    if (s.stars0 && this.ctx.stars() > 0) { this.ctx.hud.mission('اهرب من البوليس الأول', 'الفصل ' + AR_NUM[this.ch]); return; }
    if (s.k === 'seq') {
      this.ctx.addCash(s.reward); this.ctx.audio.pickup(); this.ctx.banner('تم التسليم +' + s.reward + ' ج', '#7ee787', 1500);
      this.seqI++;
      if (this.seqI >= s.pts.length) { this.timerMax = 0; this.ctx.hud.timer(null); this._next(); return; }
      this.cur.p = s.pts[this.seqI]; this.cur.text = s.texts[this.seqI]; this._hud(); this._mark(this.cur.p); return;
    }
    this.timerMax = 0; this.ctx.hud.timer(null); this.ctx.audio.pickup();
    this._next();
  }
  _idleActors(dt) {
    const P = this.ctx.P();
    if (this.cineActive) { const pm = this.ctx.playerMesh(), u = pm.userData; animateWalk(u, 0, 0, dt, true); const c = this.cine; if (c && c.b && c.b.who === 'yassin') { const t = performance.now() / 1000; u.aR.sh.rotation.x = -0.75 + Math.sin(t * 5.5) * 0.28; u.aR.el.rotation.x = -0.9 + Math.sin(t * 5.5 + 1) * 0.2; u.head.rotation.x = Math.sin(t * 6) * 0.05; u.head.rotation.y = 0; } }
    for (const id in this.actors) {
      const a = this.actors[id], d = Math.hypot(a.x - P.px, a.z - P.pz);
      a.tag.visible = !this.cineActive && d < 22; a.mesh.visible = d < 120 || this.cineActive;
      if (d > 70 && !this.cineActive) continue;
      const u = a.mesh.userData; animateWalk(u, 0, 0, dt, true);
      a.yaw += wrap(a.ty - a.yaw) * Math.min(1, dt * 7); a.mesh.rotation.y = a.yaw;
      if (a.talk > 0) { a.talk -= dt; const t = performance.now() / 1000; u.aR.sh.rotation.x = -0.75 + Math.sin(t * 5.5) * 0.28; u.aR.el.rotation.x = -0.9 + Math.sin(t * 5.5 + 1) * 0.2; u.aL.sh.rotation.x = -0.25 + Math.sin(t * 4.1) * 0.12; u.head.rotation.x = Math.sin(t * 6) * 0.05; u.head.rotation.y = 0; }
    }
  }

  // ---- cutscenes
  _startCut(def, step) {
    const ctx = this.ctx;
    ctx.clearStars(); ctx.forceExit(); ctx.lock(true);
    for (const [id, x, z, face] of def.actors) {
      if (id === 'yassin') ctx.teleport(x, z); else this._actor(id, x, z, null);
    }
    for (const [id, , , face] of def.actors) { const a = id === 'yassin' ? null : this.actors[id]; if (a) this._face(a, face, true); }
    ctx.playerFace(this.actors[def.actors.find(a => a[0] === 'yassin')[3]] || null);
    this.cine = { def, step, i: -1, t: 0, dur: 1, tts: false, ttsDone: true }; this.cineActive = true; this.marker.visible = false; ctx.hud.timer(null);
    document.body.classList.add('cine'); this.ui.d.style.display = 'block'; this.seen[this.ch + ':' + this.st] = 1;
    this.nextBeat();
  }
  nextBeat(user) {
    const c = this.cine; if (!c) return;
    if (user && c.t < 0.5) return;
    if (this._speaking) { try { speechSynthesis.cancel(); } catch (e) {} }
    c.i++;
    const b = c.def.beats[c.i];
    if (!b) return this._endCut();
    if (b.enter) for (const [id, x, z, face] of b.enter) { const a = this._actor(id, x, z, face); a.mesh.visible = true; }
    c.b = b; c.t = 0; c.dur = Math.max(2.3, 1.1 + b.text.length * 0.062);
    c.ttsDone = true; c.tts = false;
    const sp = b.who === 'yassin' ? null : this.actors[b.who];
    const listener = b.to || (c.def.actors.find(x => x[0] === b.who) || [])[3];
    // speaker and listener turn toward each other
    for (const [id] of c.def.actors.concat((b.enter || []))) { if (id === 'yassin') continue; const a = this.actors[id]; if (!a) continue; this._face(a, id === b.who ? (listener || 'yassin') : b.who); }
    if (b.who !== 'yassin') { const a = this.actors[b.who]; if (a) a.talk = c.dur; } else this.ctx.playerFace(this.actors[listener] || null);
    if (b.who !== 'yassin') this.ctx.playerFace(sp);
    this.ui.name.textContent = NAMES[b.who]; this.ui.name.style.color = COL[b.who] || '#fff'; this.ui.text.textContent = b.text;
    this._speak(b);
    this._shot(b, 0);
  }
  _speak(b) {
    this._speaking = false;
    if (S.voice === false || !('speechSynthesis' in window)) return;
    let voices = []; try { voices = speechSynthesis.getVoices() || []; } catch (e) { return; }
    const v = voices.find(x => /^ar[-_]EG/i.test(x.lang)) || voices.find(x => /^ar/i.test(x.lang));
    if (!v) return;
    try {
      const u = new SpeechSynthesisUtterance(b.text); u.voice = v; u.lang = v.lang; const [p, r] = VOICE[b.who] || [1, 1]; u.pitch = p; u.rate = r * 0.95; u.volume = Math.min(1, (S.volume || 0.8) + 0.2);
      const c = this.cine; c.tts = true; c.ttsDone = false; this._speaking = true;
      u.onend = u.onerror = () => { if (this.cine === c) c.ttsDone = true; };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* subtitles only */ }
  }
  _cineUpdate(dt) {
    const c = this.cine; if (!c || !c.b) return;
    c.t += dt;
    const ready = c.t >= c.dur && (c.ttsDone || c.t > c.dur * 2.6 + 4);
    if (ready) { c.autoWait = (c.autoWait || 0) + dt; if (c.autoWait > 0.35) { c.autoWait = 0; this.nextBeat(); } } else c.autoWait = 0;
  }
  _shot(b, f) {
    const c = this.cine, def = c.def, cam = this.camera;
    const who = b.who, to = b.to || (def.actors.find(x => x[0] === who) || [])[3] || 'yassin';
    const S_ = this._pos(who), L_ = this._pos(to) || S_;
    const hS = who === 'yassin' ? 2.06 : (this.actors[who] ? this.actors[who].head : 1.6), hL = to === 'yassin' ? 2.06 : (this.actors[to] ? this.actors[to].head : 1.6);
    let dx = L_.x - S_.x, dz = L_.z - S_.z; let dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl; const px = -dz, pz = dx;
    const type = b.cam || ((c.i % 2) ? 'close' : 'over'), k = 1 - f * 0.14, sway = Math.sin(performance.now() / 1700) * 0.05;
    const side = c.i % 2 ? 1 : -1;
    let pos, look, fov;
    if (type === 'close') { const d = 1.75 * k; pos = [S_.x + dx * d * 0.9 + px * d * 0.5 * side, hS + 0.0 + sway, S_.z + dz * d * 0.9 + pz * d * 0.5 * side]; look = [S_.x, hS - 0.04, S_.z]; fov = 33; }
    else if (type === 'over') { const d = 1.35; pos = [L_.x - dx * d + px * 0.7 * side, hL + 0.12 + sway, L_.z - dz * d + pz * 0.5 * side]; look = [S_.x, hS - 0.05, S_.z]; fov = 40; }
    else if (type === 'low') { const d = 2.5 * k; pos = [S_.x + dx * d + px * 0.9 * side, 1.0, S_.z + dz * d + pz * 0.9 * side]; look = [S_.x, hS + 0.05, S_.z]; fov = 44; }
    else if (type === 'two') { const mx = (S_.x + L_.x) / 2, mz = (S_.z + L_.z) / 2, d = (3.6 + dl * 0.5) * k; pos = [mx + px * d * side, 1.9 + sway, mz + pz * d * side]; look = [mx, 1.7, mz]; fov = 46; }
    else { // wide: frame everyone in the scene
      let mx = 0, mz = 0, n = 0, rad = 0; for (const [id] of def.actors) { const p = this._pos(id); if (p) { mx += p.x; mz += p.z; n++; } } mx /= n; mz /= n;
      for (const [id] of def.actors) { const p = this._pos(id); if (p) rad = Math.max(rad, Math.hypot(p.x - mx, p.z - mz)); }
      const ang = Math.atan2(dx, dz) + Math.PI / 2 + 0.35 + f * 0.25, d = (6.2 + rad * 1.5) * (1.06 - f * 0.1);
      pos = [mx + Math.sin(ang) * d, 3.0, mz + Math.cos(ang) * d]; look = [mx, 1.6, mz]; fov = 52;
    }
    cam.position.set(pos[0], pos[1], pos[2]); cam.lookAt(look[0], look[1], look[2]); this.fov = fov;
  }
  skipCut() { if (!this.cine) return; try { speechSynthesis.cancel(); } catch (e) {} this._endCut(); }
  _endCut() {
    const c = this.cine; if (!c) return;
    this._speaking = false; try { speechSynthesis.cancel(); } catch (e) {}
    this.cine = null; this.cineActive = false; this.ui.d.style.display = 'none'; document.body.classList.remove('cine');
    this.ctx.lock(false); this.ctx.camReset();
    for (const id in this.actors) { const a = this.actors[id]; a.talk = 0; }
    this.ctx.save(); this._next();
  }
}
