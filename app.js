// ===========================================================
// Expense Tracker — Main App (v3)
// All UI + feature logic. Imports DB layer from db.js
// ===========================================================

import {
    addExpense, updateExpense, deleteExpense,
    getAllExpenses, getExpensesInRange, importAllExpenses,
    setBudget, getAllBudgets, deleteBudget,
    addFavorite, getAllFavorites, deleteFavorite,
    parseDateString, dateToISO
} from './db.js';

/* ====================== CONSTANTS ====================== */

const CATEGORIES = {
    'Food & Drinks':       { sub: ['Groceries','Restaurant','Cafe'],                                                                          color: '#F97316', emoji: '🍔' },
    'Shopping':            { sub: ['Electronics','Clothes','Shoes','Stationary','Tools','Appliances'],                                         color: '#EC4899', emoji: '🛍️' },
    'Housing':             { sub: ['Rent','Mortgage','Council Rates','ESL','Maintenance'],                                                     color: '#14B8A6', emoji: '🏠' },
    'Utilities':           { sub: ['Electricity Bill','Gas Bill','Water Bill','Phone Bill','Internet Bill','Services'],                       color: '#EAB308', emoji: '💡' },
    'Insurance':           { sub: ['Home','Car','Health'],                                                                                     color: '#3B82F6', emoji: '🛡️' },
    'Transportation':      { sub: ['Public Transport','Taxi','Flight','Visa'],                                                                 color: '#06B6D4', emoji: '🚆' },
    'Vehicle':             { sub: ['Fuel','Parking','Vehicle Maintenance','Rentals','Registration'],                                           color: '#EF4444', emoji: '🚗' },
    'Life & Entertainment':{ sub: ['Child Support','Haircut','Grooming','Hobbies','Party','Education','Family','Books','TV','Movies','Holidays','Hotel','Charity, Gifts','Alcohol','Life Events','Postal Services'], color: '#A855F7', emoji: '🎉' },
    'Health':              { sub: ['GP','Medicines','Hospital','Dentist','Fitness'],                                                           color: '#10B981', emoji: '🩺' },
    'Financial Expenses':  { sub: ['Tax','Interest','Fines','Advisory','Fees, Charges'],                                                       color: '#475569', emoji: '🏦' },
    'Investments':         { sub: ['Savings','Collections'],                                                                                   color: '#059669', emoji: '📈' },
    'Income':              { sub: ['Salary','Rental Income','Interest, Dividents','Sale','Grants','Refunds','Coupons'],                       color: '#65A30D', emoji: '💰' },
    'Others':              { sub: ['Missing'],                                                                                                 color: '#6B7280', emoji: '📦' }
};

const KEYWORD_MAP = [
    { keywords: ['coles','woolies','prime products','supermarket','joymall','groceries'], category: 'Food & Drinks', subcategory: 'Groceries' },
    { keywords: ['laika','coffee','grain','bakery','cafe'], category: 'Food & Drinks', subcategory: 'Cafe' },
    { keywords: ['kleenheat','alinta gas','atco gas','aga gas'], category: 'Utilities', subcategory: 'Gas Bill' },
    { keywords: ['electricity','power','synergy'], category: 'Utilities', subcategory: 'Electricity Bill' },
    { keywords: ['sawater','water corp','sa water'], category: 'Utilities', subcategory: 'Water Bill' },
    { keywords: ['iinet','internet'], category: 'Utilities', subcategory: 'Internet Bill' },
    { keywords: ['day care'], category: 'Life & Entertainment', subcategory: 'Child Support' },
    { keywords: ['salary'], category: 'Income', subcategory: 'Salary' },
    { keywords: ['rental'], category: 'Income', subcategory: 'Rental Income' },
    { keywords: ['mortgage'], category: 'Housing', subcategory: 'Mortgage' },
    { keywords: ['fuel'], category: 'Vehicle', subcategory: 'Fuel' },
    { keywords: ['parking'], category: 'Vehicle', subcategory: 'Parking' },
    { keywords: ['tranmere loan','willetton loan'], category: 'Financial Expenses', subcategory: 'Interest' },
    { keywords: ['haircut'], category: 'Life & Entertainment', subcategory: 'Haircut' },
    { keywords: ['smartrider','transperth','smart rider'], category: 'Transportation', subcategory: 'Public Transport' },
    { keywords: ['bupa','health insurance'], category: 'Insurance', subcategory: 'Health' },
    { keywords: ['netflix','disney'], category: 'Life & Entertainment', subcategory: 'TV' }
];

/* ====================== STATE ====================== */

const state = {
    activeView: 'add',
    addCat: '',
    addSubCat: '',
    favorites: [],
    expensesCache: null, // for browse/insights – invalidated on writes
    insightsPeriod: 'this-month',
    trendScope: 'expense',
    trendCategory: null,    // when set, trend is filtered to this category
    trendSubcategory: null, // when set, trend is filtered to this sub-category (within trendCategory if also set)
    browse: {
        preset: 'all',
        query: '',
        catFilter: new Set(),
        dateFrom: null,
        dateTo: null,
        amtMin: null,
        amtMax: null,
        sort: 'date-desc'
    },
    heatmap: {
        // Default: current month
        year: new Date().getFullYear(),
        month: new Date().getMonth(), // 0-indexed
        selectedDay: null
    },
    editingId: null,
    charts: {
        cat: null,
        subCat: null,
        trend: null
    }
};

/* ====================== HELPERS ====================== */

const $ = (id) => document.getElementById(id);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function fmtMoney(n, withSign = false) {
    const v = Number(n) || 0;
    const sign = withSign && v >= 0 ? '+' : '';
    return sign + '$' + v.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmtCompact(n) {
    const v = Math.abs(Number(n) || 0);
    if (v >= 1000) return '$' + (v/1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
    return '$' + Math.round(v);
}

function sameDay(d1, d2) {
    return d1 && d2 && d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }

function periodRange(key, today = new Date()) {
    today = startOfDay(today);
    const y = today.getFullYear(), m = today.getMonth(), d = today.getDate();
    let start, end;
    switch (key) {
        case 'today':
            start = new Date(y, m, d);
            end = new Date(y, m, d);
            break;
        case 'week': {
            const dow = today.getDay() || 7; // mon=1..sun=7
            start = new Date(y, m, d - (dow - 1));
            end = new Date(y, m, d);
            break;
        }
        case 'this-month':
        case 'month':
            start = new Date(y, m, 1);
            end = new Date(y, m + 1, 0);
            break;
        case 'prev-month':
            start = new Date(y, m - 1, 1);
            end = new Date(y, m, 0);
            break;
        case 'quarter': {
            const q = Math.floor(m / 3);
            start = new Date(y, q * 3, 1);
            end = new Date(y, q * 3 + 3, 0);
            break;
        }
        case 'year':
            // Use calendar year for simplicity in insights/browse
            start = new Date(y, 0, 1);
            end = new Date(y, 11, 31);
            break;
        case 'prev-year':
            start = new Date(y - 1, 0, 1);
            end = new Date(y - 1, 11, 31);
            break;
        case 'all':
        default:
            return null;
    }
    start.setHours(0,0,0,0); end.setHours(0,0,0,0);
    return { start, end };
}

function periodLabel(key) {
    const map = { 'today':'Today', 'week':'This Week', 'this-month':'This Month', 'month':'This Month',
        'prev-month':'Previous Month', 'quarter':'This Quarter', 'year':'This Year', 'prev-year':'Previous Year', 'all':'All Time' };
    return map[key] || key;
}

function formatRowDate(d) {
    if (!(d instanceof Date)) d = new Date(d);
    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: '2-digit' });
}

