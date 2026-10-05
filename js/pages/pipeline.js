import { db } from '../db.js';
import { state, selectContact } from '../state.js';
import { h, today, fmtRelative, fmtDate, fmtTime, tsToYmd } from '../util.js';
import { icon, selectEl, emptyState, toast, confirmDialog, sheet } from '../ui.js';
import { createContact, deleteContact, setContactStatus, restartCadence, TASK_ICON, TYPE_LABEL, completeTask } from '../cadence.js';
import { ladderBar, rungName, sectionLabel } from '../components.js';
import { taskRow } from '../taskui.js';
import { buzz } from '../util.js';

const refresh = () => window.dispatchEvent(new Event('outbound:refresh'));
let lf = { rung: '', persona: '', sector: '', overdue: false, q: '', status: 'open' };
let view = 'contacts';

const STATUS_LABEL = { active: 'Active', nurture: 'Nurture', won: 'Won', closed: 'Closed' };

function outcomeLabel(o) {
  const f = state.content.meta.outcomes.find((x) => x.id === o);
  return f ? f.label : o === 'done' ? 'Done' : o;
}

function contactCard(c) {
  const overdue = c.nextActionAt && c.nextActionAt < today();
  return h('a', { class: 'card contact', href: `#/pipeline/${c.id}` },
    h('div', { class: 'row between' },
      h('div', null, h('strong', null, c.name), h('div', { class: 'muted small' }, [c.role || state.content.persona(c.persona), c.company].filter(Boolean).join(' · '))),
      c.status !== 'active' ? h('span', { class: 'tag' }, STATUS_LABEL[c.status]) : null),
    ladderBar(c.rung || 0),
    h('div', { class: 'row between small muted' },
      h('span', null, `${c.rung ? 'Rung ' + c.rung + ' · ' + rungName(c.rung) : 'Not started'}`),
      h('span', null, c.lastTouchAt ? `Last touch: ${fmtRelative(tsToYmd(c.lastTouchAt))}` : 'No touches yet')),
    h('div', { class: 'small' + (overdue ? ' overdue-tag' : ' muted') }, c.nextActionAt ? `Next: ${fmtRelative(c.nextActionAt)}` : 'No next action'));
}

