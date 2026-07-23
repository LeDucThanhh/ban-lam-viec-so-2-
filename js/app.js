firebase.initializeApp({
  apiKey: "AIzaSyBPCfuKWdiQaNoCPB8zOdHehl_R6K4q02s",
  authDomain: "ban-lam-viec-so-2.firebaseapp.com",
  projectId: "ban-lam-viec-so-2",
  storageBucket: "ban-lam-viec-so-2.firebasestorage.app",
  messagingSenderId: "888516841131",
  appId: "1:888516841131:web:6737c1bdacc93bfee371ee",
  measurementId: "G-KGTZVYR3XG"
});

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
const COLLECTION = 'links';

let links = [];
let isAdmin = false;
let currentFilter = '';

function fixUrl(url) {
  if (!url) return url;
  if (!/^https?:\/\//i.test(url)) return 'https://' + url;
  return url;
}
function getDomain(url) {
  try { return new URL(fixUrl(url)).hostname; } catch { return url; }
}

// Bỏ dấu tiếng Việt để tìm kiếm không dấu: "bo y te" vẫn ra "Bộ Y tế"
function normText(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')                 // tách dấu thanh khỏi nguyên âm
    .replace(/[\u0300-\u036f]/g, '')   // xoá dấu vừa tách
    .replace(/đ/g, 'd')               // đ không tách được bằng NFD nên xử riêng
    .trim();
}

// --- Bộ icon SVG (line, đồng nhất) — chỉ giữ icon còn được EMOJI_MAP tham chiếu ---
const ICONS = {
  building:    '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  factory:     '<path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/>',
  sprout:      '<path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8Z"/><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2Z"/>',
  landmark:    '<line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/>',
  health:      '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>',
  graduation:  '<path d="M22 10v6"/><path d="M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  flask:       '<path d="M10 2v7.31"/><path d="M14 9.3V2"/><path d="M8.5 2h7"/><path d="M14 9.3a6.5 6.5 0 1 1-4 0"/><path d="M5.52 16h12.96"/>',
  scale:       '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
  handshake:   '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87"/><path d="M3 4h8l1 11"/><path d="M3 4 2 14l6.5 6.5a1 1 0 1 0 3-3"/>',
  palette:     '<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>',
  accessibility:'<circle cx="16" cy="4" r="1"/><path d="m18 19 1-7-6 1"/><path d="m5 8 3-3 5.5 3-2.36 3.5"/><path d="M4.24 14.5a5 5 0 0 0 6.88 6"/><path d="M13.76 17.5a5 5 0 0 0-6.88-6"/>',
  filetext:    '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  sliders:     '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
  creditcard:  '<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/>',
  link:        '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'
};
// Chuyển emoji cũ -> key icon mới
const EMOJI_MAP = {
  '🏗️':'building','🏭':'factory','🌾':'sprout','🏛️':'landmark','🏥':'health',
  '🎓':'graduation','🔬':'flask','⚖️':'scale','🤝':'handshake','🎨':'palette',
  '♿':'accessibility','📝':'filetext','🎛️':'sliders','💳':'creditcard','🔗':'link'
};

function iconKey(val) {
  if (!val) return 'link';
  if (ICONS[val]) return val;
  if (EMOJI_MAP[val]) return EMOJI_MAP[val];
  return 'link';
}
function iconSvg(val) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[iconKey(val)]}</svg>`;
}

// --- Default data seeding ---
const defaultLinks = [
  { name: "Hệ thống điều phối giải quyết TTHC", url: "https://quantricong.dichvucong.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703696902.png?alt=media&token=2bc21cb9-5549-4d21-87f4-249ef84b598d", category: "TW", order: 0 },
  { name: "Bộ Khoa học và Công nghệ", url: "https://motcua.mst.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704131048.png?alt=media&token=392c09db-aaaa-4072-9388-36710fb3e27d", category: "TW", order: 1 },
  { name: "Bộ Tư pháp", url: "https://motcua.moj.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704154580.png?alt=media&token=af1bfcd5-1d5d-4f2a-a153-4f66760fe501", category: "TW", order: 2 },
  { name: "Bộ Y tế", url: "https://motcua.moh.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704070202.png?alt=media&token=bf8f5f94-b1ed-4c67-8ab7-d0b8c99ea244", category: "TW", order: 3 },
  { name: "Bộ Nông nghiệp và Môi trường", url: "https://motcuannmt.mae.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703995184.jpg?alt=media&token=11696cce-6278-4104-9095-83703f6b0996", category: "TW", order: 4 },
  { name: "Hệ thống Quản lý Hộ tịch", url: "https://hotichdientu.moj.gov.vn/pages/home", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703708814.png?alt=media&token=f6ffca38-2e68-41ed-b67b-264d90583f23", category: "TW", order: 5 },
  { name: "CSDL Người khuyết tật", url: "https://nguoikhuyettat.moh.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704754026.png?alt=media&token=6c02df93-717e-4843-85e5-ec0eb0455767", category: "TW", order: 6 },
  { name: "Bộ Công Thương", url: "https://Motcua-tthc.moit.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703784708.png?alt=media&token=c340e10b-f8c8-4df4-9655-079dc7bfeac0", category: "TW", order: 7 },
  { name: "Bộ Nội vụ", url: "https://motcua.moha.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704027416.png?alt=media&token=b869f3f1-0ede-45ce-9861-1f5dd7ed9eb9", category: "TW", order: 8 },
  { name: "Bộ Giáo dục và Đào tạo", url: "https://motcua.moet.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704102810.png?alt=media&token=1f4a4fb3-c24e-43af-a3a6-b4853342ae22", category: "TW", order: 9 },
  { name: "Bộ Dân tộc và Tôn giáo", url: "https://gqtthc.bdttg.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704195580.png?alt=media&token=dd1f44c2-ec12-443b-8026-b7e6a209f4fa", category: "TW", order: 10 },
  { name: "Bộ Văn hóa, Thể thao và Du lịch", url: "https://dichvucong.bvhttdl.gov.vn/tiepnhan", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704233128.png?alt=media&token=4786feb5-aa1c-4030-86aa-41181bde59fe", category: "TW", order: 11 },
  { name: "Bộ Xây dựng", url: "https://Motcuabxd.moc.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703760588.png?alt=media&token=4ccc59a2-cc91-4a84-b87f-9277cae68027", category: "TW", order: 12 },
  { name: "Hệ thống quản trị thanh toán tập trung", url: "https://quantrithanhtoan.ndc.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704288192.png?alt=media&token=62314091-726e-4c91-a684-0dc8b5e22dde", category: "TW", order: 13 },
  { name: "Cổng Pháp luật quốc gia", url: "https://phapluat.gov.vn/trang-chu", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1783998405302.png?alt=media&token=339e92c5-ee79-4ff4-bd8d-6b1e3a87e8f1", category: "TW", order: 14 },
  { name: "Cổng Dịch vụ công Quốc gia", url: "https://dichvucong.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1784019033494.png?alt=media&token=0d63d81e-19ce-4459-9b0b-6175d2f8bf38", category: "TW", order: 15 },
  { name: "Hệ thống Quản lý văn bản và Hồ sơ công việc", url: "https://hscv.hatinh.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703555034.png?alt=media&token=57053105-cd8e-4c77-8213-d7031af7c529", category: "TINH", order: 0 },
  { name: "Hệ thống giải quyết TTHC", url: "https://Motcua.hatinh.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703581092.png?alt=media&token=57a6184c-ca9a-4929-9d83-a501e4394642", category: "TINH", order: 1 },
  { name: "Cổng TTĐT tỉnh Hà Tĩnh", url: "https://hatinh.gov.vn", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704642560.png?alt=media&token=536140a9-352e-4b7c-a1ff-b8018692805c", category: "TINH", order: 2 },
  { name: "Nền tảng tương tác giao tiếp công dân", url: "https://tuongtac.hatinh.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704603482.png?alt=media&token=86198738-a6f4-41e8-8294-72a08ff963f9", category: "TINH", order: 3 },
  { name: "Nền tảng đào tạo chuyển đổi số", url: "https://hatinh.mobiedu.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1783998515894.png?alt=media&token=aa1365cc-b780-477c-9831-43f23b1d16ea", category: "TINH", order: 4 },
  { name: "Hệ thống xử lý Phản ánh hiện trường", url: "https://cqs.hatinh.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782703565554.png?alt=media&token=a9baf03b-58e2-4ae7-8e32-29a39589674d", category: "TINH", order: 5 },
  { name: "Hệ thống văn bản chỉ đạo điều hành số", url: "https://qppl.hatinh.gov.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1783998592675.png?alt=media&token=1f9fdc44-ea9d-4ae1-84a4-90253600fb08", category: "TINH", order: 6 },
  { name: "Báo Hà Tĩnh", url: "https://baohatinh.vn/", logoUrl: "https://firebasestorage.googleapis.com/v0/b/public-administrative-services.firebasestorage.app/o/logos%2F1782704635092.png?alt=media&token=96774288-85a9-4949-b8be-b0ff838ed767", category: "TINH", order: 7 }
];

// --- Render ---
function renderCardHtml(l, i) {
  return `
    <a class="card" href="${escHtml(fixUrl(l.url))}" target="_blank" rel="noopener"
       data-id="${l.id}" style="animation-delay:${(i * 0.05).toFixed(2)}s">
      ${l.logoUrl ? `<span class="card-echo" style="background-image:url('${escHtml(l.logoUrl)}')"></span>` : ''}
      <div class="card-icon">${l.logoUrl ? `<img src="${escHtml(l.logoUrl)}" alt="">` : iconSvg(l.icon)}</div>
      <div class="card-info">
        <strong>${escHtml(l.name)}</strong>
        <span class="card-domain">${escHtml(getDomain(l.url))}</span>
      </div>
      <div class="card-actions">
        <button class="btn-edit" onclick="event.preventDefault();openEditModal('${l.id}')" title="Sửa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
        <button class="btn-delete" onclick="event.preventDefault();deleteLink('${l.id}')" title="Xóa"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/></svg></button>
      </div>
    </a>`;
}

// Phân nhóm theo Nhóm (category) admin đã chọn — mọi link đều có category
function isTinh(l) {
  return l.category === 'TINH';
}

let cardsAnimatedOnce = false;
function renderCards() {
  const query = normText(document.getElementById('searchInput').value);
  const filter = currentFilter;

  let filtered = links.filter(l => {
    const matchSearch = !query || normText(l.name).includes(query) || normText(l.url).includes(query);
    const matchFilter = !filter || (filter === 'TINH' ? isTinh(l) : !isTinh(l));
    return matchSearch && matchFilter;
  });

  filtered.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));

  // Chia 2 nhóm
  const tw = filtered.filter(l => !isTinh(l));
  const tinh = filtered.filter(l => isTinh(l));

  const gridTW = document.getElementById('gridTW');
  const gridTINH = document.getElementById('gridTINH');
  const sectionTW = document.getElementById('sectionTW');
  const sectionTINH = document.getElementById('sectionTINH');

  // Chỉ chạy animation fade lần render đầu; các lần cập nhật sau hiện ngay (đỡ "load lại")
  const skipAnim = cardsAnimatedOnce;
  cardsAnimatedOnce = true;
  gridTW.classList.toggle('ready', skipAnim);
  gridTINH.classList.toggle('ready', skipAnim);
  gridTW.innerHTML = tw.map(renderCardHtml).join('');
  gridTINH.innerHTML = tinh.map(renderCardHtml).join('');

  // Số đếm trên tiêu đề nhóm (đếm tăng dần lần đầu)
  setCount(document.getElementById('countTW'), tw.length, ' hệ thống');
  setCount(document.getElementById('countTINH'), tinh.length, ' hệ thống');

  // Ẩn/hiện section theo filter và kết quả
  sectionTW.style.display = (filter === 'TINH' || tw.length === 0) ? 'none' : '';
  sectionTINH.style.display = (filter === 'TW' || tinh.length === 0) ? 'none' : '';

  document.getElementById('noResults').style.display =
    (tw.length === 0 && tinh.length === 0) ? 'block' : 'none';

  initSortable();
}

// --- Tìm kiếm (debounce để không render lại mỗi lần gõ) ---
let searchTimer;
function onSearchInput() {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderCards, 120);
}

// --- Số đếm: tăng dần lần đầu, các lần sau đặt thẳng ---
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function setCount(el, target, suffix) {
  if (!el) return;
  // Chạy hiệu ứng đếm đúng 1 lần, khi lần đầu có dữ liệu thật (target > 0)
  if (!el.dataset.animated && target > 0 && !prefersReducedMotion) {
    el.dataset.animated = '1';
    const dur = 650, start = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - start) / dur);
      const val = Math.round(target * (1 - Math.pow(1 - p, 3)));
      el.textContent = val + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  } else {
    el.textContent = target + suffix;
  }
}

// --- Quầng sáng bám theo con trỏ trên thẻ (throttle 1 lần/khung hình) ---
let glowRaf = 0;
document.addEventListener('mousemove', (e) => {
  const card = e.target.closest && e.target.closest('.card');
  if (!card || glowRaf) return;
  const { clientX, clientY } = e;
  glowRaf = requestAnimationFrame(() => {
    glowRaf = 0;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', ((clientX - r.left) / r.width * 100).toFixed(1) + '%');
    card.style.setProperty('--my', ((clientY - r.top) / r.height * 100).toFixed(1) + '%');
  });
}, { passive: true });

// --- Tab lọc TW / Tỉnh ---
function setFilter(btn) {
  currentFilter = btn.dataset.filter;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderCards();
}

// --- Kéo thả sắp xếp (chỉ admin) ---
let sortableInstances = [];
function initSortable() {
  sortableInstances.forEach(s => s.destroy());
  sortableInstances = [];
  if (!isAdmin || typeof Sortable === 'undefined') return;
  ['gridTW','gridTINH'].forEach(gridId => {
    const grid = document.getElementById(gridId);
    if (!grid || grid.children.length === 0) return;
    sortableInstances.push(Sortable.create(grid, {
      animation: 200,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      filter: '.btn-edit, .btn-delete',
      preventOnFilter: false,
      onEnd: async function() {
        const cards = grid.querySelectorAll('.card[data-id]');
        const batch = db.batch();
        let changed = false;
        let order = 0;
        cards.forEach((card) => {
          const id = card.dataset.id;
          if (id.startsWith('default_')) return;
          batch.update(db.collection(COLLECTION).doc(id), { order: order });
          const link = links.find(l => l.id === id);
          if (link) link.order = order;
          order++;
          changed = true;
        });
        if (changed) {
          try {
            await batch.commit();
            notify('Đã lưu thứ tự mới!', 'success');
          } catch (e) {
            notify('Lỗi lưu thứ tự: ' + e.message, 'error');
          }
        }
      }
    }));
  });
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// --- Firestore realtime ---
let firstSnapshot = true;
function listenLinks() {
  db.collection(COLLECTION).onSnapshot(snap => {
    if (snap.empty) {
      // Firestore chưa có dữ liệu → giữ danh sách mặc định, không để trống
      links = defaultLinks.map((l, i) => ({ ...l, id: 'default_' + i }));
    } else {
      links = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    renderCards();
    if (firstSnapshot) { firstSnapshot = false; finishLoading(); }
  }, err => {
    console.warn('Firestore listen error:', err.message);
    finishLoading();
  });
}

// Seed 14 liên kết mặc định vào Firestore — chỉ chạy khi admin đã đăng nhập
async function seedIfEmptyAsAdmin() {
  try {
    const snap = await db.collection(COLLECTION).get();
    if (snap.empty) {
      const batch = db.batch();
      defaultLinks.forEach(link => batch.set(db.collection(COLLECTION).doc(), link));
      await batch.commit();
    }
  } catch (e) {
    console.warn('Seed error:', e.message);
  }
}

// --- Auth ---
const ICON_LOGIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>';
const ICON_LOGOUT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>';

auth.onAuthStateChanged(user => {
  isAdmin = !!user;
  document.body.classList.toggle('admin-mode', isAdmin);
  const btn = document.getElementById('btnAdminToggle');
  btn.innerHTML = (isAdmin ? ICON_LOGOUT : ICON_LOGIN) + (isAdmin ? ' Đăng xuất' : ' Đăng nhập');
  // Khi admin đăng nhập: nếu Firestore còn rỗng thì seed 14 liên kết mặc định
  if (user) seedIfEmptyAsAdmin();
  // Load lại danh sách liên kết khi đăng nhập / đăng xuất
  renderCards();
});

function showLoading() { document.getElementById('loadingOverlay').classList.add('active'); }
function hideLoading() { document.getElementById('loadingOverlay').classList.remove('active'); }

function toggleLogin() {
  if (isAdmin) {
    // Đăng xuất: hiện loading rồi load lại trang
    showLoading();
    auth.signOut().then(() => location.reload());
  } else {
    document.getElementById('loginModal').classList.add('active');
  }
}

async function doLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPassword').value;
  closeModal('loginModal');
  showLoading();
  try {
    await auth.signInWithEmailAndPassword(email, pass);
    hideLoading();
    notify('Đăng nhập thành công!', 'success');
  } catch (e) {
    hideLoading();
    document.getElementById('loginModal').classList.add('active');
    notify('Sai email hoặc mật khẩu!', 'error');
  }
}

// --- Upload logo ---
function previewLogo(input) {
  const file = input.files[0];
  if (!file) return;
  const preview = document.getElementById('logoPreview');
  const objUrl = URL.createObjectURL(file);
  preview.onload = () => URL.revokeObjectURL(objUrl);
  preview.src = objUrl;
  preview.classList.add('show');
}
// Nén logo về tối đa 256px trước khi upload (giữ trong suốt) — giảm mạnh dung lượng, upload nhanh
async function compressLogo(file) {
  if (!file.type || file.type === 'image/svg+xml') return file; // SVG giữ nguyên
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = URL.createObjectURL(file);
    });
    const max = 256;
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(img.src);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    return blob || file;
  } catch { return file; }
}

async function uploadLogo(file) {
  const blob = await compressLogo(file);
  const ref = storage.ref('logos/' + Date.now() + '.png');
  await ref.put(blob);
  return await ref.getDownloadURL();
}

// --- CRUD ---
function resetLogoUpload() {
  document.getElementById('linkLogoUrl').value = '';
  document.getElementById('logoFile').value = '';
  document.getElementById('logoPreview').classList.remove('show');
}

function openAddModal(category) {
  document.getElementById('linkModalTitle').textContent = 'Thêm liên kết';
  document.getElementById('linkEditId').value = '';
  document.getElementById('linkName').value = '';
  document.getElementById('linkUrl').value = '';
  document.getElementById('linkCategory').value = category || 'TW';
  resetLogoUpload();
  document.getElementById('linkModal').classList.add('active');
}

function openEditModal(id) {
  const link = links.find(l => l.id === id);
  if (!link) return;
  document.getElementById('linkModalTitle').textContent = 'Sửa liên kết';
  document.getElementById('linkEditId').value = id;
  document.getElementById('linkName').value = link.name;
  document.getElementById('linkUrl').value = link.url;
  document.getElementById('linkCategory').value = link.category || 'TW';
  resetLogoUpload();
  if (link.logoUrl) {
    document.getElementById('linkLogoUrl').value = link.logoUrl;
    document.getElementById('logoPreview').src = link.logoUrl;
    document.getElementById('logoPreview').classList.add('show');
  }
  document.getElementById('linkModal').classList.add('active');
}

async function saveLink() {
  const id = document.getElementById('linkEditId').value;
  const name = document.getElementById('linkName').value.trim();
  const url = fixUrl(document.getElementById('linkUrl').value.trim());
  const category = document.getElementById('linkCategory').value;

  // --- Validate TRƯỚC khi upload logo (tránh để file rác trên Storage) ---
  if (!name || !url) {
    notify('Vui lòng nhập tên và URL!', 'warning');
    return;
  }
  try { new URL(url); } catch {
    notify('URL không hợp lệ! Ví dụ: motcua.moh.gov.vn', 'warning');
    return;
  }

  // Kiểm tra trùng tên / URL (bỏ qua chính liên kết đang sửa)
  const normUrl = (u) => u.trim().toLowerCase().replace(/\/+$/, '');
  const normName = (n) => n.trim().toLowerCase();
  const dupName = links.find(l => l.id !== id && !l.id.startsWith('default_') && normName(l.name) === normName(name));
  if (dupName) {
    notify(`Tên "${name}" đã tồn tại trong danh sách!`, 'warning');
    return;
  }
  const dupUrl = links.find(l => l.id !== id && !l.id.startsWith('default_') && normUrl(l.url) === normUrl(url));
  if (dupUrl) {
    notify(`URL này đã tồn tại (liên kết "${dupUrl.name}")!`, 'warning');
    return;
  }

  // --- Hợp lệ → upload logo nếu admin chọn ảnh mới ---
  const logoFile = document.getElementById('logoFile').files[0];
  let logoUrl = document.getElementById('linkLogoUrl').value;

  showLoading();
  try {
    if (logoFile) logoUrl = await uploadLogo(logoFile);
    const data = { name, url, logoUrl: logoUrl || '', category };
    if (id) {
      await db.collection(COLLECTION).doc(id).update(data);
    } else {
      data.order = links.reduce((m, l) => Math.max(m, l.order ?? 0), -1) + 1;
      await db.collection(COLLECTION).add(data);
    }
    closeModal('linkModal');
    notify(id ? 'Đã cập nhật liên kết!' : 'Đã thêm liên kết mới!', 'success');
  } catch (e) {
    notify('Lỗi: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
}

function deleteLink(id) {
  const link = links.find(l => l.id === id);
  const name = link ? link.name : '';
  confirmPopup(`Bạn có chắc muốn xóa liên kết "${name}"?`, async () => {
    try {
      await db.collection(COLLECTION).doc(id).delete();
      notify('Đã xóa liên kết!', 'success');
    } catch (e) {
      notify('Lỗi: ' + e.message, 'error');
    }
  });
}

// --- Modal helpers ---
function openQrModal() {
  // Chỉ tải ảnh poster khi thực sự mở popup (không làm nặng lần tải trang đầu)
  const img = document.querySelector('#qrModal .qr-img');
  if (img && !img.getAttribute('src') && img.dataset.src) img.src = img.dataset.src;
  document.getElementById('qrModal').classList.add('active');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// --- Popup thông báo / xác nhận (hiện giữa màn hình) ---
const POPUP_ICONS = {
  success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  error:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 9v4M12 17h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>'
};

function notify(msg, type = 'success') {
  const icon = document.getElementById('popupIcon');
  icon.className = 'popup-icon ' + type;
  icon.innerHTML = POPUP_ICONS[type] || POPUP_ICONS.success;
  document.getElementById('popupMsg').textContent = msg;
  document.getElementById('popupButtons').innerHTML =
    '<button class="btn-save" onclick="closeModal(\'popupModal\')">Đóng</button>';
  document.getElementById('popupModal').classList.add('active');
}

function confirmPopup(msg, onYes) {
  const icon = document.getElementById('popupIcon');
  icon.className = 'popup-icon warning';
  icon.innerHTML = POPUP_ICONS.warning;
  document.getElementById('popupMsg').textContent = msg;
  const btns = document.getElementById('popupButtons');
  btns.innerHTML = '';
  const cancel = document.createElement('button');
  cancel.className = 'btn-cancel';
  cancel.textContent = 'Hủy';
  cancel.onclick = () => closeModal('popupModal');
  const ok = document.createElement('button');
  ok.className = 'btn-save';
  ok.textContent = 'Xóa';
  ok.onclick = () => { closeModal('popupModal'); onYes(); };
  btns.appendChild(cancel);
  btns.appendChild(ok);
  document.getElementById('popupModal').classList.add('active');
}

// --- Init ---
// Không hiện danh sách mặc định — chờ Firestore tải xong
const pageStart = Date.now();
function finishLoading() {
  const wait = Math.max(0, 500 - (Date.now() - pageStart));
  setTimeout(hideLoading, wait);
}

// Lắng nghe Firestore (đọc công khai). Nếu rỗng vẫn hiển thị danh sách mặc định.
try {
  listenLinks();
} catch (e) {
  console.warn('Firebase init error:', e.message);
  links = defaultLinks.map((l, i) => ({ ...l, id: 'default_' + i }));
  renderCards();
  finishLoading();
}
// Phòng trường hợp Firestore treo, hiện danh sách mặc định sau 3s
setTimeout(() => {
  if (links.length === 0) {
    links = defaultLinks.map((l, i) => ({ ...l, id: 'default_' + i }));
    renderCards();
  }
  hideLoading();
}, 3000);