function formatGroupDate(d) {
    const today = startOfDay(new Date());
    const x = startOfDay(d);
    const diff = Math.round((today - x) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Yesterday';
    if (diff < 7 && diff > 0) return x.toLocaleDateString(undefined, { weekday: 'long' });
    return x.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
}

function escapeHTML(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function todayISO() { return dateToISO(new Date()); }

function safeScrollIntoView(el, opts = { behavior: 'smooth', block: 'start' }) {
    if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView(opts);
}

function showToast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

async function ensureCache() {
    if (!state.expensesCache) {
        state.expensesCache = await getAllExpenses();
    }
    return state.expensesCache;
}

function invalidateCache() { state.expensesCache = null; }

/* ====================== TAB NAV ====================== */

function setView(name) {
    state.activeView = name;
    $$('.view').forEach(v => v.classList.toggle('active', v.dataset.view === name));
    $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    if (name === 'add') refreshAddRecentsAndFavs();
    if (name === 'browse') renderBrowse();
    if (name === 'insights') renderInsights();
    if (name === 'settings') renderSettings();
}

$$('.tab').forEach(t => t.addEventListener('click', () => setView(t.dataset.tab)));

/* ====================== ADD VIEW ====================== */

function renderCategoryChips(target, selected, onSelect, withColor = true) {
    target.innerHTML = '';
    Object.keys(CATEGORIES).forEach(cat => {
        const c = CATEGORIES[cat];
        const chip = document.createElement('button');
        chip.className = 'chip' + (selected === cat ? ' active' : '');
        chip.style.setProperty('--cat-color', c.color);
        chip.innerHTML = `<span class="dot"></span><span>${escapeHTML(cat)}</span>`;
        chip.addEventListener('click', () => onSelect(cat));
        target.appendChild(chip);
    });
}

function renderSubCatChips(target, parentCat, selected, onSelect) {
    target.innerHTML = '';
    if (!parentCat || !CATEGORIES[parentCat]) {
        target.innerHTML = '<div class="muted small" style="padding:6px;">Pick a category first</div>';
        return;
    }
    const c = CATEGORIES[parentCat];
    c.sub.forEach(sc => {
        const chip = document.createElement('button');
        chip.className = 'chip' + (selected === sc ? ' active' : '');
        chip.style.setProperty('--cat-color', c.color);
        chip.textContent = sc;
        chip.addEventListener('click', () => onSelect(sc));
        target.appendChild(chip);
    });
}

function autoSuggest(desc) {
    const lower = (desc || '').toLowerCase();
    for (const entry of KEYWORD_MAP) {
        if (entry.keywords.some(k => lower.includes(k))) {
            return entry;
        }
    }
    return null;
}

function buildAddCatChips() {
    renderCategoryChips($('addCatChips'), state.addCat, (cat) => {
        state.addCat = cat;
        state.addSubCat = '';
        buildAddCatChips();
        renderSubCatChips($('addSubCatChips'), state.addCat, state.addSubCat, (sc) => {
            state.addSubCat = sc;
            renderSubCatChips($('addSubCatChips'), state.addCat, state.addSubCat, (s2) => { state.addSubCat = s2; renderSubCatChips($('addSubCatChips'), state.addCat, state.addSubCat, () => {}); });
        });
    });
}

function buildAddSubChips() {
    renderSubCatChips($('addSubCatChips'), state.addCat, state.addSubCat, (sc) => {
        state.addSubCat = sc;
        buildAddSubChips();
    });
}

function resetAddForm() {
    $('addAmount').value = '';
    $('addDesc').value = '';
    $('addDate').value = todayISO();
    state.addCat = '';
    state.addSubCat = '';
    buildAddCatChips();
    renderSubCatChips($('addSubCatChips'), null, null, () => {});
    $('addStatus').textContent = '';
    $('addSuggest').classList.add('hidden');
    $('todaySubtitle').textContent = new Date().toLocaleDateString(undefined, { weekday:'long', day:'numeric', month:'long' });
}

async function handleAddSubmit() {
    const amt = parseFloat($('addAmount').value);
    const desc = $('addDesc').value.trim();
    const dateStr = $('addDate').value;

    if (!amt || amt <= 0) { setStatus('addStatus', 'Enter a valid amount.', 'error'); return; }
    if (!desc) { setStatus('addStatus', 'Enter a description.', 'error'); return; }
    if (!state.addCat || !state.addSubCat) { setStatus('addStatus', 'Pick a category and sub-category.', 'error'); return; }
    if (!dateStr) { setStatus('addStatus', 'Pick a date.', 'error'); return; }

    try {
        const id = await addExpense({
            amount: amt,
            description: desc,
            date: parseDateString(dateStr),
            category: state.addCat,
            subcategory: state.addSubCat
        });
        setStatus('addStatus', `Saved (id ${id})`, 'success');
        invalidateCache();
        showToast('Expense added');
        resetAddForm();
        refreshAddRecentsAndFavs();
    } catch (e) {
        console.error(e);
        setStatus('addStatus', 'Save failed.', 'error');
    }
}

function setStatus(elId, text, type='') {
    const el = $(elId);
    if (!el) return;
    el.textContent = text;
    el.classList.remove('success', 'error');
    if (type) el.classList.add(type);
}

async function refreshAddRecentsAndFavs() {
    // Recents
    const all = await ensureCache();
    const sorted = [...all].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
    const list = $('addRecentList');
    list.innerHTML = '';
    if (!sorted.length) {
        $('addRecentEmpty').classList.remove('hidden');
    } else {
        $('addRecentEmpty').classList.add('hidden');
        sorted.forEach(rec => list.appendChild(renderTransactionRow(rec, { compact:true, copyOnTap:true })));
    }
    // Favs
    const favs = await getAllFavorites();
    state.favorites = favs;
    const favList = $('favList');
    favList.innerHTML = '';
    if (!favs.length) {
        $('favEmpty').classList.remove('hidden');
    } else {
        $('favEmpty').classList.add('hidden');
        favs.forEach(f => {
            const c = CATEGORIES[f.category] || CATEGORIES.Others;
            const chip = document.createElement('button');
            chip.className = 'chip';
            chip.style.setProperty('--cat-color', c.color);
            chip.innerHTML = `<span class="dot"></span><span>${escapeHTML(f.description)}</span><span class="muted small">${fmtCompact(f.amount)}</span>`;
            chip.addEventListener('click', () => fillFromFavorite(f));
            favList.appendChild(chip);
        });
    }
}

function fillFromFavorite(f) {
    $('addAmount').value = f.amount ?? '';
    $('addDesc').value = f.description ?? '';
    state.addCat = f.category || '';
    state.addSubCat = f.subcategory || '';
    buildAddCatChips();
    buildAddSubChips();
    showToast('Filled from favorite');
}

// Description-based suggest: suggest keyword auto-classification AND show prior descriptions
function setupAddDescSuggest() {
    const inp = $('addDesc');
    const box = $('addSuggest');
    inp.addEventListener('input', async () => {
        const v = inp.value.trim();
        // Auto-classify category/sub if matched
        const km = autoSuggest(v);
        if (km && (!state.addCat || !state.addSubCat)) {
            state.addCat = km.category;
            state.addSubCat = km.subcategory;
            buildAddCatChips();
            buildAddSubChips();
        }
        // Suggest from history
        if (v.length < 2) { box.classList.add('hidden'); box.innerHTML=''; return; }
        const all = await ensureCache();
        const seen = new Set();
        const matches = [];
        for (const r of all) {
            if ((r.description || '').toLowerCase().includes(v.toLowerCase())) {
                const k = (r.description || '').toLowerCase();
                if (!seen.has(k)) {
                    seen.add(k);
                    matches.push(r);
                    if (matches.length >= 6) break;
                }
            }
        }
        if (!matches.length) { box.classList.add('hidden'); box.innerHTML=''; return; }
        box.innerHTML = '';
        matches.forEach(m => {
            const div = document.createElement('div');
            div.className = 'item';
            div.innerHTML = `<strong>${escapeHTML(m.description)}</strong> · <span class="muted small">${escapeHTML(m.category)} / ${escapeHTML(m.subcategory)} · ${fmtMoney(m.amount)}</span>`;
            div.addEventListener('click', () => {
                inp.value = m.description;
                state.addCat = m.category;
                state.addSubCat = m.subcategory;
                buildAddCatChips();
                buildAddSubChips();
                box.classList.add('hidden');
                $('addAmount').focus();
            });
            box.appendChild(div);
        });
        box.classList.remove('hidden');
    });
    inp.addEventListener('blur', () => setTimeout(() => box.classList.add('hidden'), 200));
}

/* Generic transaction row renderer */
function renderTransactionRow(rec, opts = {}) {
    const c = CATEGORIES[rec.category] || CATEGORIES.Others;
    const row = document.createElement('div');
    row.className = 'list-row';
    if (opts.noBg) row.classList.add('no-bg');
    row.style.setProperty('--cat-color', c.color);
    row.innerHTML = `
        <div class="cat-bubble" style="background:${c.color}">${c.emoji}</div>
        <div class="meta">
            <div class="desc">${escapeHTML(rec.description || '(no description)')}</div>
            <div class="sub">${escapeHTML(rec.subcategory || '')} · ${formatRowDate(rec.date)}</div>
        </div>
        <div class="amount ${rec.category === 'Income' ? 'income' : ''}">${rec.category === 'Income' ? '+' : ''}${fmtMoney(rec.amount)}</div>
    `;
    if (opts.copyOnTap) {
        row.addEventListener('click', () => {
            $('addAmount').value = rec.amount;
            $('addDesc').value = rec.description;
            state.addCat = rec.category;
            state.addSubCat = rec.subcategory;
            buildAddCatChips();
            buildAddSubChips();
            $('addDate').value = todayISO();
            showToast('Filled from recent');
        });
    } else if (opts.editOnTap !== false) {
        row.addEventListener('click', () => openEditModal(rec));
    }
    return row;
}

/* ====================== BROWSE VIEW ====================== */

function renderPresetChips() {
    $$('#presetChips .chip').forEach(c => c.classList.toggle('active', c.dataset.preset === state.browse.preset));
}

async function renderBrowse() {
    const all = await ensureCache();
    renderPresetChips();
    renderHeatmap(all);
    renderBrowseList(all);
}

function getActiveFilteredRecords(allRecords) {
    let recs = [...allRecords];
    const b = state.browse;
    // preset / range
    if (b.preset && b.preset !== 'all') {
        const r = periodRange(b.preset);
        if (r) recs = recs.filter(rec => {
            const d = startOfDay(new Date(rec.date));
            return d >= r.start && d <= r.end;
        });
    }
    if (b.dateFrom) {
        const f = parseDateString(b.dateFrom);
        recs = recs.filter(rec => startOfDay(new Date(rec.date)) >= f);
    }
    if (b.dateTo) {
        const t = parseDateString(b.dateTo);
        recs = recs.filter(rec => startOfDay(new Date(rec.date)) <= t);
    }
    // selected heatmap day
    if (state.heatmap.selectedDay) {
        const sel = state.heatmap.selectedDay;
        recs = recs.filter(rec => sameDay(new Date(rec.date), sel));
    }
    if (b.catFilter && b.catFilter.size) {
        recs = recs.filter(rec => b.catFilter.has(rec.category));
    }
    if (b.amtMin != null) recs = recs.filter(rec => rec.amount >= b.amtMin);
    if (b.amtMax != null) recs = recs.filter(rec => rec.amount <= b.amtMax);
    if (b.query) {
        const q = b.query.toLowerCase();
        recs = recs.filter(rec =>
            (rec.description || '').toLowerCase().includes(q) ||
            (rec.category || '').toLowerCase().includes(q) ||
            (rec.subcategory || '').toLowerCase().includes(q));
    }
    // Sort
    switch (b.sort) {
        case 'date-asc': recs.sort((a,b2) => new Date(a.date) - new Date(b2.date)); break;
        case 'amount-desc': recs.sort((a,b2) => b2.amount - a.amount); break;
        case 'amount-asc': recs.sort((a,b2) => a.amount - b2.amount); break;
        case 'date-desc':
        default:          recs.sort((a,b2) => new Date(b2.date) - new Date(a.date));
    }
    return recs;
}

function renderBrowseList(allRecords) {
    const recs = getActiveFilteredRecords(allRecords);
    const total = recs.reduce((s, r) => s + (r.category === 'Income' ? -r.amount : r.amount), 0);
    $('browseCount').textContent = `${recs.length} transaction${recs.length === 1 ? '' : 's'}`;
    $('browseTotal').textContent = fmtMoney(total);

    const container = $('browseList');
    container.innerHTML = '';
    if (!recs.length) {
        $('browseEmpty').classList.remove('hidden');
        return;
    }
    $('browseEmpty').classList.add('hidden');

    // Group by date
    const groups = new Map();
    for (const r of recs) {
        const key = dateToISO(new Date(r.date));
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(r);
    }

    for (const [k, rows] of groups) {
        const dateObj = parseDateString(k);
        const groupTotal = rows.reduce((s, r) => s + (r.category === 'Income' ? -r.amount : r.amount), 0);
        const header = document.createElement('div');
        header.className = 'section-day-header';
        header.innerHTML = `<span>${formatGroupDate(dateObj)}</span><span>${fmtMoney(groupTotal)}</span>`;
        container.appendChild(header);

        const list = document.createElement('div');
        list.className = 'list';
        rows.forEach(r => list.appendChild(renderTransactionRow(r)));
        container.appendChild(list);
    }
}

/* ====== Heatmap ====== */

function renderHeatmap(allRecords) {
    const { year, month } = state.heatmap;
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    const daysInMonth = monthEnd.getDate();
    const startDow = (monthStart.getDay() + 6) % 7; // make Monday = 0

    // Aggregate spending per day in the visible month (exclude income)
    const dailyExp = new Array(daysInMonth + 1).fill(0);
    for (const r of allRecords) {
        const d = new Date(r.date);
        if (d.getFullYear() === year && d.getMonth() === month && r.category !== 'Income') {
            dailyExp[d.getDate()] += r.amount;
        }
    }
    const max = Math.max(0.01, ...dailyExp);

    $('hmLabel').textContent = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    const grid = $('hmGrid');
    grid.innerHTML = '';
    ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach(d => {
        const el = document.createElement('div');
        el.className = 'dow';
        el.textContent = d;
        grid.appendChild(el);
    });
    for (let i = 0; i < startDow; i++) {
        const e = document.createElement('div');
        e.className = 'cell empty';
        grid.appendChild(e);
    }
    const today = startOfDay(new Date());
    for (let d = 1; d <= daysInMonth; d++) {
        const cell = document.createElement('div');
        cell.className = 'cell day';
        const dt = new Date(year, month, d);
        const amt = dailyExp[d];
        const ratio = amt / max;
        // Map ratio to background color
        let bg = '#F1F5F9';
        if (amt > 0) {
            if (ratio < 0.20) bg = '#E0E7FF';
            else if (ratio < 0.45) bg = '#C7D2FE';
            else if (ratio < 0.70) bg = '#818CF8';
            else if (ratio < 0.90) bg = '#4F46E5';
            else bg = '#312E81';
        }
        cell.style.background = bg;
        if (ratio > 0.45 && amt > 0) cell.style.color = 'white';
        if (sameDay(dt, today)) cell.classList.add('today');
        if (state.heatmap.selectedDay && sameDay(state.heatmap.selectedDay, dt)) cell.classList.add('selected');
        cell.innerHTML = `<span>${d}</span>${amt > 0 ? `<span class="amt">${fmtCompact(amt)}</span>` : ''}`;
        cell.addEventListener('click', () => {
            // Toggle: clicking the same selected day deselects
            if (state.heatmap.selectedDay && sameDay(state.heatmap.selectedDay, dt)) {
                state.heatmap.selectedDay = null;
            } else {
                state.heatmap.selectedDay = dt;
                state.browse.preset = 'all'; // ensure no conflict
                renderPresetChips();
            }
            renderBrowse();
        });
        grid.appendChild(cell);
    }
}

/* Filter sheet */
function openFilterSheet() {
    // Populate category chips
    const target = $('filterCatChips');
    target.innerHTML = '';
    Object.keys(CATEGORIES).forEach(cat => {
        const c = CATEGORIES[cat];
        const chip = document.createElement('button');
        chip.className = 'chip' + (state.browse.catFilter.has(cat) ? ' active' : '');
        chip.style.setProperty('--cat-color', c.color);
        chip.innerHTML = `<span class="dot"></span><span>${escapeHTML(cat)}</span>`;
        chip.addEventListener('click', () => {
            if (state.browse.catFilter.has(cat)) state.browse.catFilter.delete(cat);
            else state.browse.catFilter.add(cat);
            chip.classList.toggle('active');
        });
        target.appendChild(chip);
    });
    $('filterDateFrom').value = state.browse.dateFrom || '';
    $('filterDateTo').value = state.browse.dateTo || '';
    $('filterAmtMin').value = state.browse.amtMin ?? '';
    $('filterAmtMax').value = state.browse.amtMax ?? '';
    $('filterSort').value = state.browse.sort;
    $('filterSheet').classList.add('open');
}

function closeFilterSheet() { $('filterSheet').classList.remove('open'); }

function resetBrowseFilters() {
    state.browse.catFilter = new Set();
    state.browse.dateFrom = null;
    state.browse.dateTo = null;
    state.browse.amtMin = null;
    state.browse.amtMax = null;
    state.browse.sort = 'date-desc';
    state.browse.preset = 'all';
    state.browse.query = '';
    state.heatmap.selectedDay = null;
    $('searchInput').value = '';
    renderBrowse();
}

function applyFilterSheet() {
    state.browse.dateFrom = $('filterDateFrom').value || null;
    state.browse.dateTo = $('filterDateTo').value || null;
    const min = $('filterAmtMin').value;
    const max = $('filterAmtMax').value;
    state.browse.amtMin = min === '' ? null : parseFloat(min);
    state.browse.amtMax = max === '' ? null : parseFloat(max);
    state.browse.sort = $('filterSort').value;
    closeFilterSheet();
    renderBrowse();
}

/* ====================== EDIT MODAL ====================== */

function populateSelect(select, options, selected) {
    select.innerHTML = '';
    const def = document.createElement('option');
    def.value = '';
    def.textContent = '— choose —';
    def.disabled = true;
    select.appendChild(def);
    options.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o; opt.textContent = o;
        if (selected === o) opt.selected = true;
        select.appendChild(opt);
    });
    if (!selected) def.selected = true;
}

