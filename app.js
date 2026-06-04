
const APP_VERSION = '1.0.0';
const DB_KEY = 'todo-pwa-state-v1';
const SETTINGS_KEY = 'todo-pwa-settings-v1';
const DRIVE_FILE_NAME = 'todo-pwa-data.json';
const REMINDER_OFFSETS = [30, 10, 5];

const state = {
  tasks: [],
  filter: 'all',
  calendarDate: new Date(),
  settings: { driveFolder: '', googleClientId: '', mockRemote: null, lastSyncedAt: null },
  googleToken: null,
  updateInfo: null,
  deferredInstallPrompt: null,
  notified: new Set(JSON.parse(localStorage.getItem('todo-pwa-notified') || '[]'))
};

const $ = (id) => document.getElementById(id);
const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => [...root.querySelectorAll(sel)];
const pad = (n) => String(n).padStart(2, '0');
const formatDateTime = (date) => `${date.getFullYear()}/${pad(date.getMonth()+1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
const parseDateTime = (value) => {
  const m = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
  return Number.isNaN(d.getTime()) ? null : d;
};
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function loadState(){
  state.tasks = JSON.parse(localStorage.getItem(DB_KEY) || '[]');
  state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
}
function saveTasks({sync=true} = {}){
  localStorage.setItem(DB_KEY, JSON.stringify(state.tasks));
  renderAll();
  if (sync) debounceSync();
}
function saveSettings(){
  state.settings.driveFolder = $('driveFolder').value.trim();
  state.settings.googleClientId = $('googleClientId').value.trim();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
  setDriveStatus('設定已儲存');
}

function renderAll(){ renderTasks(); renderCalendar(); renderSettings(); }
function renderTasks(){
  const list = $('taskList'); list.innerHTML = '';
  const now = new Date();
  const todayKey = formatDateKey(now);
  const filtered = state.tasks
    .filter(t => state.filter === 'all' ||
      (state.filter === 'completed' && t.completed) ||
      (state.filter === 'today' && formatDateKey(new Date(t.reminderAt)) === todayKey) ||
      (state.filter === 'upcoming' && !t.completed && new Date(t.reminderAt) >= now))
    .sort((a,b) => new Date(a.reminderAt) - new Date(b.reminderAt));
  $('emptyState').classList.toggle('hidden', filtered.length !== 0);
  for (const task of filtered){
    const node = $('taskTemplate').content.firstElementChild.cloneNode(true);
    node.dataset.id = task.id;
    node.classList.toggle('completed', task.completed);
    qs('.task-check', node).checked = task.completed;
    qs('.task-title', node).textContent = task.title;
    qs('.task-body', node).textContent = task.body || '';
    qs('.task-time', node).textContent = formatDateTime(new Date(task.reminderAt));
    qs('.task-check', node).addEventListener('click', (e) => { e.stopPropagation(); toggleComplete(task.id); });
    qs('.edit-btn', node).addEventListener('click', (e) => { e.stopPropagation(); openTaskModal(task.id); });
    qsa('.delete-btn, .swipe-delete', node).forEach(btn => btn.addEventListener('click', (e) => { e.stopPropagation(); deleteTask(task.id); }));
    qs('.swipe-content', node).addEventListener('click', () => openTaskModal(task.id));
    attachSwipeDelete(node);
    list.appendChild(node);
  }
}
function formatDateKey(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function renderCalendar(){
  const d = state.calendarDate;
  $('calendarTitle').textContent = `${d.getFullYear()} 年 ${d.getMonth()+1} 月`;
  const grid = $('calendarGrid'); grid.innerHTML = '';
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const start = new Date(first); start.setDate(first.getDate() - first.getDay());
  for(let i=0;i<42;i++){
    const day = new Date(start); day.setDate(start.getDate()+i);
    const cell = document.createElement('button'); cell.type='button'; cell.className='day';
    cell.classList.toggle('outside', day.getMonth() !== d.getMonth());
    cell.classList.toggle('today', formatDateKey(day) === formatDateKey(new Date()));
    cell.innerHTML = `<span class="day-num">${day.getDate()}</span>`;
    const dayTasks = state.tasks.filter(t => formatDateKey(new Date(t.reminderAt)) === formatDateKey(day)).slice(0,3);
    for (const t of dayTasks){ const el=document.createElement('span'); el.className='dot-task'; el.textContent=t.title; cell.appendChild(el); }
    cell.addEventListener('click', () => { openTaskModal(null, day); });
    grid.appendChild(cell);
  }
}
function renderSettings(){
  $('driveFolder').value = state.settings.driveFolder || '';
  $('googleClientId').value = state.settings.googleClientId || '';
  $('currentVersion').textContent = APP_VERSION;
  $('notificationStatus').textContent = 'Notification' in window ? Notification.permission : '不支援';
}

function openTaskModal(id=null, date=null){
  const task = id ? state.tasks.find(t => t.id === id) : null;
  $('modalTitle').textContent = task ? '編輯事件' : '新增事件';
  $('taskId').value = task?.id || '';
  $('taskTitle').value = task?.title || '';
  $('taskBody').value = task?.body || '';
  const defaultDate = date ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0) : new Date(Date.now()+60*60*1000);
  $('taskReminder').value = task ? formatDateTime(new Date(task.reminderAt)) : formatDateTime(defaultDate);
  $('deleteInModal').classList.toggle('hidden', !task);
  $('taskModal').showModal();
}
function closeTaskModal(){ $('taskModal').close(); }
function submitTask(e){
  e.preventDefault();
  const reminder = parseDateTime($('taskReminder').value);
  if (!reminder) return alert('提醒時間格式需為 YYYY/MM/DD HH:mm');
  const id = $('taskId').value;
  const payload = { title: $('taskTitle').value.trim(), body: $('taskBody').value.trim(), reminderAt: reminder.toISOString(), updatedAt: new Date().toISOString() };
  if (!payload.title) return alert('請輸入標題');
  if (id){ Object.assign(state.tasks.find(t => t.id === id), payload); }
  else { state.tasks.push({ id: uid(), completed: false, createdAt: new Date().toISOString(), ...payload }); }
  closeTaskModal(); saveTasks();
}
function toggleComplete(id){ const t=state.tasks.find(x=>x.id===id); if(t){t.completed=!t.completed;t.updatedAt=new Date().toISOString();saveTasks();} }
function deleteTask(id){ state.tasks = state.tasks.filter(t => t.id !== id); saveTasks(); }

function attachSwipeDelete(row){
  let startX=0, currentX=0, tracking=false;
  row.addEventListener('pointerdown', e => { if (window.matchMedia('(min-width:721px)').matches) return; tracking=true; startX=e.clientX; currentX=e.clientX; row.setPointerCapture?.(e.pointerId); });
  row.addEventListener('pointermove', e => { if(!tracking) return; currentX=e.clientX; });
  row.addEventListener('pointerup', () => { if(!tracking) return; const dx=currentX-startX; qsa('.task-row.show-delete').forEach(x=>{if(x!==row)x.classList.remove('show-delete')}); row.classList.toggle('show-delete', dx < -45); if(dx > 45) row.classList.remove('show-delete'); tracking=false; });
}

async function requestNotificationPermission(){
  if (!('Notification' in window)) return alert('此瀏覽器不支援 Notification API');
  const result = await Notification.requestPermission();
  $('notificationStatus').textContent = result;
}
function reminderLoop(){
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = Date.now();
  for (const task of state.tasks){
    if (task.completed) continue;
    const due = new Date(task.reminderAt).getTime();
    for (const offset of REMINDER_OFFSETS){
      const notifyAt = due - offset*60*1000;
      const key = `${task.id}-${offset}`;
      if (now >= notifyAt && now < notifyAt + 60*1000 && !state.notified.has(key)){
        new Notification(`任務提醒：${task.title}`, { body: `${offset} 分鐘後：${task.body || formatDateTime(new Date(task.reminderAt))}`, icon: './icons/icon-192.png', tag: key });
        state.notified.add(key); localStorage.setItem('todo-pwa-notified', JSON.stringify([...state.notified]));
      }
    }
  }
}

function extractFolderId(input){
  const m = /folders\/([a-zA-Z0-9_-]+)/.exec(input) || /id=([a-zA-Z0-9_-]+)/.exec(input);
  return m ? m[1] : input.trim();
}
function setDriveStatus(msg){ $('driveStatus').textContent = msg; $('syncStatus').textContent = msg; }
function getSyncPayload(){ return { schema: 1, updatedAt: new Date().toISOString(), tasks: state.tasks }; }
function mergeRemoteTasks(remoteTasks=[]){
  const map = new Map(state.tasks.map(t => [t.id, t]));
  for (const rt of remoteTasks){
    const lt = map.get(rt.id);
    if (!lt || new Date(rt.updatedAt || rt.createdAt) > new Date(lt.updatedAt || lt.createdAt)) map.set(rt.id, rt);
  }
  state.tasks = [...map.values()]; saveTasks({sync:false});
}
let syncTimer;
function debounceSync(){ clearTimeout(syncTimer); syncTimer=setTimeout(syncNow, 1200); }
async function googleAuth(){
  saveSettings();
  if (!state.settings.googleClientId) return alert('請先輸入 Google OAuth Client ID；或直接使用模擬同步。');
  if (!window.google?.accounts?.oauth2) return alert('Google Identity Services 尚未載入，請確認網路連線。');
  const client = google.accounts.oauth2.initTokenClient({
    client_id: state.settings.googleClientId,
    scope: 'https://www.googleapis.com/auth/drive.file',
    callback: (resp) => { state.googleToken = resp.access_token; setDriveStatus('Google 授權成功'); syncNow(); }
  });
  client.requestAccessToken();
}
async function driveFetch(url, options={}){
  if (!state.googleToken) throw new Error('尚未 Google 授權');
  return fetch(url, { ...options, headers: { Authorization: `Bearer ${state.googleToken}`, ...(options.headers||{}) } });
}
async function findDriveFile(folderId){
  const q = encodeURIComponent(`'${folderId}' in parents and name='${DRIVE_FILE_NAME}' and trashed=false`);
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`);
  if(!res.ok) throw new Error(await res.text());
  const data = await res.json(); return data.files?.[0];
}
async function createDriveFile(folderId, payload){
  const boundary = 'todo_boundary_' + Date.now();
  const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json', parents: [folderId] };
  const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(payload,null,2)}\r\n--${boundary}--`;
  const res = await driveFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', { method:'POST', headers:{'Content-Type':`multipart/related; boundary=${boundary}`}, body });
  if(!res.ok) throw new Error(await res.text()); return res.json();
}
async function updateDriveFile(fileId, payload){
  const res = await driveFetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload,null,2) });
  if(!res.ok) throw new Error(await res.text()); return res.json();
}
async function readDriveFile(fileId){
  const res = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`);
  if(!res.ok) throw new Error(await res.text()); return res.json();
}
async function syncNow(){
  saveSettings();
  const folderId = extractFolderId(state.settings.driveFolder || '');
  try{
    if (!folderId) return setDriveStatus('尚未設定 Drive 資料夾');
    if (!state.googleToken){
      // Static demo fallback: stores mock remote data locally to show sync contract.
      const remote = state.settings.mockRemote;
      if (remote?.tasks) mergeRemoteTasks(remote.tasks);
      state.settings.mockRemote = getSyncPayload();
      state.settings.lastSyncedAt = new Date().toISOString();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
      return setDriveStatus(`模擬同步完成：${formatDateTime(new Date())}`);
    }
    setDriveStatus('同步中...');
    let file = await findDriveFile(folderId);
    if (file){ const remote = await readDriveFile(file.id); mergeRemoteTasks(remote.tasks); await updateDriveFile(file.id, getSyncPayload()); }
    else { await createDriveFile(folderId, getSyncPayload()); }
    state.settings.lastSyncedAt = new Date().toISOString(); localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    setDriveStatus(`Google Drive 同步完成：${formatDateTime(new Date())}`);
  } catch(err){ console.error(err); setDriveStatus(`同步失敗：${err.message?.slice(0,120) || err}`); }
}

