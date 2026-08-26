// ── i18n ───────────────────────────────────────────────
const i18n = {
  ja: {
    addTask: '+ タスクを追加',
    colTask: 'タスク名',
    colDeadline: '期限',
    colMemo: 'メモ',
    emptyMsg: 'タスクがありません。「＋ タスクを追加」で追加してください。',
    placeholderTask: 'タスク名',
    placeholderMemo: 'メモ',
    dragTitle: 'ドラッグで並び替え',
    delTitle: '削除',
    dlgDelete: 'このタスクを削除しますか?',
    dlgClearDone: '完了済みタスクを削除しますか?',
    dlgClearAll: '全タスクを削除しますか?',
  },
  en: {
    addTask: '+ add task',
    colTask: 'task',
    colDeadline: 'deadline',
    colMemo: 'remarks',
    emptyMsg: 'No tasks. Click "+ add task" to get started.',
    placeholderTask: 'task name',
    placeholderMemo: 'remarks',
    dragTitle: 'drag to reorder',
    delTitle: 'delete',
    dlgDelete: 'Delete this task?',
    dlgClearDone: 'Delete completed tasks?',
    dlgClearAll: 'Delete all tasks?',
  },
};

let lang = localStorage.getItem('tasknote-lang') || 'ja';

function t(key) { return i18n[lang][key] ?? key; }

function applyLang() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  const label = document.getElementById('lang-label');
  if (label) label.textContent = lang === 'ja' ? 'EN' : 'JA';
  document.documentElement.lang = lang;
}

function switchLang() {
  lang = lang === 'ja' ? 'en' : 'ja';
  localStorage.setItem('tasknote-lang', lang);
  render();
}

// ── State ──────────────────────────────────────────────
let tasks = [];
let nextKey = 1;
let sortCol = null;
let sortDir = 1; // 1=asc, -1=desc
const today = new Date().toISOString().slice(0, 10);

// ── Persistence ────────────────────────────────────────
function save() {
  localStorage.setItem('tasknote', JSON.stringify({ tasks, nextKey }));
}

function load() {
  try {
    const raw = localStorage.getItem('tasknote');
    if (!raw) return;
    const data = JSON.parse(raw);
    // migrate old format: id → _key + num
    tasks = (data.tasks || []).map((t) => ({
      _key: t._key ?? t.id ?? nextKey++,
      num: t.num ?? t.id ?? '',
      name: t.name ?? '',
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(t.deadline) ? t.deadline : '',
      memo: t.memo ?? '',
      done: t.done ?? false,
    }));
    nextKey = data.nextKey ?? data.nextId ?? tasks.length + 1;
    tasks = tasks.filter((t) => t.num || t.name || t.deadline || t.memo);
  } catch (_) {}
}

// ── Render ─────────────────────────────────────────────
function render() {
  const tbody = document.getElementById('task-body');
  const emptyMsg = document.getElementById('empty-msg');

  applyLang();
  emptyMsg.style.display = tasks.length === 0 ? '' : 'none';
  tbody.innerHTML = '';

  tasks.forEach((task, idx) => {
    const tr = document.createElement('tr');
    tr.dataset.key = task._key;

    if (task.done) tr.classList.add('done');
    if (!task.done && task.deadline && task.deadline < today) tr.classList.add('overdue');

    tr.innerHTML = `
        <td class="drag-handle" title="${t('dragTitle')}">⠿</td>
        <td><button class="tick-btn" onclick="toggleDone(${task._key})">${task.done ? '[x]' : '[&nbsp;]'}</button></td>
        <td class="cell-id"><input type="text" inputmode="numeric" maxlength="4"  placeholder="No."
              value="${esc(task.num)}"
              onchange="update(${task._key},'num',this.value.replace(/[^0-9]/g,'').slice(0,4))"
              oninput="this.value=this.value.replace(/[^0-9]/g,'').slice(0,4)"></td>
        <td><input type="text" class="task-name" value="${esc(task.name)}" placeholder="${t('placeholderTask')}"
              onchange="update(${task._key},'name',this.value)"></td>
        <td><div class="date-wrap">
              <input type="text" inputmode="numeric" maxlength="8" placeholder="YY-MM-DD"
                value="${esc(toDisplayDate(task.deadline))}"
                oninput="fmtDateYY(this)"
                onchange="validateDateYY(this,${task._key})">
              <input type="date" class="date-hidden" tabindex="-1"
                value="${esc(task.deadline)}"
                onchange="syncFromPicker(this,${task._key})">
              <button class="date-icon" tabindex="-1"
                onclick="this.previousElementSibling.showPicker()">▾</button>
            </div></td>
        <td><textarea rows="1" placeholder="${t('placeholderMemo')}"
              onchange="update(${task._key},'memo',this.value)"
              oninput="autoResize(this)">${esc(task.memo)}</textarea></td>
        <td><button class="del-btn" onclick="deleteTask(${task._key})" title="${t('delTitle')}">×</button></td>
      `;

    attachDnD(tr, idx);
    tbody.appendChild(tr);
  });

  // resize textareas after render
  tbody.querySelectorAll('textarea').forEach(autoResize);

  // update sort arrows
  document.querySelectorAll('thead th.sortable').forEach((th) => {
    th.classList.remove('sorted');
    const arrow = th.querySelector('.sort-arrow');
    arrow.textContent = '↕';
  });
  if (sortCol) {
    const cols = ['num', 'name', 'deadline', 'memo'];
    const th = document.querySelectorAll('thead th.sortable')[cols.indexOf(sortCol)];
    if (th) {
      th.classList.add('sorted');
      th.querySelector('.sort-arrow').textContent = sortDir === 1 ? '↑' : '↓';
    }
  }
}