function openEditModal(rec) {
    state.editingId = rec.id;
    $('editAmount').value = rec.amount;
    $('editDesc').value = rec.description;
    $('editDate').value = dateToISO(new Date(rec.date));
    populateSelect($('editCat'), Object.keys(CATEGORIES), rec.category);
    populateSelect($('editSubCat'), CATEGORIES[rec.category]?.sub || [], rec.subcategory);
    $('editStatus').textContent = '';
    $('editTitle').textContent = `Edit · #${rec.id}`;
    $('editModal').classList.add('open');
}

function closeEditModal() {
    $('editModal').classList.remove('open');
    state.editingId = null;
}

$('editCat').addEventListener('change', (e) => {
    const cat = e.target.value;
    populateSelect($('editSubCat'), CATEGORIES[cat]?.sub || [], '');
});

async function saveEdit() {
    const id = state.editingId;
    if (id == null) return;
    const amt = parseFloat($('editAmount').value);
    const desc = $('editDesc').value.trim();
    const cat = $('editCat').value;
    const sub = $('editSubCat').value;
    const dateStr = $('editDate').value;

    if (!amt || amt <= 0 || !desc || !cat || !sub || !dateStr) {
        setStatus('editStatus', 'Please fill all fields.', 'error'); return;
    }
    try {
        await updateExpense(id, {
            amount: amt,
            description: desc,
            date: parseDateString(dateStr),
            category: cat,
            subcategory: sub
        });
        invalidateCache();
        setStatus('editStatus', 'Saved.', 'success');
        showToast('Saved');
        closeEditModal();
        if (state.activeView === 'browse') renderBrowse();
        if (state.activeView === 'add') refreshAddRecentsAndFavs();
        if (state.activeView === 'insights') renderInsights();
    } catch (e) {
        console.error(e);
        setStatus('editStatus', 'Save failed.', 'error');
    }
}