async function checkForUpdates(){
  try{
    const res = await fetch('./version.json?ts=' + Date.now(), { cache: 'no-store' });
    const info = await res.json(); state.updateInfo = info;
    $('latestVersion').textContent = info.version;
    $('updateNotes').textContent = info.updateNotes || '';
    $('applyUpdate').classList.toggle('hidden', compareVersions(info.version, APP_VERSION) <= 0);
  }catch(e){ $('latestVersion').textContent = '檢查失敗'; $('updateNotes').textContent = e.message; }
}
function compareVersions(a,b){
  const pa=String(a).split('.').map(Number), pb=String(b).split('.').map(Number);
  for(let i=0;i<Math.max(pa.length,pb.length);i++){ const d=(pa[i]||0)-(pb[i]||0); if(d) return d; } return 0;
}
async function applyUpdate(){
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg){ await reg.update(); reg.waiting?.postMessage({type:'SKIP_WAITING'}); }
  caches?.keys?.().then(keys => keys.forEach(k => caches.delete(k))).finally(() => location.reload());
}
function registerPWA(){
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.register('./service-worker.js');
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
  }
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.deferredInstallPrompt=e; $('installBtn').classList.remove('hidden'); });
}
function attachCalendarSwipe(){
  const el=$('calendarSwipeArea'); let sx=0, ex=0;
  el.addEventListener('pointerdown', e=>{sx=e.clientX; ex=e.clientX;});
  el.addEventListener('pointermove', e=>{ex=e.clientX;});
  el.addEventListener('pointerup', ()=>{ const dx=ex-sx; if(dx<-55) changeMonth(1); if(dx>55) changeMonth(-1); });
}
function changeMonth(delta){ state.calendarDate = new Date(state.calendarDate.getFullYear(), state.calendarDate.getMonth()+delta, 1); renderCalendar(); }
function bindEvents(){
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => { qsa('.tab').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); qsa('.page').forEach(p=>p.classList.remove('active')); $(`${btn.dataset.page}Page`).classList.add('active'); }));
  qsa('.chip').forEach(btn => btn.addEventListener('click', () => { qsa('.chip').forEach(b=>b.classList.remove('active')); btn.classList.add('active'); state.filter=btn.dataset.filter; renderTasks(); }));
  $('openCreateModal').addEventListener('click', () => openTaskModal());
  $('taskForm').addEventListener('submit', submitTask);
  $('closeModal').addEventListener('click', closeTaskModal); $('cancelModal').addEventListener('click', closeTaskModal);
  $('deleteInModal').addEventListener('click', () => { const id=$('taskId').value; if(id){ deleteTask(id); closeTaskModal(); }});
  $('prevMonth').addEventListener('click', () => changeMonth(-1)); $('nextMonth').addEventListener('click', () => changeMonth(1));
  $('requestNotification').addEventListener('click', requestNotificationPermission);
  $('saveSettings').addEventListener('click', saveSettings); $('googleSignIn').addEventListener('click', googleAuth); $('syncNow').addEventListener('click', syncNow);
  $('checkUpdate').addEventListener('click', checkForUpdates); $('applyUpdate').addEventListener('click', applyUpdate);
  $('installBtn').addEventListener('click', async () => { if(state.deferredInstallPrompt){ state.deferredInstallPrompt.prompt(); state.deferredInstallPrompt=null; $('installBtn').classList.add('hidden'); }});
  attachCalendarSwipe();
}
function seedIfEmpty(){
  if (state.tasks.length) return;
  const d = new Date(Date.now()+2*60*60*1000);
  state.tasks.push({ id:uid(), title:'範例任務：完成 PWA 部署', body:'可編輯、勾選完成、同步與離線使用。', reminderAt:d.toISOString(), completed:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
  localStorage.setItem(DB_KEY, JSON.stringify(state.tasks));
}
function init(){ loadState(); seedIfEmpty(); bindEvents(); renderAll(); registerPWA(); checkForUpdates(); setInterval(reminderLoop, 30*1000); setInterval(syncNow, 60*1000); }
document.addEventListener('DOMContentLoaded', init);