// ── Task ops ───────────────────────────────────────────
function addTask() {
  tasks.push({ _key: nextKey++, num: '', name: '', deadline: '', memo: '', done: false });
  save();
  render();
  const rows = document.querySelectorAll('#task-body tr');
  if (rows.length) {
    const input = rows[rows.length - 1].querySelector('input.task-name');
    if (input) input.focus();
  }
}

function update(key, field, value) {
  const task = tasks.find((t) => t._key === key);
  if (task) {
    task[field] = value;
    save();
  }
}

function toggleDone(key) {
  const task = tasks.find((t) => t._key === key);
  if (!task) return;
  task.done = !task.done;
  save();
  render();
}

let dialogResolve = null;

// Used by inline HTML: onclick="dialogResolve(true/false)"
window.dialogResolve = (result) => {
  if (typeof dialogResolve === 'function') dialogResolve(result);
};

function showDialog(msg) {
  document.getElementById('dialog-msg').textContent = msg;
  document.getElementById('dialog-overlay').classList.add('open');
  return new Promise((resolve) => {
    dialogResolve = (result) => {
      document.getElementById('dialog-overlay').classList.remove('open');
      resolve(result);
    };
  });
}

function flashBtn(btn, msg, reset) {
  btn.textContent = msg;
  setTimeout(() => (btn.textContent = reset), 1500);
}

async function copyList() {
  const btn = document.getElementById('copy-btn');
  if (tasks.length === 0) {
    flashBtn(btn, '— nothing to copy', '⎘ copy list');
    return;
  }
  const lines = tasks.map((t) => '- ' + (t.name || ''));
  await navigator.clipboard.writeText(lines.join('\n'));
  flashBtn(btn, '✓ copied!', '⎘ copy list');
}

async function copyDone() {
  const btn = document.getElementById('copy-done-btn');
  const done = tasks.filter((t) => t.done);
  if (done.length === 0) {
    flashBtn(btn, '— nothing to copy', '⎘ copy done');
    return;
  }
  const lines = done.map((t) => '- ' + (t.name || ''));
  await navigator.clipboard.writeText(lines.join('\n'));
  flashBtn(btn, '✓ copied!', '⎘ copy done');
}

async function clearDone() {
  if (!tasks.some((t) => t.done)) return;
  const ok = await showDialog(t('dlgClearDone'));
  if (!ok) return;
  tasks = tasks.filter((t) => !t.done);
  save();
  render();
}

async function clearAll() {
  if (tasks.length === 0) return;
  const ok = await showDialog(t('dlgClearAll'));
  if (!ok) return;
  tasks = [];
  save();
  render();
}

async function deleteTask(key) {
  const ok = await showDialog(t('dlgDelete'));
  if (!ok) return;
  tasks = tasks.filter((t) => t._key !== key);
  save();
  render();
}