async function doDelete() {
    const id = state.editingId;
    if (id == null) return;
    if (!confirm('Delete this expense?')) return;
    try {
        await deleteExpense(id);
        invalidateCache();
        showToast('Deleted');
        closeEditModal();
        if (state.activeView === 'browse') renderBrowse();
        if (state.activeView === 'add') refreshAddRecentsAndFavs();
        if (state.activeView === 'insights') renderInsights();
    } catch (e) {
        console.error(e);
    }
}

async function favoriteCurrent() {
    if (state.editingId == null) return;
    const fav = {
        amount: parseFloat($('editAmount').value),
        description: $('editDesc').value.trim(),
        category: $('editCat').value,
        subcategory: $('editSubCat').value
    };
    try {
        await addFavorite(fav);
        showToast('Added to favorites');
    } catch (e) { console.error(e); }
}

/* ====================== INSIGHTS ====================== */

function recordsInPeriod(records, periodKey) {
    const r = periodRange(periodKey);
    if (!r) return records;
    return records.filter(rec => {
        const d = startOfDay(new Date(rec.date));
        return d >= r.start && d <= r.end;
    });
}

function summarize(records) {
    let income = 0, expense = 0;
    const byCat = {};
    for (const r of records) {
        const amt = +r.amount || 0;
        if (r.category === 'Income') income += amt;
        else {
            expense += amt;
            byCat[r.category] = (byCat[r.category] || 0) + amt;
        }
    }
    return { income, expense, savings: income - expense, byCat };
}

async function renderInsights() {
    const all = await ensureCache();
    $$('#insightPeriodChips .chip').forEach(c => c.classList.toggle('active', c.dataset.period === state.insightsPeriod));

    const periodKey = state.insightsPeriod;
    const recs = recordsInPeriod(all, periodKey);
    const sum = summarize(recs);

    // Stats cards
    $('iIncome').textContent = fmtMoney(sum.income);
    $('iExpense').textContent = fmtMoney(sum.expense);
    $('iSavings').textContent = fmtMoney(sum.savings);
    $('iSavings').classList.toggle('stat-pos', sum.savings >= 0);
    $('iSavings').classList.toggle('stat-neg', sum.savings < 0);
    const rate = sum.income > 0 ? (sum.savings / sum.income * 100) : 0;
    $('iSavingsRate').textContent = (Math.round(rate * 10) / 10) + '%';

    $('iIncomeSub').textContent = periodLabel(periodKey);
    $('iExpenseSub').textContent = `${recs.filter(r => r.category !== 'Income').length} transactions`;
    $('iSavingsSub').textContent = sum.savings >= 0 ? 'Saved' : 'Overspent';
    $('iSavingsRateSub').textContent = sum.income > 0 ? 'of income' : 'no income recorded';

    // YoY card
    renderYoY(all, periodKey, sum);

    // Category donut + table
    renderCategoryChart(sum.byCat);
    renderCategoryTable(sum.byCat, sum.expense);

    // Hide subcat card when re-rendering
    $('subCatCard').classList.add('hidden');

    // 12-month trend
    renderTrend(all);

    // Top merchants
    renderTopMerchants(recs);

    // Budgets
    renderBudgetProgress(all);

    // Quick insights
    renderQuickInsights(all, periodKey, recs);
}