async function listPage(root, query) {
  if (query.view) view = query.view;
  const contacts = await db.all('contacts');
  const m = state.content.meta;
  root.append(h('div', { class: 'page-head' }, h('h1', null, 'Pipeline'), h('a', { class: 'btn sm', href: '#/pipeline/new' }, icon('plus', 16), 'Add')));
  root.append(h('div', { class: 'seg' },
    [{ v: 'contacts', l: 'Contacts' }, { v: 'accounts', l: 'Accounts' }].map((o) => h('button', { class: 'seg-btn' + (view === o.v ? ' on' : ''), onclick: () => { view = o.v; refresh(); } }, o.l))));

  if (!contacts.length) {
    root.append(emptyState('No contacts yet', 'Add a contact and the 21-day outreach cadence is generated for you.', h('a', { class: 'btn', href: '#/pipeline/new' }, icon('plus', 18), 'Add your first contact')));
    return;
  }

  if (view === 'accounts') return accountsView(root, contacts);

  const search = h('input', { class: 'input', type: 'search', placeholder: 'Search name or company', value: lf.q, 'aria-label': 'Search contacts' });
  search.addEventListener('input', () => { lf.q = search.value; drawList(); });
  root.append(search);
  root.append(h('div', { class: 'filters' },
    selectEl([{ value: '', label: 'All rungs' }, ...state.content.ladder.map((l) => ({ value: l.rung, label: `${l.rung}. ${l.name}` }))], lf.rung, (v) => { lf.rung = v; drawList(); }, { 'aria-label': 'Rung' }),
    selectEl([{ value: '', label: 'All personas' }, ...m.personas.map((p) => ({ value: p.id, label: p.label }))], lf.persona, (v) => { lf.persona = v; drawList(); }, { 'aria-label': 'Persona' }),
    selectEl([{ value: '', label: 'All sectors' }, ...m.sectors.map((s) => ({ value: s, label: s }))], lf.sector, (v) => { lf.sector = v; drawList(); }, { 'aria-label': 'Sector' }),
    selectEl([{ value: 'open', label: 'Active + nurture' }, { value: 'active', label: 'Active only' }, { value: 'nurture', label: 'Nurture' }, { value: 'won', label: 'Won' }, { value: 'closed', label: 'Closed' }, { value: 'all', label: 'All statuses' }], lf.status, (v) => { lf.status = v; drawList(); }, { 'aria-label': 'Status' }),
    h('button', { class: 'chip' + (lf.overdue ? ' on' : ''), onclick: () => { lf.overdue = !lf.overdue; refresh(); } }, 'Overdue')));
  const list = h('div', { class: 'stack' });
  root.append(list);
  function drawList() {
    list.textContent = '';
    const q = lf.q.trim().toLowerCase();
    const rows = contacts.filter((c) => {
      if (lf.rung && String(c.rung || 0) !== String(lf.rung)) return false;
      if (lf.persona && c.persona !== lf.persona) return false;
      if (lf.sector && c.sector !== lf.sector) return false;
      if (lf.status === 'open' && !['active', 'nurture'].includes(c.status)) return false;
      if (['active', 'nurture', 'won', 'closed'].includes(lf.status) && c.status !== lf.status) return false;
      if (lf.overdue && !(c.nextActionAt && c.nextActionAt < today())) return false;
      if (q && !`${c.name} ${c.company} ${c.site}`.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => (a.nextActionAt || '9999').localeCompare(b.nextActionAt || '9999'));
    if (!rows.length) list.append(emptyState('Nothing matches', 'Try clearing a filter.'));
    rows.forEach((c) => list.append(contactCard(c)));
  }
  drawList();
}

function accountsView(root, contacts) {
  const groups = new Map();
  for (const c of contacts) {
    const key = (c.company || 'No company').trim().toLowerCase();
    if (!groups.has(key)) groups.set(key, { name: c.company || 'No company', items: [] });
    groups.get(key).items.push(c);
  }
  const rows = [...groups.values()].sort((a, b) => b.items.length - a.items.length || a.name.localeCompare(b.name));
  const mapRoles = state.content.meta.personas;
  root.append(h('p', { class: 'muted small' }, 'Aim for 3+ threads per account. Fewer than 3 is a single point of failure.'));
  for (const g of rows) {
    const n = g.items.length;
    const covered = new Set(g.items.map((c) => c.persona).filter(Boolean));
    const first = g.items[0];
    root.append(h('div', { class: 'card account' },
      h('div', { class: 'row between' },
        h('div', null, h('strong', null, g.name), h('div', { class: 'muted small' }, `${n} ${n === 1 ? 'thread' : 'threads'}`)),
        h('span', { class: 'tag ' + (n >= 3 ? 'ok' : 'warn') }, n >= 3 ? 'Well mapped' : 'Thin')),
      h('div', { class: 'dots', 'aria-label': `${covered.size} of ${mapRoles.length} roles mapped` },
        mapRoles.map((p) => h('span', { class: 'dot' + (covered.has(p.id) ? ' on' : ''), title: p.label }))),
      h('div', { class: 'stack tight' }, g.items.map((c) => h('a', { class: 'mini-contact', href: `#/pipeline/${c.id}` },
        h('span', null, c.name), h('span', { class: 'muted small' }, c.role || state.content.persona(c.persona) || ''), icon('right', 14)))),
      h('a', { class: 'btn ghost sm', href: `#/pipeline/new?company=${encodeURIComponent(first.company)}&site=${encodeURIComponent(first.site || '')}&sector=${encodeURIComponent(first.sector || '')}` }, icon('plus', 16), 'Add colleague')));
  }
}

function field(label, input) { return h('label', { class: 'field' }, h('span', null, label), input); }

async function formPage(root, id, query) {
  const existing = id ? await db.get('contacts', id) : null;
  if (id && !existing) { root.append(emptyState('Contact not found', '', h('a', { class: 'btn', href: '#/pipeline' }, 'Back'))); return; }
  const c = existing || { name: '', role: '', persona: '', company: query.company || '', site: query.site || '', sector: query.sector || '', phone: '', email: '', linkedin: '', source: query.source || '', notes: '' };
  const m = state.content.meta;
  const inp = (key, attrs = {}) => h('input', { class: 'input', value: c[key] || '', ...attrs });
  const f = {
    name: inp('name', { autocomplete: 'off', required: true }),
    role: inp('role', { placeholder: 'e.g. Engineering Director' }),
    company: inp('company', { autocomplete: 'off' }),
    site: inp('site', { placeholder: 'Site / location' }),
    phone: inp('phone', { type: 'tel', inputmode: 'tel' }),
    email: inp('email', { type: 'email', inputmode: 'email' }),
    linkedin: inp('linkedin', { type: 'url', placeholder: 'https://linkedin.com/in/…' }),
    source: inp('source', { placeholder: 'Where did you find them?' }),
    notes: h('textarea', { class: 'input', rows: '3' }, c.notes || ''),
  };
  const persona = selectEl([{ value: '', label: 'Select persona…' }, ...m.personas.map((p) => ({ value: p.id, label: p.label }))], c.persona);
  const sector = selectEl([{ value: '', label: 'Select sector…' }, ...m.sectors.map((s) => ({ value: s, label: s }))], c.sector);

  root.append(h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: existing ? `#/pipeline/${id}` : '#/pipeline', 'aria-label': 'Back' }, icon('arrowLeft')), h('h1', null, existing ? 'Edit contact' : 'Add contact')));
  const form = h('form', { class: 'form', novalidate: true },
    field('Name *', f.name), field('Persona', persona), field('Role / title', f.role),
    field('Company *', f.company), field('Site', f.site), field('Sector', sector),
    field('Phone', f.phone), field('Email', f.email), field('LinkedIn URL', f.linkedin),
    field('Source', f.source), field('Notes', f.notes),
    h('button', { class: 'btn', type: 'submit' }, existing ? 'Save changes' : 'Save & build 21-day cadence'));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.name.value.trim()) { f.name.focus(); toast('Name is required'); return; }
    const data = {
      name: f.name.value.trim(), persona: persona.value, role: f.role.value.trim(), company: f.company.value.trim(), site: f.site.value.trim(),
      sector: sector.value, phone: f.phone.value.trim(), email: f.email.value.trim(), linkedin: f.linkedin.value.trim(), source: f.source.value.trim(), notes: f.notes.value,
    };
    if (data.linkedin && !/^https?:\/\//i.test(data.linkedin)) data.linkedin = 'https://' + data.linkedin;
    if (existing) {
      await db.put('contacts', { ...existing, ...data });
      toast('Saved');
      location.hash = `#/pipeline/${id}`;
    } else {
      const created = await createContact(data);
      buzz();
      toast('Contact added · 21-day cadence created');
      location.hash = `#/pipeline/${created.id}`;
    }
  });
  root.append(form);
}