// ── Sort ───────────────────────────────────────────────
function sortBy(col) {
  if (sortCol === col) sortDir *= -1;
  else {
    sortCol = col;
    sortDir = 1;
  }

  tasks.sort((a, b) => {
    const av = a[col] ?? '';
    const bv = b[col] ?? '';
    if (av < bv) return -sortDir;
    if (av > bv) return sortDir;
    return 0;
  });
  save();
  render();
}

// ── Drag & Drop ────────────────────────────────────────
let dragIdx = null;

function attachDnD(tr, idx) {
  // Only enable HTML5 drag from the handle so inputs/textareas keep text selection
  tr.addEventListener('mousedown', (e) => {
    tr.draggable = !!e.target.closest('.drag-handle');
  });
  tr.addEventListener('mouseup', () => {
    tr.draggable = false;
  });
  tr.addEventListener('dragstart', (e) => {
    dragIdx = idx;
    tr.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
  });
  tr.addEventListener('dragend', () => {
    tr.draggable = false;
    tr.classList.remove('dragging');
    document.querySelectorAll('#task-body tr').forEach((r) => r.classList.remove('drag-over'));
  });
  tr.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    document.querySelectorAll('#task-body tr').forEach((r) => r.classList.remove('drag-over'));
    tr.classList.add('drag-over');
  });
  tr.addEventListener('drop', (e) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const [moved] = tasks.splice(dragIdx, 1);
    tasks.splice(idx, 0, moved);
    sortCol = null; // clear sort when manually reordered
    dragIdx = null;
    save();
    render();
  });
}

// ── Helpers ────────────────────────────────────────────
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function toDisplayDate(iso) {
  const m = iso && iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? m[1].slice(2) + '-' + m[2] + '-' + m[3] : '';
}

function toISODate(display) {
  const m = display && display.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  return m ? '20' + m[1] + '-' + m[2] + '-' + m[3] : '';
}

function fmtDateYY(el) {
  const d = el.value.replace(/\D/g, '').slice(0, 6);
  if (d.length > 4) el.value = d.slice(0, 2) + '-' + d.slice(2, 4) + '-' + d.slice(4);
  else if (d.length > 2) el.value = d.slice(0, 2) + '-' + d.slice(2);
  else el.value = d;
  el.classList.remove('input-error');
}

function validateDateYY(el, key) {
  const val = el.value.trim();
  if (val === '') {
    el.classList.remove('input-error');
    el.nextElementSibling.value = '';
    update(key, 'deadline', '');
    return;
  }
  const m = val.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  const mo = m && parseInt(m[2], 10);
  const dy = m && parseInt(m[3], 10);
  if (!m || mo < 1 || mo > 12 || dy < 1 || dy > 31) {
    el.classList.add('input-error');
    return;
  }
  el.classList.remove('input-error');
  const iso = toISODate(val);
  el.nextElementSibling.value = iso;
  update(key, 'deadline', iso);
}