function renderYoY(all, periodKey, currentSum) {
    const target = $('yoyContent');
    // Build comparison to last year same period
    let lyKey = periodKey;
    let curR = periodRange(periodKey);
    if (!curR) { target.innerHTML = '<div class="muted small">Pick a period to compare.</div>'; return; }
    const lyStart = new Date(curR.start); lyStart.setFullYear(lyStart.getFullYear() - 1);
    const lyEnd = new Date(curR.end); lyEnd.setFullYear(lyEnd.getFullYear() - 1);
    const lyRecs = all.filter(r => {
        const d = startOfDay(new Date(r.date));
        return d >= lyStart && d <= lyEnd;
    });
    const lySum = summarize(lyRecs);

    const expDelta = currentSum.expense - lySum.expense;
    const incDelta = currentSum.income - lySum.income;
    const savDelta = currentSum.savings - lySum.savings;
    const pct = (a, b) => b === 0 ? null : ((a - b) / b * 100);

    function row(label, cur, prev, lowerIsBetter) {
        const delta = cur - prev;
        const p = pct(cur, prev);
        const better = lowerIsBetter ? delta < 0 : delta > 0;
        const cls = (delta === 0) ? 'muted' : (better ? 'stat-pos' : 'stat-neg');
        const arrow = (delta === 0) ? '' : (delta > 0 ? '▲' : '▼');
        return `<div class="row-spread" style="padding:8px 0;border-bottom:1px solid var(--border-soft)">
            <span>${label}</span>
            <span><strong>${fmtMoney(cur)}</strong> <span class="muted small">vs ${fmtMoney(prev)}</span></span>
            <span class="bold ${cls}">${arrow} ${p == null ? '—' : Math.abs(Math.round(p)) + '%'}</span>
        </div>`;
    }

    target.innerHTML = `
        <div class="muted small" style="margin-bottom:6px;">${periodLabel(periodKey)} vs same period last year</div>
        ${row('Income', currentSum.income, lySum.income, false)}
        ${row('Expense', currentSum.expense, lySum.expense, true)}
        ${row('Savings', currentSum.savings, lySum.savings, false)}
    `;
}

function renderCategoryChart(byCat) {
    const labels = Object.keys(byCat);
    const data = labels.map(l => byCat[l]);
    const colors = labels.map(l => CATEGORIES[l]?.color || '#9CA3AF');

    if (state.charts.cat) state.charts.cat.destroy();
    if (!labels.length) {
        const ctx = $('catChart').getContext('2d');
        ctx.clearRect(0, 0, $('catChart').width, $('catChart').height);
        return;
    }
    state.charts.cat = new Chart($('catChart').getContext('2d'), {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{ data, backgroundColor: colors, borderWidth: 4, borderColor: '#fff' }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const tot = ctx.dataset.data.reduce((a,b) => a+b, 0);
                            const pct = tot > 0 ? Math.round(ctx.parsed / tot * 100) : 0;
                            return `${ctx.label}: ${fmtMoney(ctx.parsed)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
}

function renderCategoryTable(byCat, total) {
    const target = $('catTable');
    target.innerHTML = '';
    const sorted = Object.entries(byCat).sort((a,b) => b[1] - a[1]);
    if (!sorted.length) {
        target.innerHTML = '<div class="empty">No expenses in this period.</div>';
        return;
    }
    sorted.forEach(([cat, amt]) => {
        const c = CATEGORIES[cat] || CATEGORIES.Others;
        const pct = total > 0 ? (amt / total * 100).toFixed(1) : '0';
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
            <div class="cat-bubble" style="background:${c.color}">${c.emoji}</div>
            <div class="meta">
                <div class="desc">${escapeHTML(cat)}</div>
                <div class="sub">${pct}% of expenses</div>
            </div>
            <div class="amount">${fmtMoney(amt)}</div>
        `;
        row.addEventListener('click', () => {
            drillSubcategory(cat);
            setTrendFilter({ category: cat });
        });
        target.appendChild(row);
    });
    // Total row
    const totRow = document.createElement('div');
    totRow.className = 'list-row';
    totRow.innerHTML = `
        <div class="cat-bubble" style="background:var(--text)">Σ</div>
        <div class="meta">
            <div class="desc"><strong>Total</strong></div>
            <div class="sub">All categories</div>
        </div>
        <div class="amount"><strong>${fmtMoney(total)}</strong></div>
    `;
    target.appendChild(totRow);
}