async function detailPage(root, id, query) {
  const c = await db.get('contacts', id);
  if (!c) { root.append(emptyState('Contact not found', '', h('a', { class: 'btn', href: '#/pipeline' }, 'Back to pipeline'))); return; }
  const [tasks, acts, all] = await Promise.all([db.byIndex('tasks', 'contactId', id), db.byIndex('activities', 'contactId', id), db.all('contacts')]);
  const open = tasks.filter((t) => t.status === 'open').sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const colleagues = all.filter((x) => x.id !== id && c.company && x.company.trim().toLowerCase() === c.company.trim().toLowerCase());
  selectContact(id);

  root.append(h('div', { class: 'page-head' }, h('a', { class: 'icon-btn', href: '#/pipeline', 'aria-label': 'Back' }, icon('arrowLeft')),
    h('h1', null, c.name), h('a', { class: 'icon-btn', href: `#/pipeline/${id}/edit`, 'aria-label': 'Edit' }, icon('edit'))));
  root.append(h('p', { class: 'muted tight' }, [c.role || state.content.persona(c.persona), c.company, c.site, c.sector].filter(Boolean).join(' · ')));

  // mushroom/research banner
  if (query.task) {
    const t = tasks.find((x) => x.id === query.task && x.status === 'open');
    if (t) root.append(h('div', { class: 'task-banner' },
      h('div', null, h('strong', null, t.label), t.type === 'mushroom' ? h('div', { class: 'small muted' }, 'Add colleagues below, then mark done') : null),
      h('button', { class: 'btn sm', onclick: async () => { await completeTask(t); buzz(); toast('Task done'); location.hash = '#/today'; } }, icon('check', 16), 'Mark done')));
  }

  const links = h('div', { class: 'quick wrap' },
    h('a', { class: 'btn', href: `#/call?contact=${id}&mode=auto` }, icon('play', 18), 'Call Mode'),
    c.phone ? h('a', { class: 'btn ghost', href: `tel:${c.phone.replace(/\s+/g, '')}` }, icon('phone', 18), c.phone) : null,
    c.email ? h('a', { class: 'btn ghost', href: `mailto:${c.email}` }, icon('mail', 18), 'Email') : null,
    c.linkedin ? h('a', { class: 'btn ghost', href: c.linkedin, target: '_blank', rel: 'noopener' }, icon('linkedin', 18), 'LinkedIn') : null);
  root.append(links);

  root.append(h('div', { class: 'card' },
    h('div', { class: 'row between' }, h('strong', null, c.rung ? `Rung ${c.rung} · ${rungName(c.rung)}` : 'Not started'), h('span', { class: 'tag' }, STATUS_LABEL[c.status])),
    ladderBar(c.rung || 0),
    h('div', { class: 'row between small muted' },
      h('span', null, c.lastTouchAt ? `Last touch ${fmtDate(tsToYmd(c.lastTouchAt))}` : 'No touches yet'),
      h('span', null, c.nextActionAt ? `Next: ${fmtRelative(c.nextActionAt)}` : 'No next action'))));

  root.append(sectionLabel(`Tasks · ${open.length} open`));
  const tcard = h('div', { class: 'card list' });
  if (!open.length) tcard.append(h('p', { class: 'muted pad' }, 'No open tasks.'));
  open.forEach((t) => tcard.append(taskRow(t, c, { showContact: false, onChange: refresh })));
  root.append(tcard);

  root.append(sectionLabel(`Colleagues at ${c.company || 'this company'}`, h('a', { class: 'link small', href: `#/pipeline/new?company=${encodeURIComponent(c.company || '')}&site=${encodeURIComponent(c.site || '')}&sector=${encodeURIComponent(c.sector || '')}&source=${encodeURIComponent('Colleague of ' + c.name)}` }, '+ Add colleague')));
  const threads = colleagues.length + 1;
  root.append(h('p', { class: 'muted small tight' }, threads >= 3 ? `${threads} threads — well mapped.` : `${threads} ${threads === 1 ? 'thread' : 'threads'} — aim for 3+. Different level, function or site.`));
  if (colleagues.length) {
    const list = h('div', { class: 'card list' });
    colleagues.forEach((x) => list.append(h('a', { class: 'mini-contact pad', href: `#/pipeline/${x.id}` }, h('span', null, x.name), h('span', { class: 'muted small' }, x.role || state.content.persona(x.persona) || ''), icon('right', 14))));
    root.append(list);
  }

  root.append(sectionLabel('Notes'));
  const notes = h('textarea', { class: 'input', rows: '4', placeholder: 'Notes, what they said, what they care about…' }, c.notes || '');
  notes.addEventListener('change', async () => { const cur = await db.get('contacts', id); cur.notes = notes.value; await db.put('contacts', cur); toast('Notes saved'); });
  root.append(notes);

  root.append(sectionLabel('Activity'));
  const tl = h('div', { class: 'timeline' });
  const sorted = [...acts].sort((a, b) => b.timestamp - a.timestamp);
  if (!sorted.length) tl.append(h('p', { class: 'muted' }, 'Nothing logged yet.'));
  for (const a of sorted) {
    tl.append(h('div', { class: 'tl-item' },
      h('span', { class: 'tl-ic' }, icon(TASK_ICON[a.type] || 'check', 16)),
      h('div', null,
        h('div', null, h('strong', null, TYPE_LABEL[a.type] || a.type), ' · ', outcomeLabel(a.outcome)),
        h('div', { class: 'muted small' }, `${fmtDate(tsToYmd(a.timestamp))} · ${fmtTime(a.timestamp)}`),
        a.notes ? h('div', { class: 'small' }, a.notes) : null)));
  }
  root.append(tl);

  root.append(sectionLabel('Manage'));
  root.append(h('div', { class: 'card' },
    field('Status', selectEl(Object.entries(STATUS_LABEL).map(([v, l]) => ({ value: v, label: l })), c.status, async (v) => { await setContactStatus(c, v); toast('Status updated'); refresh(); })),
    h('div', { class: 'row gap wrap' },
      h('button', { class: 'btn ghost sm', onclick: async () => { if (await confirmDialog('Cancel open tasks and rebuild the 21-day cadence from today?', 'Restart cadence')) { await restartCadence(c); toast('Cadence restarted'); refresh(); } } }, icon('refresh', 16), 'Restart cadence'),
      h('button', { class: 'btn ghost sm danger-text', onclick: async () => { if (await confirmDialog(`Delete ${c.name} and all their tasks and history?`, 'Delete', true)) { await deleteContact(id); toast('Contact deleted'); location.hash = '#/pipeline'; } } }, icon('trash', 16), 'Delete'))));
}

export async function render(root, { parts, query }) {
  const id = parts[1];
  if (!id) return listPage(root, query);
  if (id === 'new') return formPage(root, null, query);
  if (parts[2] === 'edit') return formPage(root, id, query);
  return detailPage(root, id, query);
}
void sheet;