function syncFromPicker(pickerEl, key) {
  const iso = pickerEl.value;
  pickerEl.previousElementSibling.value = toDisplayDate(iso);
  pickerEl.previousElementSibling.classList.remove('input-error');
  update(key, 'deadline', iso);
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

// Backlog copy is a rich link: text/plain is often just the URL (so the No. field
// kept only digits). Title lives in text/html — parse that first.
const ISSUE_KEY_RE = /([A-Za-z][A-Za-z0-9_]*)-(\d+)/;

function normalizePaste(text) {
  return String(text ?? '')
    .replace(/\u00a0/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
    .replace(/\r\n/g, '\n')
    .trim();
}

function isBareIssueKey(text) {
  return /^[A-Za-z][A-Za-z0-9_]*-\d+$/.test(normalizePaste(text));
}

function parseBacklogPaste(text) {
  const cleaned = normalizePaste(text);
  if (!cleaned) return null;

  const viewM = cleaned.match(/\/view\/([A-Za-z][A-Za-z0-9_]*)-(\d+)/i);
  const keyM = cleaned.match(ISSUE_KEY_RE);
  if (!viewM && !keyM) return null;

  const project = (viewM || keyM)[1];
  const num = (viewM || keyM)[2];
  const issueKey = `${project}-${num}`;

  const name = cleaned
    .replace(/https?:\/\/[^\s<>"']+/gi, ' ')
    .replace(new RegExp(issueKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name) return null;
  return { num: num.slice(0, 4), name };
}

function parseBacklogHtml(html) {
  const raw = String(html ?? '').trim();
  if (!raw) return null;

  let doc;
  try {
    doc = new DOMParser().parseFromString(raw, 'text/html');
  } catch (_) {
    return null;
  }

  const titles = [];
  let num = '';

  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href') || '';
    const hrefM = href.match(/\/view\/([A-Za-z][A-Za-z0-9_]*)-(\d+)/i)
      || href.match(ISSUE_KEY_RE);
    const text = normalizePaste((a.textContent || '').replace(/\s+/g, ' '));
    if (hrefM && !num) num = hrefM[2];
    if (!text || isBareIssueKey(text)) continue;
    const stripped = text.replace(/^[A-Za-z][A-Za-z0-9_]*-\d+\s*/, '').trim();
    if (stripped) titles.push(stripped);
  }

  if (num && titles.length) return { num: num.slice(0, 4), name: titles[0] };
  return parseBacklogPaste(doc.body ? doc.body.textContent : '');
}

function parseBacklogClipboard(e) {
  const html = e.clipboardData?.getData('text/html') || '';
  const fromHtml = parseBacklogHtml(html);
  if (fromHtml) return fromHtml;
  const plain = e.clipboardData?.getData('text/plain')
    || e.clipboardData?.getData('text')
    || '';
  return parseBacklogPaste(plain);
}

function looksLikeBacklogClipboard(e) {
  const plain = e.clipboardData?.getData('text/plain') || '';
  const html = e.clipboardData?.getData('text/html') || '';
  const blob = plain + '\n' + html;
  return /\/view\/[A-Za-z][A-Za-z0-9_]*-\d+/i.test(blob)
    || ISSUE_KEY_RE.test(plain)
    || /backlog\.(jp|com|tool)/i.test(blob);
}

async function readClipboardHtml() {
  try {
    if (!navigator.clipboard?.read) return '';
    const items = await navigator.clipboard.read();
    for (const item of items) {
      if (item.types.includes('text/html')) {
        return await (await item.getType('text/html')).text();
      }
    }
  } catch (_) {}
  return '';
}

function applyBacklogPaste(parsed, tr) {
  const key = Number(tr?.dataset.key);
  const task = tasks.find((t) => t._key === key);
  if (!task) return;
  task.num = parsed.num;
  task.name = parsed.name;
  save();
  const numInput = tr.querySelector('.cell-id input');
  const nameInput = tr.querySelector('input.task-name');
  if (numInput) numInput.value = parsed.num;
  if (nameInput) nameInput.value = parsed.name;
}

function onTaskPaste(e) {
  const field = e.target.closest('.cell-id input, input.task-name');
  if (!field) return;
  const tr = field.closest('tr');
  const parsed = parseBacklogClipboard(e);
  if (parsed) {
    e.preventDefault();
    applyBacklogPaste(parsed, tr);
    return;
  }
  // <input> paste events often omit text/html; Backlog's title is in the rich link.
  if (!looksLikeBacklogClipboard(e)) return;
  const plain = e.clipboardData?.getData('text/plain') || '';
  e.preventDefault();
  readClipboardHtml().then((html) => {
    const fromHtml = parseBacklogHtml(html) || parseBacklogPaste(plain);
    if (fromHtml) {
      applyBacklogPaste(fromHtml, tr);
      return;
    }
    const m = plain.match(/\/view\/[A-Za-z][A-Za-z0-9_]*-(\d+)/i)
      || plain.match(/[A-Za-z][A-Za-z0-9_]*-(\d+)/);
    if (m) applyBacklogPaste({ num: m[1].slice(0, 4), name: '' }, tr);
  });
}

// ── Init ───────────────────────────────────────────────
load();
render();
document.getElementById('task-body').addEventListener('paste', onTaskPaste, true);

// Make sure inline onclick handlers can call these.
Object.assign(window, {
  addTask,
  sortBy,
  toggleDone,
  update,
  deleteTask,
  clearDone,
  clearAll,
  copyList,
  copyDone,
  fmtDateYY,
  validateDateYY,
  syncFromPicker,
  autoResize,
  switchLang,
});