async function drillSubcategory(category) {
    const all = await ensureCache();
    const recs = recordsInPeriod(all, state.insightsPeriod).filter(r => r.category === category);
    const bySub = {};
    for (const r of recs) {
        bySub[r.subcategory] = (bySub[r.subcategory] || 0) + r.amount;
    }
    const labels = Object.keys(bySub);
    const data = labels.map(l => bySub[l]);
    const c = CATEGORIES[category] || CATEGORIES.Others;
    // Generate variations of the category color
    const baseColors = ['#F97316','#EC4899','#14B8A6','#EAB308','#3B82F6','#06B6D4','#EF4444','#A855F7','#10B981','#475569','#059669','#65A30D','#6B7280'];
    const colors = labels.map((_, i) => baseColors[(baseColors.indexOf(c.color) + i + 1) % baseColors.length]);

    $('subCatTitle').textContent = `${c.emoji} ${category} → sub-categories`;
    $('subCatCard').classList.remove('hidden');

    if (state.charts.subCat) state.charts.subCat.destroy();
    state.charts.subCat = new Chart($('subCatChart').getContext('2d'), {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 4, borderColor: '#fff' }] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '62%',
            plugins: {
                legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const tot = ctx.dataset.data.reduce((a,b) => a+b, 0);
                            const pct = tot > 0 ? Math.round(ctx.parsed / tot * 100) : 0;
                            return `${ctx.label}: ${fmtMoney(ctx.parsed)} (${pct}%)`;
                        }
                    }
                }
            }
        }
    });
    const tbody = $('subCatTable');
    tbody.innerHTML = '';
    const sortedEntries = labels.map((l, i) => [l, data[i]]).sort((a,b) => b[1] - a[1]);
    const total = data.reduce((a,b) => a+b, 0);
    sortedEntries.forEach(([sub, amt]) => {
        const pct = total > 0 ? (amt / total * 100).toFixed(1) : '0';
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
            <div class="cat-bubble small" style="background:${c.color}">${c.emoji}</div>
            <div class="meta">
                <div class="desc">${escapeHTML(sub)}</div>
                <div class="sub">${pct}% of ${escapeHTML(category)}</div>
            </div>
            <div class="amount">${fmtMoney(amt)}</div>
        `;
        row.addEventListener('click', () => {
            setTrendFilter({ category, subcategory: sub });
        });
        tbody.appendChild(row);
    });
    safeScrollIntoView($('subCatCard'));
}

$('subCatClose').addEventListener('click', () => $('subCatCard').classList.add('hidden'));

function updateTrendScopeLabel() {
    const el = $('trendScopeLabel');
    if (!el) return;
    if (state.trendSubcategory) {
        const c = state.trendCategory ? CATEGORIES[state.trendCategory] : null;
        el.innerHTML = `<span class="badge" style="background:${(c?.color || '#6366F1') + '22'};color:${c?.color || '#6366F1'}">${c?.emoji || '🔎'} ${escapeHTML(state.trendSubcategory)}</span> <button class="link small" id="clearTrendFilterBtn" style="background:none;border:none;padding:0;">Clear</button>`;
    } else if (state.trendCategory) {
        const c = CATEGORIES[state.trendCategory] || CATEGORIES.Others;
        el.innerHTML = `<span class="badge" style="background:${c.color}22;color:${c.color}">${c.emoji} ${escapeHTML(state.trendCategory)}</span> <button class="link small" id="clearTrendFilterBtn" style="background:none;border:none;padding:0;">Clear</button>`;
    } else {
        el.innerHTML = '';
    }
    const clr = $('clearTrendFilterBtn');
    if (clr) clr.addEventListener('click', () => {
        state.trendCategory = null;
        state.trendSubcategory = null;
        ensureCache().then(all => renderTrend(all));
    });
}

function setTrendFilter({ category = null, subcategory = null } = {}) {
    state.trendCategory = category;
    state.trendSubcategory = subcategory;
    ensureCache().then(all => {
        renderTrend(all);
        const trendCard = $('trendChart').closest('.card');
        safeScrollIntoView(trendCard);
    });
}

function renderTrend(all) {
    const months = 12;
    const today = startOfDay(new Date());
    const labels = [];
    const data = [];

    const fCat = state.trendCategory;     // null or category name
    const fSub = state.trendSubcategory;  // null or sub-category name

    function valueFor(monthRecs) {
        if (fSub) {
            return monthRecs.filter(r => r.subcategory === fSub && (!fCat || r.category === fCat)).reduce((s,r) => s + r.amount, 0);
        }
        if (fCat) {
            return monthRecs.filter(r => r.category === fCat).reduce((s,r) => s + r.amount, 0);
        }
        if (state.trendScope === 'expense') return monthRecs.filter(r => r.category !== 'Income').reduce((s,r) => s + r.amount, 0);
        if (state.trendScope === 'income')  return monthRecs.filter(r => r.category === 'Income').reduce((s,r) => s + r.amount, 0);
        if (state.trendScope === 'savings') {
            const inc = monthRecs.filter(r => r.category === 'Income').reduce((s,r) => s + r.amount, 0);
            const exp = monthRecs.filter(r => r.category !== 'Income').reduce((s,r) => s + r.amount, 0);
            return inc - exp;
        }
        return 0;
    }

    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        labels.push(d.toLocaleDateString(undefined, { month: 'short' }));
        const monthRecs = all.filter(r => {
            const dt = new Date(r.date);
            return dt.getFullYear() === d.getFullYear() && dt.getMonth() === d.getMonth();
        });
        data.push(parseFloat(valueFor(monthRecs).toFixed(2)));
    }
    // Moving avg (cumulative running)
    let cum = 0;
    const movAvg = data.map((v, i) => { cum += v; return parseFloat((cum / (i+1)).toFixed(2)); });

    if (state.charts.trend) state.charts.trend.destroy();

    // Pick colour: if filtering by category/sub, use that category's colour
    let baseColor, fillColor;
    if (fCat) {
        const cc = (CATEGORIES[fCat] || CATEGORIES.Others).color;
        baseColor = cc;
        fillColor = cc + '33';
    } else if (state.trendScope === 'income') { baseColor = '#10B981'; fillColor = 'rgba(16,185,129,.2)'; }
    else if (state.trendScope === 'savings') { baseColor = '#6366F1'; fillColor = 'rgba(99,102,241,.2)'; }
    else                                      { baseColor = '#EC4899'; fillColor = 'rgba(236,72,153,.2)'; }

    // Update scope label
    updateTrendScopeLabel();
    state.charts.trend = new Chart($('trendChart').getContext('2d'), {
        data: {
            labels,
            datasets: [
                { type: 'bar', label: 'Monthly', data, borderColor: baseColor, backgroundColor: fillColor, borderWidth: 1, borderRadius: 6, order: 2 },
                { type: 'line', label: 'Moving avg', data: movAvg, borderColor: '#111827', borderWidth: 2, fill: false, tension: 0.35, pointRadius: 2, order: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { callback: (v) => fmtCompact(v) } }
            },
            plugins: {
                legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${fmtMoney(c.parsed.y)}` } }
            }
        }
    });
}

function renderTopMerchants(recs) {
    const exp = recs.filter(r => r.category !== 'Income');
    const map = {};
    exp.forEach(r => {
        const key = (r.description || '').trim().toLowerCase();
        if (!key) return;
        if (!map[key]) map[key] = { display: r.description, total: 0, count: 0, category: r.category };
        map[key].total += r.amount;
        map[key].count += 1;
    });
    const top = Object.values(map).sort((a,b) => b.total - a.total).slice(0, 10);
    const target = $('topMerchants');
    target.innerHTML = '';
    if (!top.length) {
        $('topMerchantsEmpty').classList.remove('hidden');
        return;
    }
    $('topMerchantsEmpty').classList.add('hidden');
    top.forEach(m => {
        const c = CATEGORIES[m.category] || CATEGORIES.Others;
        const row = document.createElement('div');
        row.className = 'list-row';
        row.innerHTML = `
            <div class="cat-bubble" style="background:${c.color}">${c.emoji}</div>
            <div class="meta">
                <div class="desc">${escapeHTML(m.display)}</div>
                <div class="sub">${m.count}× · ${escapeHTML(m.category)}</div>
            </div>
            <div class="amount">${fmtMoney(m.total)}</div>
        `;
        row.addEventListener('click', () => {
            // Jump to browse tab with this description as query
            state.browse.query = m.display;
            $('searchInput').value = m.display;
            setView('browse');
        });
        target.appendChild(row);
    });
}

async function renderBudgetProgress(all) {
    const budgets = await getAllBudgets();
    const list = $('budgetList');
    list.innerHTML = '';
    if (!budgets.length) {
        $('budgetEmpty').classList.remove('hidden');
        return;
    }
    $('budgetEmpty').classList.add('hidden');
    // Compute current month spend per category
    const r = periodRange('this-month');
    const monthRecs = all.filter(rec => {
        const d = startOfDay(new Date(rec.date));
        return d >= r.start && d <= r.end;
    });
    const spend = {};
    monthRecs.forEach(rec => {
        if (rec.category !== 'Income') spend[rec.category] = (spend[rec.category] || 0) + rec.amount;
    });

    budgets
        .filter(b => b.monthly > 0)
        .sort((a,b) => (spend[b.category] || 0)/b.monthly - (spend[a.category] || 0)/a.monthly)
        .forEach(b => {
            const c = CATEGORIES[b.category] || CATEGORIES.Others;
            const actual = spend[b.category] || 0;
            const pct = Math.min(100, Math.round(actual / b.monthly * 100));
            const over = actual > b.monthly;
            const row = document.createElement('div');
            row.className = 'budget-row';
            row.style.setProperty('--cat-color', c.color);
            row.style.setProperty('--cat-color-2', c.color + 'CC');
            row.innerHTML = `
                <div class="top">
                    <span class="label"><span class="cat-bubble small" style="background:${c.color}">${c.emoji}</span>${escapeHTML(b.category)}</span>
                    <span class="vals"><span class="actual">${fmtMoney(actual)}</span> / ${fmtMoney(b.monthly)} ${over ? '<span class="badge danger">Over</span>' : pct >= 80 ? '<span class="badge warn">Close</span>' : ''}</span>
                </div>
                <div class="progress ${over ? 'over' : ''}">
                    <div class="fill" style="width:${over ? 100 : pct}%"></div>
                </div>
            `;
            list.appendChild(row);
        });
}

function renderQuickInsights(all, periodKey, recs) {
    const target = $('quickInsights');
    target.innerHTML = '';
    const lines = [];

    // Recurring subscriptions detector: find descriptions with 3+ similar amounts on similar days
    const desc2List = {};
    all.forEach(r => {
        if (r.category === 'Income') return;
        const k = (r.description || '').trim().toLowerCase();
        if (!k) return;
        (desc2List[k] = desc2List[k] || []).push(r);
    });
    const subs = Object.entries(desc2List)
        .filter(([_, arr]) => arr.length >= 3)
        .map(([_, arr]) => {
            arr.sort((a,b) => new Date(a.date) - new Date(b.date));
            // Check if last 3 dates are roughly monthly
            const last3 = arr.slice(-3);
            const gaps = [];
            for (let i = 1; i < last3.length; i++) {
                gaps.push((new Date(last3[i].date) - new Date(last3[i-1].date)) / 86400000);
            }
            const avgGap = gaps.reduce((a,b) => a+b, 0) / Math.max(1, gaps.length);
            const isMonthly = avgGap >= 25 && avgGap <= 35;
            const isWeekly = avgGap >= 6 && avgGap <= 10;
            if (isMonthly || isWeekly) {
                const avgAmt = last3.reduce((s,r) => s + r.amount, 0) / last3.length;
                return { description: last3[0].description, count: arr.length, avgAmt, freq: isMonthly ? 'monthly' : 'weekly', category: last3[0].category };
            }
            return null;
        })
        .filter(Boolean)
        .sort((a,b) => b.avgAmt - a.avgAmt)
        .slice(0, 5);

    if (subs.length) {
        lines.push(`<div style="margin-bottom:8px;"><strong>Detected recurring</strong></div>`);
        subs.forEach(s => {
            lines.push(`<div class="row-spread" style="padding:6px 0;border-bottom:1px solid var(--border-soft)">
                <span>${escapeHTML(s.description)} <span class="badge">${s.freq}</span></span>
                <span class="bold">${fmtMoney(s.avgAmt)}</span>
            </div>`);
        });
    }

    // Biggest 3 transactions in period
    const top3 = [...recs.filter(r => r.category !== 'Income')].sort((a,b) => b.amount - a.amount).slice(0, 3);
    if (top3.length) {
        lines.push(`<div style="margin:14px 0 8px"><strong>Biggest expenses (${periodLabel(periodKey)})</strong></div>`);
        top3.forEach(r => {
            const c = CATEGORIES[r.category] || CATEGORIES.Others;
            lines.push(`<div class="row-spread" style="padding:6px 0;border-bottom:1px solid var(--border-soft)">
                <span>${c.emoji} ${escapeHTML(r.description)} <span class="muted small">${formatRowDate(r.date)}</span></span>
                <span class="bold">${fmtMoney(r.amount)}</span>
            </div>`);
        });
    }

    // Anomalies: transactions in this period with amount > 2× the historical median for the same description
    const anomalies = [];
    for (const r of recs) {
        if (r.category === 'Income') continue;
        const key = (r.description || '').trim().toLowerCase();
        if (!key) continue;
        const hist = desc2List[key] || [];
        if (hist.length < 4) continue;
        const sortedAmts = [...hist.map(h => h.amount)].sort((a,b) => a-b);
        const median = sortedAmts[Math.floor(sortedAmts.length/2)];
        if (median > 0 && r.amount > median * 2) {
            anomalies.push({ rec: r, median });
        }
    }
    anomalies.sort((a,b) => b.rec.amount - a.rec.amount);
    if (anomalies.length) {
        lines.push(`<div style="margin:14px 0 8px"><strong>Unusual transactions</strong></div>`);
        anomalies.slice(0, 4).forEach(a => {
            lines.push(`<div class="row-spread" style="padding:6px 0;border-bottom:1px solid var(--border-soft)">
                <span>⚠️ ${escapeHTML(a.rec.description)} <span class="muted small">vs typical ${fmtMoney(a.median)}</span></span>
                <span class="bold stat-neg">${fmtMoney(a.rec.amount)}</span>
            </div>`);
        });
    }

    if (!lines.length) {
        target.innerHTML = '<div class="empty">Add more data to see insights here.</div>';
    } else {
        target.innerHTML = lines.join('');
    }
}

/* ====================== SETTINGS ====================== */

async function renderSettings() {
    await renderBudgetEditor();
    await renderFavoritesManager();
}

async function renderBudgetEditor() {
    const budgets = await getAllBudgets();
    const map = {};
    budgets.forEach(b => map[b.category] = b.monthly);
    const target = $('budgetEditor');
    target.innerHTML = '';
    Object.keys(CATEGORIES).filter(k => k !== 'Income').forEach(cat => {
        const c = CATEGORIES[cat];
        const row = document.createElement('div');
        row.className = 'budget-row';
        row.innerHTML = `
            <div class="top">
                <span class="label"><span class="cat-bubble small" style="background:${c.color}">${c.emoji}</span>${escapeHTML(cat)}</span>
                <input type="number" inputmode="decimal" step="0.01" placeholder="0" value="${map[cat] != null ? map[cat] : ''}" data-cat="${escapeHTML(cat)}" style="width:120px;text-align:right;font-weight:600;">
            </div>
        `;
        target.appendChild(row);
    });
    target.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('change', async (e) => {
            const cat = e.target.dataset.cat;
            const v = parseFloat(e.target.value);
            if (!cat) return;
            if (isNaN(v) || v <= 0) {
                await deleteBudget(cat);
            } else {
                await setBudget(cat, v);
            }
            setStatus('budgetStatus', 'Budgets saved.', 'success');
            setTimeout(() => $('budgetStatus').textContent = '', 1200);
        });
    });
}

async function renderFavoritesManager() {
    const favs = await getAllFavorites();
    const target = $('favManageList');
    target.innerHTML = '';
    if (!favs.length) { $('favManageEmpty').classList.remove('hidden'); return; }
    $('favManageEmpty').classList.add('hidden');
    favs.forEach(f => {
        const c = CATEGORIES[f.category] || CATEGORIES.Others;
        const row = document.createElement('div');
        row.className = 'list-row no-bg';
        row.innerHTML = `
            <div class="cat-bubble small" style="background:${c.color}">${c.emoji}</div>
            <div class="meta">
                <div class="desc">${escapeHTML(f.description)}</div>
                <div class="sub">${escapeHTML(f.category)} / ${escapeHTML(f.subcategory)} · ${fmtMoney(f.amount)}</div>
            </div>
            <button class="btn btn-sm btn-danger" data-id="${f.id}">Remove</button>
        `;
        row.querySelector('button').addEventListener('click', async () => {
            await deleteFavorite(f.id);
            renderFavoritesManager();
            refreshAddRecentsAndFavs();
        });
        target.appendChild(row);
    });
}

/* ===== Import / Export ===== */

async function exportData() {
    const all = await getAllExpenses();
    // Convert dates to ISO for export
    const out = all.map(r => ({ ...r, date: dateToISO(new Date(r.date)) }));
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported ' + out.length + ' records');
}

async function importDataFromFile(file) {
    try {
        const text = await file.text();
        const records = JSON.parse(text);
        if (!Array.isArray(records)) throw new Error('Invalid JSON');
        await importAllExpenses(records);
        invalidateCache();
        setStatus('settingsStatus', `Imported ${records.length} records.`, 'success');
        showToast('Import complete');
    } catch (e) {
        console.error(e);
        setStatus('settingsStatus', 'Import failed: ' + e.message, 'error');
    }
}

/* ===== Batch import (image / pdf OCR) ===== */

function loadPdfJs() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
            }
            resolve(window.pdfjsLib);
        };
        script.onerror = (e) => reject(new Error('Failed to load pdf.js'));
        document.head.appendChild(script);
    });
}

function parseTransactionsFromText(text) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    let currentDate = null;
    const txs = [];
    const dateRegex = /(\d{2} \w{3} \d{4})/;
    const amountRegex = /-?\$([0-9,]+\.\d{2})/;
    const monthMap = { Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12' };
    for (const line of lines) {
        const dm = line.match(dateRegex);
        if (dm) {
            const [day, mon, year] = dm[1].split(' ');
            currentDate = `${year}-${monthMap[mon]}-${day}`;
            continue;
        }
        const am = line.match(amountRegex);
        if (am && currentDate) {
            const desc = line.replace(amountRegex, '').replace(/^-/, '').trim();
            if (!desc.toLowerCase().includes('self')) {
                txs.push({ date: currentDate, amount: parseFloat(am[1].replace(/,/g,'')), description: desc });
            }
        }
    }
    return txs;
}

function classify(desc) {
    const lower = (desc || '').toLowerCase();
    for (const e of KEYWORD_MAP) {
        if (e.keywords.some(k => lower.includes(k))) return { category: e.category, subcategory: e.subcategory };
    }
    return { category: 'Others', subcategory: 'Missing' };
}

async function batchImportFromFile(file) {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    setStatus('settingsStatus', isPdf ? 'Processing PDF…' : 'Processing image (OCR)…');
    let text = '';
    try {
        if (isPdf) {
            const pdfjsLib = await loadPdfJs();
            const buf = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                text += '\n' + content.items.map(it => it.str).join(' ');
            }
            if (text.trim().length < 50) {
                setStatus('settingsStatus', 'PDF has no selectable text.', 'error');
                return;
            }
        } else {
            const r = await Tesseract.recognize(file, 'eng');
            text = r.data.text;
        }
        const txs = parseTransactionsFromText(text);
        const existing = await getAllExpenses();
        let added = 0;
        for (const t of txs) {
            const exists = existing.some(rec => rec.amount === t.amount && dateToISO(new Date(rec.date)) === t.date);
            if (!exists) {
                const cls = classify(t.description);
                await addExpense({
                    date: parseDateString(t.date),
                    amount: t.amount,
                    description: t.description,
                    category: cls.category,
                    subcategory: cls.subcategory
                });
                added++;
            }
        }
        invalidateCache();
        setStatus('settingsStatus', `Batch import: ${added} new transactions added.`, 'success');
        showToast(`Imported ${added}`);
    } catch (e) {
        console.error(e);
        setStatus('settingsStatus', 'Batch import failed: ' + e.message, 'error');
    }
}

async function clearCacheAndReload() {
    if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        for (const r of regs) await r.unregister();
    }
    if ('caches' in window) {
        const keys = await caches.keys();
        for (const k of keys) await caches.delete(k);
    }
    location.reload();
}

/* ====================== EVENT WIRING ====================== */

$('addSubmitBtn').addEventListener('click', handleAddSubmit);

$$('#presetChips .chip').forEach(c => c.addEventListener('click', () => {
    state.browse.preset = c.dataset.preset;
    state.heatmap.selectedDay = null;
    renderBrowse();
}));

$('searchInput').addEventListener('input', (e) => {
    state.browse.query = e.target.value;
    renderBrowse();
});

function gotoPrevMonth() {
    let { year, month } = state.heatmap;
    month--; if (month < 0) { month = 11; year--; }
    state.heatmap.year = year; state.heatmap.month = month;
    state.heatmap.selectedDay = null;
    renderBrowse();
}
function gotoNextMonth() {
    let { year, month } = state.heatmap;
    month++; if (month > 11) { month = 0; year++; }
    state.heatmap.year = year; state.heatmap.month = month;
    state.heatmap.selectedDay = null;
    renderBrowse();
}
$('hmPrev').addEventListener('click', gotoPrevMonth);
$('hmNext').addEventListener('click', gotoNextMonth);

// Swipe across the calendar to navigate months
(function setupHeatmapSwipe() {
    const card = document.querySelector('.heatmap-card');
    if (!card) return;
    let sx = 0, sy = 0, st = 0, swiping = false;
    const THRESH_X = 40;     // min horizontal distance
    const MAX_OFFAXIS = 60;  // max vertical drift to still count as horizontal
    const MAX_DURATION = 700; // ms

    card.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) { swiping = false; return; }
        const t = e.touches[0];
        sx = t.clientX; sy = t.clientY; st = Date.now(); swiping = true;
    }, { passive: true });

    card.addEventListener('touchmove', (e) => {
        if (!swiping) return;
        const t = e.touches[0];
        // If user is swiping mostly vertically, abandon (let page scroll)
        if (Math.abs(t.clientY - sy) > MAX_OFFAXIS) swiping = false;
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
        if (!swiping) return;
        swiping = false;
        const t = (e.changedTouches && e.changedTouches[0]) || null;
        if (!t) return;
        const dx = t.clientX - sx;
        const dy = t.clientY - sy;
        const dt = Date.now() - st;
        if (dt > MAX_DURATION) return;
        if (Math.abs(dy) > MAX_OFFAXIS) return;
        if (Math.abs(dx) < THRESH_X) return;
        // Don't trigger if swipe started on a tappable day (let click win)
        if (dx > 0) gotoPrevMonth();
        else gotoNextMonth();
    });
})();

$('openFiltersBtn').addEventListener('click', openFilterSheet);
$('filterReset').addEventListener('click', resetBrowseFilters);
$('filterApply').addEventListener('click', applyFilterSheet);
$('filterSheet').addEventListener('click', (e) => { if (e.target.id === 'filterSheet') closeFilterSheet(); });
$('browseClearFilters').addEventListener('click', resetBrowseFilters);

$('editClose').addEventListener('click', closeEditModal);
$('editSaveBtn').addEventListener('click', saveEdit);
$('editDeleteBtn').addEventListener('click', doDelete);
$('editFavBtn').addEventListener('click', favoriteCurrent);
$('editModal').addEventListener('click', (e) => { if (e.target.id === 'editModal') closeEditModal(); });

$$('#insightPeriodChips .chip').forEach(c => c.addEventListener('click', () => {
    state.insightsPeriod = c.dataset.period;
    renderInsights();
}));

$('trendScope').addEventListener('change', (e) => {
    state.trendScope = e.target.value;
    state.trendCategory = null;
    state.trendSubcategory = null;
    renderInsights();
});

$('exportBtn').addEventListener('click', exportData);
$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (f) importDataFromFile(f);
    e.target.value = '';
});

$('batchImportBtn').addEventListener('click', () => $('ocrFile').click());
$('ocrFile').addEventListener('click', (e) => { e.target.value = ''; });
$('ocrFile').addEventListener('change', (e) => {
    const f = e.target.files[0]; if (f) batchImportFromFile(f);
});
$('addOcrBtn').addEventListener('click', () => { setView('settings'); $('ocrFile').click(); });

$('favManageBtn').addEventListener('click', () => setView('settings'));

$('reloadAppBtn').addEventListener('click', clearCacheAndReload);

// keyboard escape closes modal/sheet
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeEditModal(); closeFilterSheet(); }
});

/* ====================== INIT ====================== */

(async function init() {
    setupAddDescSuggest();
    resetAddForm();
    await ensureCache();
    refreshAddRecentsAndFavs();
})();
resetAddForm();
    await ensureCache();
    refreshAddRecentsAndFavs();
})();
