// ===========================================================
// Expense Tracker — Main App (v3)
// All UI + feature logic. Imports DB layer from db.js
// ===========================================================

import {
    addExpense, updateExpense, deleteExpense,
    getAllExpenses, getExpensesInRange, importAllExpenses,
    setBudget, getAllBudgets, deleteBudget,
    addFavorite, getAllFavorites, deleteFavorite,
    getAllRenewals, addRenewal, updateRenewal, deleteRenewal,
    getAllLoans, addLoan, updateLoan, deleteLoan,
    importAllBudgets, importAllFavorites, importAllRenewals, importAllLoans,
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

/* ============ LOAN AUTO-RECALC (Willetton / Tranmere) ============ */
// On any change to a Mortgage or Interest entry whose description mentions a
// loan suburb, recompute principal for every eligible Mortgage entry in that
// suburb/month:
//   principal = grossAmount - (totalInterestForMonth / numberOfPaymentsInMonth)
//
// "Eligible" = the entry has grossAmount captured (set on add via handleAddSubmit
// or on edit via saveEdit). Historical entries with no grossAmount are intentionally
// skipped so already-by-hand-adjusted records aren't double-deducted.

const LOAN_SUBURBS = ['Willetton', 'Tranmere'];

function detectLoanSuburb(desc) {
    if (!desc) return null;
    const lower = String(desc).toLowerCase();
    for (const s of LOAN_SUBURBS) {
        if (lower.includes(s.toLowerCase())) return s;
    }
    return null;
}

function isLoanMortgage(rec) {
    return rec && rec.category === 'Housing' && rec.subcategory === 'Mortgage' && !!detectLoanSuburb(rec.description);
}
function isLoanInterest(rec) {
    return rec && rec.category === 'Financial Expenses' && rec.subcategory === 'Interest' && !!detectLoanSuburb(rec.description);
}
function isLoanRecord(rec) { return isLoanMortgage(rec) || isLoanInterest(rec); }

function loanKeyForRec(rec) {
    if (!isLoanRecord(rec)) return null;
    const d = new Date(rec.date);
    return { suburb: detectLoanSuburb(rec.description), year: d.getFullYear(), month: d.getMonth() };
}

async function recalcLoanMonth(suburb, year, month) {
    const all = await getAllExpenses();
    const sLower = suburb.toLowerCase();
    const inMonth = (rec) => {
        const d = new Date(rec.date);
        return d.getFullYear() === year && d.getMonth() === month;
    };
    const hasSuburb = (rec) => (rec.description || '').toLowerCase().includes(sLower);

    // Only auto-adjust entries that have grossAmount captured. Historical entries
    // (no grossAmount) are intentionally left alone — they were already adjusted by hand.
    const mortgages = all.filter(r => r.category === 'Housing' && r.subcategory === 'Mortgage' && hasSuburb(r) && inMonth(r) && r.grossAmount != null);
    const interests = all.filter(r => r.category === 'Financial Expenses' && r.subcategory === 'Interest' && hasSuburb(r) && inMonth(r));
    if (mortgages.length === 0) return { adjusted: 0, suburb, year, month, count: 0, interest: 0 };

    const totalInterest = interests.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const N = mortgages.length;
    let adjusted = 0;

    if (totalInterest > 0) {
        const perPayment = totalInterest / N;
        for (const m of mortgages) {
            const gross = Number(m.grossAmount);
            const newPrincipal = +(gross - perPayment).toFixed(2);
            if (m.amount !== newPrincipal) {
                await updateExpense(m.id, { amount: newPrincipal });
                adjusted++;
            }
        }
    } else {
        // No interest in this month: revert principal back to gross.
        for (const m of mortgages) {
            const gross = +Number(m.grossAmount).toFixed(2);
            if (m.amount !== gross) {
                await updateExpense(m.id, { amount: gross });
                adjusted++;
            }
        }
    }
    return { adjusted, suburb, year, month, count: N, interest: totalInterest };
}

function monthLabel(year, month) {
    return new Date(year, month, 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

// Convenience: recalc for the suburb/month implied by a record, and show a toast if anything changed.
async function recalcAndNotify(rec) {
    const key = loanKeyForRec(rec);
    if (!key) return;
    const res = await recalcLoanMonth(key.suburb, key.year, key.month);
    if (res.adjusted > 0) {
        showToast(`Adjusted ${res.adjusted} ${key.suburb} mortgage entr${res.adjusted === 1 ? 'y' : 'ies'} — ${monthLabel(key.year, key.month)}`);
    }
}

// Recalc for both an OLD snapshot and a NEW snapshot of a record (handles category/sub/date/suburb changes).
async function recalcForChange(oldRec, newRec) {
    const keys = [];
    const k1 = loanKeyForRec(oldRec);
    const k2 = loanKeyForRec(newRec);
    const sig = (k) => k ? `${k.suburb}|${k.year}|${k.month}` : null;
    const seen = new Set();
    [k1, k2].forEach(k => {
        if (!k) return;
        const s = sig(k);
        if (seen.has(s)) return;
        seen.add(s);
        keys.push(k);
    });
    let totalAdjusted = 0;
    const notes = [];
    for (const k of keys) {
        const res = await recalcLoanMonth(k.suburb, k.year, k.month);
        if (res.adjusted > 0) {
            totalAdjusted += res.adjusted;
            notes.push(`${res.adjusted} ${k.suburb} ${monthLabel(k.year, k.month)}`);
        }
    }
    if (totalAdjusted > 0) showToast(`Adjusted ${notes.join(' • ')}`);
}

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
    trendMaWindow: 6,       // trailing window (months) for the moving-average line: 6 or 12
    trendExcludeMaint: (() => {
        try { return localStorage.getItem('trendExcludeMaint') === '1'; } catch { return false; }
    })(),
    property: {
        suburb: 'Tranmere',       // 'Tranmere' | 'Willetton' | '__both__'
        fyStartYear: null         // calendar year that the selected FY started (1 Jul)
    },
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
        case 'year': {
            // Australian financial year: 1 Jul - 30 Jun
            // If we're in Jul-Dec, FY started this calendar year; otherwise it started last year.
            const fyStartYear = (m >= 6) ? y : y - 1;
            start = new Date(fyStartYear, 6, 1);          // 1 Jul
            end   = new Date(fyStartYear + 1, 5, 30);     // 30 Jun
            break;
        }
        case 'prev-year': {
            // Previous AU financial year
            const fyStartYear = (m >= 6) ? y - 1 : y - 2;
            start = new Date(fyStartYear, 6, 1);
            end   = new Date(fyStartYear + 1, 5, 30);
            break;
        }
        case 'all':
        default:
            return null;
    }
    start.setHours(0,0,0,0); end.setHours(0,0,0,0);
    return { start, end };
}

function periodLabel(key) {
    const map = { 'today':'Today', 'week':'This Week', 'this-month':'This Month', 'month':'This Month',
        'prev-month':'Previous Month', 'quarter':'This Quarter', 'year':'This Year (FY)', 'prev-year':'Previous Year (FY)', 'all':'All Time' };
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
    if (name === 'property') renderProperty();
    if (name === 'loans') renderLoans();
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
        const newRec = {
            amount: amt,
            description: desc,
            date: parseDateString(dateStr),
            category: state.addCat,
            subcategory: state.addSubCat
        };
        // If this new record is a loan mortgage payment, capture the entered amount as the
        // gross bank-debit value. recalcLoanMonth will then compute the principal in `amount`.
        if (isLoanMortgage(newRec)) {
            newRec.grossAmount = amt;
        }
        const id = await addExpense(newRec);
        setStatus('addStatus', `Saved (id ${id})`, 'success');
        invalidateCache();
        showToast('Expense added');
        // Loan auto-recalc for the suburb/month this record belongs to.
        try { await recalcAndNotify({ ...newRec, id }); invalidateCache(); } catch (e) { console.warn('recalc failed', e); }
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
    // For loan mortgage rows with a captured gross debit different from the principal,
    // show both: principal as the headline amount, gross as a muted secondary line.
    const showGross = isLoanMortgage(rec)
        && rec.grossAmount != null
        && Number(rec.grossAmount).toFixed(2) !== Number(rec.amount).toFixed(2);
    const grossLine = showGross
        ? `<div class="muted small" style="text-align:right;">${fmtMoney(rec.grossAmount)} gross</div>`
        : '';
    row.innerHTML = `
        <div class="cat-bubble" style="background:${c.color}">${c.emoji}</div>
        <div class="meta">
            <div class="desc">${escapeHTML(rec.description || '(no description)')}</div>
            <div class="sub">${escapeHTML(rec.subcategory || '')} · ${formatRowDate(rec.date)}</div>
        </div>
        <div class="amount-cell">
            <div class="amount ${rec.category === 'Income' ? 'income' : ''}">${rec.category === 'Income' ? '+' : ''}${fmtMoney(rec.amount)}</div>
            ${grossLine}
        </div>
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
        // Always show the biggest items first within each day (independent of the
        // global sort, which still controls the order of the day groups themselves).
        rows.sort((a, b) => b.amount - a.amount);
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
    // For loan mortgage rows, the Amount field represents the GROSS bank debit;
    // populate from grossAmount (falling back to amount for legacy/historical entries).
    const editingLoanMortgage = isLoanMortgage(rec);
    const initialAmount = editingLoanMortgage
        ? (rec.grossAmount != null ? rec.grossAmount : rec.amount)
        : rec.amount;
    $('editAmount').value = initialAmount;
    $('editDesc').value = rec.description;
    $('editDate').value = dateToISO(new Date(rec.date));
    $('editEmployer').value = rec.employer || '';
    populateSelect($('editCat'), Object.keys(CATEGORIES), rec.category);
    populateSelect($('editSubCat'), CATEGORIES[rec.category]?.sub || [], rec.subcategory);
    $('editStatus').textContent = '';
    $('editTitle').textContent = `Edit · #${rec.id}`;
    updateEditAmountLabel(rec);
    updateEditEmployerVisibility();
    $('editModal').classList.add('open');
}

// Show the Employer field only for Income/Salary records (other types don't have employers).
function updateEditEmployerVisibility() {
    const cat = $('editCat').value;
    const sub = $('editSubCat').value;
    const show = (cat === 'Income' && sub === 'Salary');
    $('editEmployerField').style.display = show ? '' : 'none';
}

// Updates the Amount field's label + helper hint based on the current
// category/sub-category selected in the edit modal (called on open and on
// category/sub change so the UI stays consistent if the user changes type).
function updateEditAmountLabel(rec) {
    const cat = $('editCat').value;
    const sub = $('editSubCat').value;
    const desc = $('editDesc').value;
    const suburb = detectLoanSuburb(desc);
    const isLoanMort = (cat === 'Housing' && sub === 'Mortgage' && !!suburb);
    const label = $('editAmountLabel');
    const hint = $('editAmountHint');
    if (isLoanMort) {
        label.textContent = 'Gross repayment';
        if (rec && rec.grossAmount != null && Number(rec.grossAmount).toFixed(2) !== Number(rec.amount).toFixed(2)) {
            hint.textContent = `Principal (after interest): ${fmtMoney(rec.amount)}`;
        } else {
            hint.textContent = 'Full bank-debit amount. Principal will be calculated when interest for the month is recorded.';
        }
    } else {
        label.textContent = 'Amount';
        hint.textContent = '';
    }
}

function closeEditModal() {
    $('editModal').classList.remove('open');
    state.editingId = null;
}

$('editCat').addEventListener('change', (e) => {
    const cat = e.target.value;
    populateSelect($('editSubCat'), CATEGORIES[cat]?.sub || [], '');
    updateEditAmountLabel(null);
    updateEditEmployerVisibility();
});
$('editSubCat').addEventListener('change', () => { updateEditAmountLabel(null); updateEditEmployerVisibility(); });
$('editDesc').addEventListener('input', () => updateEditAmountLabel(null));

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
        // Snapshot the old record so we can recalc the suburb/month it used to belong to
        // (in case category/sub/date/description changed).
        const all = await getAllExpenses();
        const oldRec = all.find(r => r.id === id) || null;

        const newRec = {
            amount: amt,
            description: desc,
            date: parseDateString(dateStr),
            category: cat,
            subcategory: sub
        };

        // If this is a loan mortgage entry, the field represents the GROSS bank debit.
        // Persist that into grossAmount; the recalc will set the principal in `amount`.
        if (isLoanMortgage(newRec)) {
            newRec.grossAmount = amt;
        } else if (oldRec && oldRec.grossAmount != null) {
            // Record is no longer a loan mortgage — clear the stale field.
            newRec.grossAmount = null;
        }

        // Employer field: only applies to Income/Salary records.
        if (cat === 'Income' && sub === 'Salary') {
            newRec.employer = $('editEmployer').value.trim();
        } else if (oldRec && oldRec.employer != null) {
            // Record is no longer Income/Salary — clear stale employer.
            newRec.employer = null;
        }

        await updateExpense(id, newRec);
        invalidateCache();
        setStatus('editStatus', 'Saved.', 'success');
        showToast('Saved');
        closeEditModal();
        // Loan auto-recalc for both the old and new (suburb, month) if applicable.
        try { await recalcForChange(oldRec, { ...newRec, id }); invalidateCache(); } catch (e) { console.warn('recalc failed', e); }
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
        // Snapshot before delete so we can recalc the suburb/month it belonged to.
        const all = await getAllExpenses();
        const oldRec = all.find(r => r.id === id) || null;
        await deleteExpense(id);
        invalidateCache();
        showToast('Deleted');
        closeEditModal();
        try { await recalcForChange(oldRec, null); invalidateCache(); } catch (e) { console.warn('recalc failed', e); }
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
    // Upcoming renewals card sits above the rest of Insights when relevant.
    renderRenewalsInsight();
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
    const curR = periodRange(periodKey);
    if (!curR) { target.innerHTML = '<div class="muted small">Pick a period to compare.</div>'; return; }

    const today = startOfDay(new Date());
    const lyStart = new Date(curR.start); lyStart.setFullYear(lyStart.getFullYear() - 1);
    const lyEndFull = new Date(curR.end);  lyEndFull.setFullYear(lyEndFull.getFullYear() - 1);

    // For an in-progress period (e.g. mid-May when "This Month" is picked) the
    // current-side totals only cover days that have actually happened. The
    // last-year side should be capped to the same elapsed days so the comparison
    // is apples-to-apples. For completed periods (Previous Month etc.) the cap
    // exceeds the period end, so we fall back to the full last-year range.
    const elapsedMs = Math.max(0, today - curR.start);
    const lyEndCapped = new Date(lyStart.getTime() + elapsedMs);
    const lyEnd = lyEndCapped < lyEndFull ? lyEndCapped : lyEndFull;

    const periodDays = (curR.end - curR.start) / 86400000;
    const elapsedDays = elapsedMs / 86400000;

    // Edge case: brand-new multi-day period (today IS the period start day).
    // Comparison would be ~1 day vs ~1 day and not very informative.
    if (periodDays >= 1 && elapsedDays < 1) {
        target.innerHTML = `<div class="muted small">Not enough data yet for ${periodLabel(periodKey)} comparison.</div>`;
        return;
    }

    const lyRecs = all.filter(r => {
        const d = startOfDay(new Date(r.date));
        return d >= lyStart && d <= lyEnd;
    });
    const lySum = summarize(lyRecs);

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

    // Label: only mention "(to date) / (to same point)" when the period is
    // multi-day AND currently in progress. Otherwise keep the original phrasing.
    const isInProgress = today >= curR.start && today <= curR.end;
    const isMultiDay = periodDays > 1;
    const headerLabel = (isInProgress && isMultiDay)
        ? `${periodLabel(periodKey)} (to date) vs same period last year (to same point)`
        : `${periodLabel(periodKey)} vs same period last year`;

    target.innerHTML = `
        <div class="muted small" style="margin-bottom:6px;">${headerLabel}</div>
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

    // Optional filter: hide Housing/Maintenance (renovation/build) from both the
    // bars and the moving-average line, so a normal monthly spend pattern is
    // visible without those large one-off costs dominating.
    if (state.trendExcludeMaint) {
        all = all.filter(r => !(r.category === 'Housing' && r.subcategory === 'Maintenance'));
    }

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

    // Helper: get all records for a specific (year, month).
    const recsForMonth = (year, month) => all.filter(r => {
        const dt = new Date(r.date);
        return dt.getFullYear() === year && dt.getMonth() === month;
    });

    // Build the 12 displayed monthly values.
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        labels.push(d.toLocaleDateString(undefined, { month: 'short' }));
        data.push(parseFloat(valueFor(recsForMonth(d.getFullYear(), d.getMonth())).toFixed(2)));
    }

    // Trailing N-month moving average — uses full history (not just displayed months),
    // so each point is averaged over N months ending at that point. If fewer than N
    // historical months are available, average whatever is there (best-effort).
    const N = state.trendMaWindow || 6;
    const movAvg = [];
    for (let i = months - 1; i >= 0; i--) {
        const anchor = new Date(today.getFullYear(), today.getMonth() - i, 1);
        let sum = 0, count = 0;
        for (let k = 0; k < N; k++) {
            const md = new Date(anchor.getFullYear(), anchor.getMonth() - k, 1);
            sum += valueFor(recsForMonth(md.getFullYear(), md.getMonth()));
            count++;
        }
        movAvg.push(parseFloat((sum / count).toFixed(2)));
    }
    const maLabel = `${N}-mo trailing avg`;

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
                { type: 'line', label: maLabel, data: movAvg, borderColor: '#111827', borderWidth: 2, fill: false, tension: 0.35, pointRadius: 2, order: 1 }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Show tooltip for ALL datasets at the tapped/hovered x-index, so tapping a
            // month surfaces both the Monthly bar value and the Moving avg line value.
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: { grid: { display: false } },
                y: { beginAtZero: true, ticks: { callback: (v) => fmtCompact(v) } }
            },
            plugins: {
                legend: { display: true, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: { label: (c) => `${c.dataset.label}: ${fmtMoney(c.parsed.y)}` }
                }
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
        if (!map[key]) map[key] = { total: 0, count: 0, category: r.category, casings: {} };
        map[key].total += r.amount;
        map[key].count += 1;
        // Track each observed casing of the description so we can display the most common one.
        const d = r.description || '';
        map[key].casings[d] = (map[key].casings[d] || 0) + 1;
    });
    // Pick the most-frequent casing per merchant for display.
    Object.values(map).forEach(m => {
        m.display = Object.entries(m.casings).sort((a,b) => b[1] - a[1])[0][0];
        delete m.casings;
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

    // ------------------------------------------------------------------
    // Upcoming expenses (next 14 days)
    // ------------------------------------------------------------------
    // Tunables (chosen by testing against real data — see README/notes):
    //   WINDOW    – how many days ahead to forecast
    //   FRESHNESS – ignore items not paid recently (filters out stopped subs)
    //   LOOKBACK  – only analyse occurrences within this many days for cadence
    //   CV_MAX    – max coefficient of variation (stddev/median) of gaps; above
    //               this the cadence is too irregular to forecast reliably.
    //               0.50 keeps Kleenheat / iiNet (genuine monthly bills with a
    //               little date drift) while excluding Coffee / Woolies / Fuel.
    const WINDOW = 14, FRESHNESS = 60, LOOKBACK = 180, CV_MAX = 0.50;
    const today = startOfDay(new Date());
    const ONE_DAY = 86400000;
    const daysBetween = (a, b) => Math.round((startOfDay(new Date(b)) - startOfDay(new Date(a))) / ONE_DAY);

    // Group non-income records by lowercased description.
    // Also skip home-loan interest accruals (Financial Expenses / Interest with a
    // Willetton/Tranmere description). Those notional charges roll into the loan
    // balance — they aren't bank debits — so they shouldn't show up here as
    // upcoming expenses. The actual loan repayments (Housing / Mortgage) still
    // surface normally.
    const desc2List = {};
    all.forEach(r => {
        if (r.category === 'Income') return;
        if (r.category === 'Financial Expenses' && r.subcategory === 'Interest'
            && detectLoanSuburb(r.description)) return;
        const k = (r.description || '').trim().toLowerCase();
        if (!k) return;
        (desc2List[k] = desc2List[k] || []).push(r);
    });

    function classifyCadence(medGap) {
        if (medGap >= 5  && medGap <= 9)  return 'weekly';
        if (medGap >= 12 && medGap <= 17) return 'fortnightly';
        if (medGap >= 25 && medGap <= 35) return 'monthly';
        return null;
    }
    function median(nums) {
        const s = [...nums].sort((a,b) => a-b);
        const n = s.length;
        if (n === 0) return 0;
        return n % 2 ? s[(n-1)/2] : (s[n/2 - 1] + s[n/2]) / 2;
    }
    function stddev(nums) {
        const n = nums.length;
        if (n < 2) return 0;
        const mean = nums.reduce((a,b) => a+b, 0) / n;
        const variance = nums.reduce((s, v) => s + (v - mean) ** 2, 0) / n;
        return Math.sqrt(variance);
    }

    const upcoming = [];
    for (const [, arr] of Object.entries(desc2List)) {
        arr.sort((a,b) => new Date(a.date) - new Date(b.date));
        // Only consider records inside the lookback window for cadence analysis.
        const recent = arr.filter(r => daysBetween(r.date, today) <= LOOKBACK);
        if (recent.length < 3) continue;
        const lastDate = startOfDay(new Date(recent[recent.length-1].date));
        const daysSince = daysBetween(lastDate, today);
        if (daysSince > FRESHNESS) continue;

        const gaps = [];
        for (let i = 1; i < recent.length; i++) {
            gaps.push(daysBetween(recent[i-1].date, recent[i].date));
        }
        const medGap = median(gaps);
        if (medGap < 1) continue;
        const cv = stddev(gaps) / medGap;
        if (cv > CV_MAX) continue;
        const cadence = classifyCadence(medGap);
        if (!cadence) continue;

        // Project the next payment.
        const nextDate = new Date(lastDate);
        nextDate.setDate(nextDate.getDate() + Math.round(medGap));
        const daysToNext = daysBetween(today, nextDate);
        if (daysToNext < 0 || daysToNext > WINDOW) continue;

        // Estimate amount: median of the last (up to) 6 occurrences — robust to outliers.
        // Special case: for loan mortgage entries (Willetton/Tranmere) we forecast the
        // GROSS bank-debit amount, not the principal-only `amount`. Use the most recent
        // grossAmount available; fall back to amount-median for legacy entries.
        const tail = recent.slice(-Math.min(6, recent.length));
        let estAmt;
        if (recent.every(isLoanMortgage)) {
            const grosses = recent.filter(r => r.grossAmount != null);
            if (grosses.length) {
                estAmt = Number(grosses[grosses.length - 1].grossAmount);
            } else {
                estAmt = median(tail.map(r => r.amount));
            }
        } else {
            estAmt = median(tail.map(r => r.amount));
        }

        // Display the most-common casing of the description across recent records.
        const casings = {};
        for (const r of recent) {
            const d = r.description || '';
            casings[d] = (casings[d] || 0) + 1;
        }
        const displayDesc = Object.entries(casings).sort((a,b) => b[1] - a[1])[0][0];

        upcoming.push({
            description: displayDesc,
            category: recent[recent.length-1].category,
            cadence,
            nextDate,
            daysToNext,
            estAmt
        });
    }

    upcoming.sort((a,b) => a.daysToNext - b.daysToNext);

    if (upcoming.length) {
        const total = upcoming.reduce((s, u) => s + u.estAmt, 0);
        lines.push(`<div class="row-spread" style="margin-bottom:8px;">
            <strong>Upcoming expenses (next ${WINDOW} days)</strong>
            <span class="muted small">~${fmtMoney(total)} total</span>
        </div>`);
        upcoming.forEach(u => {
            const c = CATEGORIES[u.category] || CATEGORIES.Others;
            const whenLabel = u.daysToNext === 0 ? 'today'
                            : u.daysToNext === 1 ? 'tomorrow'
                            : `in ${u.daysToNext}d`;
            const dateStr = u.nextDate.toLocaleDateString(undefined, { weekday:'short', day:'2-digit', month:'short' });
            lines.push(`<div class="row-spread" style="padding:6px 0;border-bottom:1px solid var(--border-soft)">
                <span>${c.emoji} ${escapeHTML(u.description)} <span class="badge">${u.cadence}</span>
                    <div class="muted small">${dateStr} · ${whenLabel}</div>
                </span>
                <span class="bold">~${fmtMoney(u.estAmt)}</span>
            </div>`);
        });
    } else {
        lines.push(`<div style="margin-bottom:8px;"><strong>Upcoming expenses (next ${WINDOW} days)</strong></div>`);
        lines.push(`<div class="muted small" style="padding:6px 0;">Nothing forecast for the next ${WINDOW} days.</div>`);
    }

    // ------------------------------------------------------------------
    // Biggest 3 transactions in period
    // ------------------------------------------------------------------
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

    target.innerHTML = lines.join('');
}

/* ====================== PROPERTY / TAX VIEW ====================== */
// AU rental-property and PPOR summary, grouped by financial year.
// Detects expenses by suburb keyword (Tranmere/Willetton) in description.
// Buckets deductibles (Interest, Council Rates, ESL, Water, Insurance,
// Maintenance, plus Tax/Fees/Advisory) vs non-deductible (Mortgage principal).

const PROPERTY_SUBURBS = ['Tranmere', 'Willetton'];
// Investment properties — expenses on these are tax-deductible per AU rules.
// Currently only Tranmere; Willetton is PPOR.
const INVESTMENT_SUBURBS = new Set(['Tranmere']);

// (category, subcategory) → deductible bucket label for an investment property.
// Subcategories not listed here go into "Other" (non-deductible by default).
const DEDUCTIBLE_MAP = {
    'Financial Expenses|Interest':        'Interest',
    'Housing|Council Rates':              'Council rates',
    'Housing|ESL':                        'ESL',
    'Utilities|Water Bill':               'Water rates',
    'Insurance|Home':                     'Insurance',
    'Housing|Maintenance':                'Repairs & maintenance',
    'Financial Expenses|Tax':             'Land tax',
    'Financial Expenses|Fees, Charges':   'Bank/loan fees',
    'Financial Expenses|Advisory':        'Professional fees',
};

function recordSuburb(rec) {
    const d = (rec.description || '').toLowerCase();
    for (const s of PROPERTY_SUBURBS) {
        if (d.includes(s.toLowerCase())) return s;
    }
    return null;
}

// Australian FY range: 1 Jul of fyStartYear → 30 Jun of (fyStartYear+1).
function fyRange(fyStartYear) {
    const start = new Date(fyStartYear, 6, 1);  start.setHours(0,0,0,0);
    const end   = new Date(fyStartYear + 1, 5, 30); end.setHours(0,0,0,0);
    return { start, end };
}
function fyLabel(fyStartYear) {
    return `FY ${String(fyStartYear).slice(-2)}-${String(fyStartYear + 1).slice(-2)}`;
}

// Discover every FY that has at least one record with the given suburb (or any if both).
function availableFYs(all, suburbFilter) {
    const years = new Set();
    for (const r of all) {
        if (suburbFilter && suburbFilter !== '__both__') {
            if (recordSuburb(r) !== suburbFilter) continue;
        } else if (suburbFilter === '__both__') {
            if (!recordSuburb(r)) continue;
        }
        const d = new Date(r.date);
        const m = d.getMonth(), y = d.getFullYear();
        years.add(m >= 6 ? y : y - 1);
    }
    return [...years].sort((a,b) => b - a); // newest first
}

async function renderProperty() {
    const all = await ensureCache();
    const suburb = state.property.suburb;

    // Populate FY dropdown (recompute every render — cheap, keeps list fresh).
    const fySelect = $('propertyFY');
    const fys = availableFYs(all, suburb);
    if (fys.length === 0) {
        $('propertyNote').textContent = `No records found for ${suburb === '__both__' ? 'either property' : suburb}.`;
        ['propertySummary','propertyIncome','propertyDeductibles','propertyNonDeductibles'].forEach(id => $(id).innerHTML = '');
        return;
    }
    if (!state.property.fyStartYear || !fys.includes(state.property.fyStartYear)) {
        state.property.fyStartYear = fys[0]; // default to most recent
    }
    fySelect.innerHTML = fys.map(y => `<option value="${y}" ${y === state.property.fyStartYear ? 'selected' : ''}>${fyLabel(y)}</option>`).join('');

    // Filter records for this property × FY.
    const { start, end } = fyRange(state.property.fyStartYear);
    const matches = all.filter(r => {
        const sub = recordSuburb(r);
        if (suburb === '__both__') { if (!sub) return false; }
        else if (sub !== suburb) return false;
        const d = startOfDay(new Date(r.date));
        return d >= start && d <= end;
    });

    // Header note (PPOR vs investment).
    // PPOR (primary residence) → no deductions. Investment → deductions per DEDUCTIBLE_MAP.
    // Currently only Tranmere is treated as investment; Willetton is PPOR.
    const isPPOR = suburb === 'Willetton';
    let note = '';
    if (isPPOR) {
        note = 'Willetton appears to be your primary residence. Expenses are generally not tax-deductible — shown here for cashflow visibility.';
    } else if (suburb === '__both__') {
        note = 'Tranmere is treated as an investment property; Willetton as PPOR. Only Tranmere expenses are bucketed as deductible — verify with your accountant.';
    } else {
        note = 'Treated as investment property. Verify deductibility with your accountant before lodging.';
    }
    $('propertyNote').textContent = note;

    // Categorise.
    let income = 0;
    const incomeRows = [];
    const deductibleBuckets = {}; // label → { total, rows: [] }
    const nonDeductibleBuckets = {}; // label → { total, rows: [] }
    const addToBucket = (bucket, label, r) => {
        if (!bucket[label]) bucket[label] = { total: 0, rows: [] };
        bucket[label].total += r.amount;
        bucket[label].rows.push(r);
    };

    for (const r of matches) {
        if (r.category === 'Income') {
            income += r.amount;
            incomeRows.push(r);
            continue;
        }
        const k = `${r.category}|${r.subcategory}`;
        // Per-record investment check so '__both__' correctly excludes Willetton from deductions.
        const recIsInvestment = INVESTMENT_SUBURBS.has(recordSuburb(r));
        const isDeductibleHere = recIsInvestment && DEDUCTIBLE_MAP[k];
        if (isDeductibleHere) {
            addToBucket(deductibleBuckets, DEDUCTIBLE_MAP[k], r);
        } else {
            // Mortgage principal explicitly flagged; everything else lumped as Other.
            const label = (r.category === 'Housing' && r.subcategory === 'Mortgage')
                ? 'Mortgage principal (non-deductible)'
                : `${r.category} / ${r.subcategory || '—'}`;
            addToBucket(nonDeductibleBuckets, label, r);
        }
    }

    const totalDeductible = Object.values(deductibleBuckets).reduce((s, b) => s + b.total, 0);
    const totalNonDeductible = Object.values(nonDeductibleBuckets).reduce((s, b) => s + b.total, 0);
    const netResult = income - totalDeductible; // tax-relevant net (income minus deductions only)

    // ---- Summary card ----
    const hasInvestmentScope = !isPPOR; // Tranmere or __both__
    const netCls = netResult < 0 ? 'stat-neg' : 'stat-pos';
    const netLabel = netResult < 0 ? 'Net rental loss' : 'Net rental income';
    $('propertySummary').innerHTML = `
        <div class="row-spread" style="padding:6px 0;">
            <span>Rental income</span>
            <span class="bold">${fmtMoney(income)}</span>
        </div>
        <div class="row-spread" style="padding:6px 0;">
            <span>Total deductible expenses</span>
            <span class="bold">${fmtMoney(totalDeductible)}</span>
        </div>
        <div class="row-spread" style="padding:10px 0 6px;border-top:2px solid var(--border-soft);margin-top:6px;">
            <span class="bold">${hasInvestmentScope ? netLabel : 'Total Willetton outgoings (info only)'}</span>
            <span class="bold ${netCls}" style="font-size:18px;">${fmtMoney(hasInvestmentScope ? netResult : -totalNonDeductible)}</span>
        </div>
        <div class="muted small" style="padding:2px 0;">
            Plus mortgage principal of ${fmtMoney(nonDeductibleBuckets['Mortgage principal (non-deductible)']?.total || 0)} (non-deductible) and ${fmtMoney(totalNonDeductible - (nonDeductibleBuckets['Mortgage principal (non-deductible)']?.total || 0))} of other expenses.
        </div>
    `;

    // ---- Income card ----
    $('propertyIncome').innerHTML = incomeRows.length
        ? renderBucketRows([['Rental income', { total: income, rows: incomeRows }]])
        : `<div class="muted small">No rental income recorded for this period.</div>`;

    // ---- Deductible card ----
    const dedSorted = Object.entries(deductibleBuckets).sort((a,b) => b[1].total - a[1].total);
    $('propertyDeductibles').innerHTML = dedSorted.length
        ? renderBucketRows(dedSorted)
        : `<div class="muted small">${isPPOR ? 'PPOR has no deductible buckets configured.' : 'No deductible expenses found.'}</div>`;

    // ---- Non-deductible card ----
    const ndSorted = Object.entries(nonDeductibleBuckets).sort((a,b) => b[1].total - a[1].total);
    $('propertyNonDeductibles').innerHTML = ndSorted.length
        ? renderBucketRows(ndSorted)
        : `<div class="muted small">No other expenses for this period.</div>`;

    // ---- Personal income (FY) card ----
    renderIncomeByEarner(all, state.property.fyStartYear);
}

// Render Salary income grouped by employer per earner, plus a 50/50 share of
// Tranmere rental income, for the given FY. Used by the Property tab.
function renderIncomeByEarner(all, fyStartYear) {
    const target = $('incomeByEarner');
    if (!target) return;
    if (fyStartYear == null) { target.innerHTML = ''; return; }
    const { start, end } = fyRange(fyStartYear);
    const inFY = (r) => {
        const d = startOfDay(new Date(r.date));
        return d >= start && d <= end;
    };

    // Salary by earner → employer → { total, rows[] }.
    // We keep source records per bucket so the UI can expand to show date+amount per pay.
    const buckets = {};
    for (const e of EARNERS) buckets[e] = { employers: {}, total: 0 };
    for (const r of all) {
        if (r.category !== 'Income' || r.subcategory !== 'Salary') continue;
        if (!inFY(r)) continue;
        const earner = detectEarner(r.description);
        if (!earner) continue;
        const emp = (r.employer || '').trim() || '(Unspecified)';
        if (!buckets[earner].employers[emp]) buckets[earner].employers[emp] = { total: 0, rows: [] };
        buckets[earner].employers[emp].total += r.amount;
        buckets[earner].employers[emp].rows.push(r);
        buckets[earner].total += r.amount;
    }

    // Net Tranmere rental (gross rental income MINUS deductible property expenses),
    // split 50/50. This is the figure that hits each owner's taxable income under AU
    // negative-gearing rules; a loss reduces taxable income.
    const tranmereRecs = all.filter(r => recordSuburb(r) === 'Tranmere' && inFY(r));
    const rentalIncomeGross = tranmereRecs
        .filter(r => r.category === 'Income' && r.subcategory === 'Rental Income')
        .reduce((s, r) => s + r.amount, 0);
    const rentalDeductions = tranmereRecs
        .filter(r => r.category !== 'Income' && DEDUCTIBLE_MAP[`${r.category}|${r.subcategory}`])
        .reduce((s, r) => s + r.amount, 0);
    const netRental = rentalIncomeGross - rentalDeductions;
    const rentalShare = netRental / 2;

    const html = EARNERS.map(earner => {
        const b = buckets[earner];
        const empEntries = Object.entries(b.employers).sort((a,c) => c[1].total - a[1].total);
        const empRows = empEntries.length
            ? empEntries.map(([emp, eb]) => {
                // Build per-pay rows (newest first) shown inside the expanded <details>.
                const recsHtml = eb.rows
                    .sort((a,b2) => new Date(b2.date) - new Date(a.date))
                    .map(r => `<div class="row-spread" style="padding:3px 0;font-size:13px;">
                        <span class="muted">${escapeHTML(r.description)} <span class="small">${formatRowDate(r.date)}</span></span>
                        <span>${fmtMoney(r.amount)}</span>
                    </div>`).join('');
                return `<details style="border-bottom:1px solid var(--border-soft);padding:4px 0;">
                    <summary style="display:flex;justify-content:space-between;cursor:pointer;list-style:none;align-items:center;">
                        <span class="muted small">${escapeHTML(emp)} <span class="small">(${eb.rows.length})</span></span>
                        <span>${fmtMoney(eb.total)}</span>
                    </summary>
                    <div style="padding:4px 0 2px 8px;">${recsHtml}</div>
                </details>`;
            }).join('')
            : `<div class="muted small">No salary records for ${earner} this FY.</div>`;
        const totalCombined = b.total + rentalShare;
        const rentalCls = rentalShare < 0 ? 'stat-neg' : '';
        // Only show the net-rental line when there's actually some rental activity.
        const hasRental = rentalIncomeGross > 0 || rentalDeductions > 0;
        return `<div style="padding:10px 0;border-bottom:1px solid var(--border-soft);">
            <div class="bold" style="margin-bottom:4px;">${earner}</div>
            ${empRows}
            <div class="row-spread" style="padding:6px 0 2px;border-top:1px solid var(--border-soft);margin-top:4px;">
                <span class="bold">Salary subtotal</span>
                <span class="bold">${fmtMoney(b.total)}</span>
            </div>
            ${hasRental ? `<div class="row-spread" style="padding:4px 0;">
                <span class="muted small">Tranmere net rental (50% share)</span>
                <span class="${rentalCls}">${fmtMoney(rentalShare)}</span>
            </div>` : ''}
            <div class="row-spread" style="padding:6px 0 2px;border-top:1px solid var(--border-soft);margin-top:4px;">
                <span class="bold">Total income</span>
                <span class="bold">${fmtMoney(totalCombined)}</span>
            </div>
        </div>`;
    }).join('');

    // Footnote explaining how net rental was computed for transparency.
    const note = (rentalIncomeGross > 0 || rentalDeductions > 0)
        ? `Net Tranmere rental for this FY: ${fmtMoney(rentalIncomeGross)} gross income − ${fmtMoney(rentalDeductions)} deductible expenses = <strong>${fmtMoney(netRental)}</strong>. Each earner takes 50%.`
        : `No Tranmere rental activity recorded for this FY.`;
    target.innerHTML = html + `<div class="muted small" style="padding:8px 0 0;">${note}</div>`;
}

// Render a list of bucket rows; each bucket expands on tap to show its source records.
function renderBucketRows(entries) {
    return entries.map(([label, b]) => {
        const recsHtml = b.rows
            .sort((a,b2) => new Date(b2.date) - new Date(a.date))
            .map(r => `<div class="row-spread" style="padding:4px 0;font-size:13px;">
                <span class="muted">${escapeHTML(r.description)} <span class="small">${formatRowDate(r.date)}</span></span>
                <span>${fmtMoney(r.amount)}</span>
            </div>`).join('');
        return `<details style="border-bottom:1px solid var(--border-soft);padding:6px 0;">
            <summary style="display:flex;justify-content:space-between;cursor:pointer;list-style:none;">
                <span>${escapeHTML(label)} <span class="muted small">(${b.rows.length})</span></span>
                <span class="bold">${fmtMoney(b.total)}</span>
            </summary>
            <div style="padding:6px 0 2px 8px;">${recsHtml}</div>
        </details>`;
    }).join('');
}

async function exportPropertyCSV() {
    const all = await ensureCache();
    const suburb = state.property.suburb;
    const { start, end } = fyRange(state.property.fyStartYear);
    const matches = all.filter(r => {
        const sub = recordSuburb(r);
        if (suburb === '__both__') { if (!sub) return false; }
        else if (sub !== suburb) return false;
        const d = startOfDay(new Date(r.date));
        return d >= start && d <= end;
    });
    matches.sort((a,b) => new Date(a.date) - new Date(b.date));

    const csvEscape = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const header = ['Date','Property','Category','Subcategory','Description','Amount','Type','Tax bucket'];
    const lines = [header.map(csvEscape).join(',')];
    for (const r of matches) {
        const sub = recordSuburb(r);
        const k = `${r.category}|${r.subcategory}`;
        let type, bucket;
        if (r.category === 'Income') { type = 'Income'; bucket = 'Rental income'; }
        else if (INVESTMENT_SUBURBS.has(sub) && DEDUCTIBLE_MAP[k]) { type = 'Deductible'; bucket = DEDUCTIBLE_MAP[k]; }
        else if (r.category === 'Housing' && r.subcategory === 'Mortgage') { type = 'Non-deductible'; bucket = 'Mortgage principal'; }
        else { type = 'Other'; bucket = `${r.category} / ${r.subcategory || ''}`; }
        lines.push([
            dateToISO(new Date(r.date)),
            sub || '',
            r.category, r.subcategory || '',
            r.description || '',
            r.amount.toFixed(2),
            type, bucket
        ].map(csvEscape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${suburb}-${fyLabel(state.property.fyStartYear).replace(/\s+/g,'')}.csv`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
    showToast(`Exported ${matches.length} records`);
}

/* ====================== RENEWALS ====================== */
// Track insurance policies, council rates, ESL — anything with a renewal
// cadence — so you don't miss payment/expiry dates. Stored in IndexedDB
// (separate store) so they're never confused with expense records.

const RENEWAL_TYPE_META = {
    home:  { label: 'Home insurance', emoji: '🏠' },
    car:   { label: 'Car insurance',  emoji: '🚗' },
    rates: { label: 'Council rates',  emoji: '🧾' },
    esl:   { label: 'ESL',            emoji: '🚒' },
    other: { label: 'Other',          emoji: '🗂️' }
};

// Compute next due date by adding `months` to the lastPaid date.
// JS Date addition is intentional: setMonth handles year rollover.
function nextDueDate(lastPaidDate, renewalMonths) {
    const d = new Date(lastPaidDate);
    d.setMonth(d.getMonth() + (renewalMonths || 12));
    return startOfDay(d);
}
function daysBetween(a, b) {
    return Math.round((startOfDay(new Date(b)) - startOfDay(new Date(a))) / 86400000);
}
function renewalStatus(daysToDue) {
    if (daysToDue < 0)  return 'overdue';
    if (daysToDue <= 30) return 'duesoon';
    if (daysToDue <= 90) return 'upcoming';
    return 'future';
}

// Annotate a renewal with computed fields.
function annotateRenewal(r) {
    const due = nextDueDate(r.lastPaidDate, r.renewalMonths);
    const today = startOfDay(new Date());
    const days = daysBetween(today, due);
    return { ...r, nextDueDate: due, daysToDue: days, status: renewalStatus(days) };
}

// ---- Banner + title prefix ----
// Both update from the same source of truth so they never drift apart.
const BASE_TITLE = 'Expense Tracker';
async function refreshOverdueIndicators() {
    const all = await getAllRenewals();
    const annotated = all.map(annotateRenewal);
    const overdue = annotated.filter(r => r.status === 'overdue');
    const banner = $('overdueBanner');
    if (overdue.length === 0) {
        banner.style.display = 'none';
        document.title = BASE_TITLE; // reset to known good title
        return;
    }
    // Sort by oldest overdue first so the worst offender is mentioned.
    overdue.sort((a,b) => a.daysToDue - b.daysToDue);
    const names = overdue.map(r => r.label).join(', ');
    banner.innerHTML = `
        <span>⚠️</span>
        <span><strong>${overdue.length} renewal${overdue.length === 1 ? '' : 's'} overdue:</strong> ${escapeHTML(names)}</span>
        <button class="review-btn" id="overdueReviewBtn">Review</button>
    `;
    banner.style.display = '';
    $('overdueReviewBtn').addEventListener('click', () => setView('settings'));
    // Browser/tab title prefix
    document.title = `⚠️ ${overdue.length} overdue · ${BASE_TITLE}`;
}

// ---- Insights card ----
async function renderRenewalsInsight() {
    const all = (await getAllRenewals()).map(annotateRenewal);
    // Show overdue + everything due in next 90 days. Beyond 90d hidden to keep card focused.
    const visible = all.filter(r => r.daysToDue <= 90);
    const card = $('renewalsInsightCard');
    const target = $('renewalsInsight');
    if (visible.length === 0) {
        card.style.display = 'none';
        target.innerHTML = '';
        return;
    }
    card.style.display = '';
    visible.sort((a,b) => a.daysToDue - b.daysToDue);
    target.innerHTML = visible.map(r => {
        const meta = RENEWAL_TYPE_META[r.type] || RENEWAL_TYPE_META.other;
        const whenLabel = r.daysToDue < 0
            ? `OVERDUE ${Math.abs(r.daysToDue)}d`
            : r.daysToDue === 0 ? 'due today'
            : r.daysToDue === 1 ? 'due tomorrow'
            : `due in ${r.daysToDue}d`;
        const dateStr = r.nextDueDate.toLocaleDateString(undefined, { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
        return `<div class="renewal-row">
            <span class="status-dot ${r.status}"></span>
            <div class="meta">
                <div class="label">${meta.emoji} ${escapeHTML(r.label)}</div>
                <div class="sub">${dateStr} · ${whenLabel} · last paid ${fmtMoney(r.lastAmount)}</div>
            </div>
            <div class="actions">
                <button class="btn btn-secondary btn-sm" data-renew="${r.id}">Renewed</button>
            </div>
        </div>`;
    }).join('');
    // Wire mark-renewed buttons
    target.querySelectorAll('[data-renew]').forEach(btn => {
        btn.addEventListener('click', () => markRenewed(parseInt(btn.dataset.renew, 10)));
    });
}

// ---- Settings list ----
async function renderRenewalsManager() {
    const all = (await getAllRenewals()).map(annotateRenewal);
    const list = $('renewalList');
    const empty = $('renewalEmpty');
    if (all.length === 0) {
        list.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');
    all.sort((a,b) => a.daysToDue - b.daysToDue);
    list.innerHTML = all.map(r => {
        const meta = RENEWAL_TYPE_META[r.type] || RENEWAL_TYPE_META.other;
        const dueStr = r.nextDueDate.toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' });
        const sub = r.status === 'overdue'
            ? `<span class="bold" style="color:#DC2626;">OVERDUE ${Math.abs(r.daysToDue)}d</span> · was due ${dueStr}`
            : `due ${dueStr} · ${r.daysToDue}d`;
        return `<div class="renewal-row">
            <span class="status-dot ${r.status}"></span>
            <div class="meta">
                <div class="label">${meta.emoji} ${escapeHTML(r.label)}</div>
                <div class="sub">${sub} · last paid ${fmtMoney(r.lastAmount)}</div>
            </div>
            <div class="actions">
                <button class="btn btn-secondary btn-sm" data-renew-edit="${r.id}">Edit</button>
                <button class="btn btn-secondary btn-sm" data-renew-mark="${r.id}">Renewed</button>
            </div>
        </div>`;
    }).join('');
    list.querySelectorAll('[data-renew-edit]').forEach(btn => {
        btn.addEventListener('click', () => openRenewalModal(parseInt(btn.dataset.renewEdit, 10)));
    });
    list.querySelectorAll('[data-renew-mark]').forEach(btn => {
        btn.addEventListener('click', () => markRenewed(parseInt(btn.dataset.renewMark, 10)));
    });
}

// ---- Mark renewed ----
async function markRenewed(id) {
    const all = await getAllRenewals();
    const r = all.find(x => x.id === id);
    if (!r) return;
    const today = startOfDay(new Date());
    // Optional: ask for the amount paid this time. Default to last amount.
    const amtStr = prompt(`Amount paid for "${r.label}"?`, String(r.lastAmount ?? ''));
    if (amtStr === null) return; // cancelled
    const amt = parseFloat(amtStr);
    if (!isFinite(amt) || amt < 0) { showToast('Invalid amount'); return; }
    await updateRenewal(id, { lastPaidDate: today, lastAmount: amt });
    showToast(`Renewed · next due ${nextDueDate(today, r.renewalMonths).toLocaleDateString(undefined, { day:'2-digit', month:'short', year:'numeric' })}`);
    await refreshOverdueIndicators();
    if (state.activeView === 'insights') renderRenewalsInsight();
    if (state.activeView === 'settings') renderRenewalsManager();
}

// ---- Add/edit modal ----
let editingRenewalId = null;
async function openRenewalModal(id = null) {
    editingRenewalId = id;
    if (id == null) {
        $('renewalTitle').textContent = 'New renewal';
        $('renewalLabel').value = '';
        $('renewalType').value = 'home';
        $('renewalLastPaid').value = dateToISO(new Date());
        $('renewalLastAmount').value = '';
        $('renewalCadence').value = '12';
        $('renewalNotes').value = '';
        $('renewalDeleteBtn').style.display = 'none';
    } else {
        const all = await getAllRenewals();
        const r = all.find(x => x.id === id);
        if (!r) return;
        $('renewalTitle').textContent = `Edit · ${r.label}`;
        $('renewalLabel').value = r.label || '';
        $('renewalType').value = r.type || 'other';
        $('renewalLastPaid').value = dateToISO(new Date(r.lastPaidDate));
        $('renewalLastAmount').value = r.lastAmount ?? '';
        $('renewalCadence').value = String(r.renewalMonths || 12);
        $('renewalNotes').value = r.notes || '';
        $('renewalDeleteBtn').style.display = '';
    }
    $('renewalStatus').textContent = '';
    $('renewalModal').classList.add('open');
}
function closeRenewalModal() {
    $('renewalModal').classList.remove('open');
    editingRenewalId = null;
}

async function saveRenewal() {
    const label = $('renewalLabel').value.trim();
    if (!label) { setStatus('renewalStatus', 'Label is required.', 'error'); return; }
    const lastPaid = $('renewalLastPaid').value;
    if (!lastPaid) { setStatus('renewalStatus', 'Last paid date is required.', 'error'); return; }
    const amt = parseFloat($('renewalLastAmount').value);
    if (!isFinite(amt) || amt < 0) { setStatus('renewalStatus', 'Amount is required.', 'error'); return; }
    const rec = {
        label,
        type: $('renewalType').value,
        lastPaidDate: parseDateString(lastPaid),
        lastAmount: amt,
        renewalMonths: parseInt($('renewalCadence').value, 10) || 12,
        notes: $('renewalNotes').value.trim()
    };
    if (editingRenewalId == null) await addRenewal(rec);
    else await updateRenewal(editingRenewalId, rec);
    showToast('Saved');
    closeRenewalModal();
    await refreshOverdueIndicators();
    if (state.activeView === 'settings') renderRenewalsManager();
    if (state.activeView === 'insights') renderRenewalsInsight();
}

async function deleteRenewalFromModal() {
    if (editingRenewalId == null) return;
    if (!confirm('Delete this renewal?')) return;
    await deleteRenewal(editingRenewalId);
    showToast('Deleted');
    closeRenewalModal();
    await refreshOverdueIndicators();
    if (state.activeView === 'settings') renderRenewalsManager();
    if (state.activeView === 'insights') renderRenewalsInsight();
}

// ---- One-time seed ----
// Seeds the renewals store with default policies derived from existing expenses.
// Idempotent: only runs when the store is empty.
async function maybeSeedRenewals() {
    const existing = await getAllRenewals();
    if (existing.length > 0) return;
    const all = await getAllExpenses();
    // Helper: find the most-recent record matching predicates.
    const lastMatch = (pred) => {
        const matches = all.filter(pred);
        matches.sort((a,b) => new Date(b.date) - new Date(a.date));
        return matches[0] || null;
    };
    const seedRule = (desc, label, type, predicate, months) => {
        const m = lastMatch(predicate);
        if (!m) return null;
        return {
            label, type,
            lastPaidDate: new Date(m.date),
            lastAmount: m.amount,
            renewalMonths: months,
            notes: `Seeded from "${m.description}" on ${dateToISO(new Date(m.date))}`
        };
    };
    const seeds = [
        seedRule('tranmere ins', 'Tranmere home insurance', 'home',
            r => r.category === 'Insurance' && r.subcategory === 'Home' && (r.description || '').toLowerCase().includes('tranmere'), 12),
        seedRule('willetton ins', 'Willetton home insurance', 'home',
            r => r.category === 'Insurance' && r.subcategory === 'Home' && (r.description || '').toLowerCase().includes('willetton'), 12),
        seedRule('mazda', 'Mazda car insurance', 'car',
            r => r.category === 'Insurance' && r.subcategory === 'Car' && (r.description || '').toLowerCase().includes('mazda'), 12),
        seedRule('camry', 'Camry car insurance', 'car',
            r => r.category === 'Insurance' && r.subcategory === 'Car' && (r.description || '').toLowerCase().includes('camry'), 12),
        seedRule('tranmere rates', 'Tranmere council rates', 'rates',
            r => r.subcategory === 'Council Rates' && (r.description || '').toLowerCase().includes('tranmere'), 3),
        seedRule('willetton rates', 'Willetton council rates', 'rates',
            r => r.subcategory === 'Council Rates' && (r.description || '').toLowerCase().includes('willetton'), 3),
        seedRule('tranmere esl', 'Tranmere ESL', 'esl',
            r => r.subcategory === 'ESL' && (r.description || '').toLowerCase().includes('tranmere'), 12),
    ].filter(Boolean);

    for (const s of seeds) await addRenewal(s);
    if (seeds.length) console.log(`[renewals] Seeded ${seeds.length} policies from existing data.`);
}

/* ====================== INCOME / EMPLOYER ====================== */
// Detect the earner of a Salary record from its description, case-insensitive
// substring match. Works for "Yatin Salary", "Asha salary", "Yatin" etc.
const EARNERS = ['Yatin', 'Asha'];

function detectEarner(desc) {
    const d = (desc || '').toLowerCase();
    for (const e of EARNERS) if (d.includes(e.toLowerCase())) return e;
    return null;
}

// Bulk-set employer for all Salary records of a given earner within [fromDate, toDate].
// Used by the Settings tool. Returns count of records updated.
async function bulkSetEmployer({ earner, employer, fromDate, toDate }) {
    if (!earner || !employer) return 0;
    const all = await getAllExpenses();
    const from = fromDate ? startOfDay(parseDateString(fromDate)) : null;
    const to   = toDate   ? startOfDay(parseDateString(toDate))   : null;
    let updated = 0;
    for (const r of all) {
        if (r.category !== 'Income' || r.subcategory !== 'Salary') continue;
        if (detectEarner(r.description) !== earner) continue;
        const d = startOfDay(new Date(r.date));
        if (from && d < from) continue;
        if (to && d > to) continue;
        if (r.employer === employer) continue; // already set
        await updateExpense(r.id, { employer });
        updated++;
    }
    if (updated > 0) invalidateCache();
    return updated;
}

// Render the bulk-set-employer tool in Settings. One row per earner with
// from/to/employer inputs and an Apply button. Counts shown as a guide.
async function renderEmployerBulkTool() {
    const target = $('employerBulkTool');
    const all = await getAllExpenses();
    const salaries = all.filter(r => r.category === 'Income' && r.subcategory === 'Salary');
    target.innerHTML = '';
    for (const earner of EARNERS) {
        const earnerRecs = salaries.filter(r => detectEarner(r.description) === earner);
        const total = earnerRecs.length;
        const withEmployer = earnerRecs.filter(r => r.employer).length;
        const sortedDates = earnerRecs.map(r => dateToISO(new Date(r.date))).sort();
        const earliest = sortedDates[0] || '';
        const latest = sortedDates[sortedDates.length - 1] || '';

        // Distinct employers in use (informational)
        const employersSeen = [...new Set(earnerRecs.map(r => (r.employer || '').trim()).filter(Boolean))];
        const seenLine = employersSeen.length
            ? `Employers on file: ${employersSeen.map(e => escapeHTML(e)).join(', ')}`
            : 'No employer set on any record yet.';

        const row = document.createElement('div');
        row.style.cssText = 'padding:10px 0;border-bottom:1px solid var(--border-soft);';
        row.innerHTML = `
            <div class="bold" style="margin-bottom:4px;">${earner}</div>
            <div class="muted small" style="margin-bottom:8px;">${total} salary record${total === 1 ? '' : 's'} (${withEmployer} with employer set). ${seenLine}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px;">
                <div class="field" style="margin:0;">
                    <label class="muted small">From</label>
                    <input type="date" data-bulk-from="${earner}" value="${earliest}">
                </div>
                <div class="field" style="margin:0;">
                    <label class="muted small">To</label>
                    <input type="date" data-bulk-to="${earner}" value="${latest}">
                </div>
            </div>
            <div class="field" style="margin:0 0 8px 0;">
                <label class="muted small">Employer</label>
                <input type="text" data-bulk-employer="${earner}" placeholder="e.g. Acme Pty Ltd">
            </div>
            <button class="btn btn-primary btn-sm" data-bulk-apply="${earner}">Apply to ${earner}'s records in range</button>
        `;
        target.appendChild(row);
    }
    target.querySelectorAll('[data-bulk-apply]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const earner = btn.dataset.bulkApply;
            const employer = target.querySelector(`[data-bulk-employer="${earner}"]`).value.trim();
            const fromDate = target.querySelector(`[data-bulk-from="${earner}"]`).value;
            const toDate = target.querySelector(`[data-bulk-to="${earner}"]`).value;
            if (!employer) { setStatus('employerBulkStatus', `Enter an employer name for ${earner}.`, 'error'); return; }
            const count = await bulkSetEmployer({ earner, employer, fromDate, toDate });
            setStatus('employerBulkStatus', `Set "${employer}" on ${count} ${earner} record${count === 1 ? '' : 's'}.`, 'success');
            showToast(`Updated ${count} records`);
            await renderEmployerBulkTool(); // re-render with refreshed counts
        });
    });
}

/* ====================== LOANS ====================== */
// Per-property loan tracking. Anchor balance + date come from the user's most
// recent bank statement; the app projects current balance forward by:
//   currentBalance = anchorBalance + Σ(interest since anchor) − Σ(gross payments since anchor)
//
// Suburb match: a record belongs to a loan if its description contains the
// loan's `label` (case-insensitive). Same convention used elsewhere in the app.

function loanTxBetween(label, fromDate, toDate, allExpenses) {
    const lower = label.toLowerCase();
    let interest = 0, paymentGross = 0, paymentCount = 0;
    for (const r of allExpenses) {
        const d = startOfDay(new Date(r.date));
        if (d <= fromDate || d > toDate) continue;
        const desc = (r.description || '').toLowerCase();
        if (!desc.includes(lower)) continue;
        if (r.category === 'Financial Expenses' && r.subcategory === 'Interest') {
            interest += r.amount;
        } else if (r.category === 'Housing' && r.subcategory === 'Mortgage') {
            const gross = (r.grossAmount != null) ? Number(r.grossAmount) : Number(r.amount);
            paymentGross += gross;
            paymentCount++;
        }
    }
    return { interest, paymentGross, paymentCount };
}

function currentLoanBalance(loan, allExpenses) {
    if (!loan.anchorBalance || !loan.anchorDate) return null;
    const anchor = startOfDay(new Date(loan.anchorDate));
    const today = startOfDay(new Date());
    // Include every transaction up to and including today so the displayed
    // balance updates the moment you record a new mortgage payment (drops it)
    // or a new interest entry (raises it). Note: between a fortnightly payment
    // and the matching monthly interest entry, the balance shown will be
    // briefly understated by ~half a month of interest — that's the conscious
    // trade-off for real-time updates.
    if (anchor > today) return loan.anchorBalance;
    const { interest, paymentGross } = loanTxBetween(loan.label, anchor, today, allExpenses);
    return loan.anchorBalance + interest - paymentGross;
}

// Infer annual rate from the most recent interest charge: monthly interest /
// balance-at-that-moment × 12. Works regardless of whether the most recent
// charge happened before or after the anchor.
function inferredAnnualRate(loan, allExpenses) {
    if (!loan.anchorBalance || !loan.anchorDate) return null;
    const lower = loan.label.toLowerCase();
    const anchor = startOfDay(new Date(loan.anchorDate));

    // Find the most recent interest charge for this suburb — no anchor filter.
    const interests = allExpenses
        .filter(r => r.category === 'Financial Expenses' && r.subcategory === 'Interest'
                && (r.description || '').toLowerCase().includes(lower))
        .sort((a,b) => new Date(b.date) - new Date(a.date));
    if (interests.length === 0) return null;
    const most = interests[0];
    const mostDate = startOfDay(new Date(most.date));

    // Compute balance at start-of-day of mostDate (i.e. just before the charge hit).
    // If the charge is AFTER the anchor: walk forward, replaying transactions.
    // If the charge is BEFORE the anchor: walk backward from the anchor, REVERSING
    // the effect of every transaction between mostDate and anchor (so we get back
    // to the pre-charge balance).
    let balanceBefore = loan.anchorBalance;
    if (mostDate >= anchor) {
        for (const r of allExpenses) {
            const d = startOfDay(new Date(r.date));
            if (d <= anchor || d >= mostDate) continue;
            const desc = (r.description || '').toLowerCase();
            if (!desc.includes(lower)) continue;
            if (r.category === 'Financial Expenses' && r.subcategory === 'Interest') balanceBefore += r.amount;
            else if (r.category === 'Housing' && r.subcategory === 'Mortgage') {
                balanceBefore -= (r.grossAmount != null) ? Number(r.grossAmount) : Number(r.amount);
            }
        }
    } else {
        // Backward walk: undo every transaction in [mostDate, anchor].
        // The charge itself is at mostDate and IS undone in this loop, so balanceBefore
        // ends up as the balance at the start of mostDate (i.e. pre-charge).
        for (const r of allExpenses) {
            const d = startOfDay(new Date(r.date));
            if (d < mostDate || d > anchor) continue;
            const desc = (r.description || '').toLowerCase();
            if (!desc.includes(lower)) continue;
            // Reverse effects: interest had added → subtract; payment had subtracted → add back.
            if (r.category === 'Financial Expenses' && r.subcategory === 'Interest') balanceBefore -= r.amount;
            else if (r.category === 'Housing' && r.subcategory === 'Mortgage') {
                balanceBefore += (r.grossAmount != null) ? Number(r.grossAmount) : Number(r.amount);
            }
        }
    }
    if (balanceBefore <= 0) return null;
    return (most.amount / balanceBefore) * 12 * 100;
}

// Monthly equivalent of recent gross repayments.
// Strategy: take up to 6 most-recent mortgage records with grossAmount that
// pre-date the current month (since this month's payments lack a corresponding
// interest entry and would otherwise skew the figure). Records without
// grossAmount are *skipped* — their `amount` is principal-only and would
// massively underestimate the gross. Then convert sum→monthly using the actual
// date span rather than a fixed /3, so fortnightly cadences that don't fit
// cleanly into 3 calendar months are handled correctly.
function avgMonthlyPayment(loan, allExpenses) {
    const lower = loan.label.toLowerCase();
    const today = startOfDay(new Date());
    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const records = allExpenses
        .filter(r => r.category === 'Housing' && r.subcategory === 'Mortgage')
        .filter(r => (r.description || '').toLowerCase().includes(lower))
        .filter(r => r.grossAmount != null)
        .filter(r => startOfDay(new Date(r.date)) < startOfCurrentMonth)
        .sort((a,b) => new Date(b.date) - new Date(a.date));

    if (records.length === 0) return null;

    const recent = records.slice(0, 6);
    const total = recent.reduce((s, r) => s + Number(r.grossAmount), 0);

    if (recent.length === 1) {
        // Single record — assume fortnightly cadence (most common).
        return Number(recent[0].grossAmount) * 26 / 12;
    }

    const newest = new Date(recent[0].date);
    const oldest = new Date(recent[recent.length - 1].date);
    const daysSpan = (newest - oldest) / 86400000;
    if (daysSpan < 7) {
        // Multiple records very close together — odd, fall back to per-record × 26/12.
        return (total / recent.length) * 26 / 12;
    }
    // Standard: total/(days spanned) × average days per month.
    return (total / daysSpan) * 30.44;
}

// Standard amortization formula:
//   n = -log(1 - (r*B)/M) / log(1 + r)
// where B=balance, M=monthly payment, r=monthly rate (decimal).
function projectPayoff(balance, monthlyPayment, annualRatePct) {
    if (balance == null) return { months: null, totalInterest: null, payoffDate: null, neverPaysOff: false };
    if (balance <= 0) return { months: 0, totalInterest: 0, payoffDate: new Date(), neverPaysOff: false };
    if (!monthlyPayment || !annualRatePct || annualRatePct <= 0) {
        return { months: null, totalInterest: null, payoffDate: null, neverPaysOff: false };
    }
    const r = annualRatePct / 100 / 12;
    if (monthlyPayment <= balance * r) {
        return { months: Infinity, totalInterest: Infinity, payoffDate: null, neverPaysOff: true };
    }
    const n = -Math.log(1 - (r * balance) / monthlyPayment) / Math.log(1 + r);
    const months = Math.ceil(n);
    const totalInterest = (monthlyPayment * months) - balance;
    const payoff = new Date();
    payoff.setMonth(payoff.getMonth() + months);
    return { months, totalInterest, payoffDate: payoff, neverPaysOff: false };
}

function monthYearLabel(d) {
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

async function renderLoans() {
    await maybeSeedLoans();
    const [loans, expenses] = await Promise.all([getAllLoans(), getAllExpenses()]);
    const cardsTarget = $('loanCards');
    const combinedTarget = $('loanCombined');
    const combinedCard = $('loanCombinedCard');

    cardsTarget.innerHTML = '';

    // Per-loan totals for the combined card.
    let totalBalance = 0, totalRemainingInterest = 0;
    let latestPayoff = null;
    let setupCount = 0;

    for (const loan of loans) {
        const setUp = loan.anchorBalance != null && loan.anchorDate != null;
        const balance = setUp ? currentLoanBalance(loan, expenses) : null;
        const inferredRate = setUp ? inferredAnnualRate(loan, expenses) : null;
        const effectiveRate = (loan.currentRate != null) ? loan.currentRate : inferredRate;
        const monthlyPmt = setUp ? avgMonthlyPayment(loan, expenses) : 0;
        const proj = projectPayoff(balance, monthlyPmt, effectiveRate);

        if (setUp) {
            setupCount++;
            if (balance != null) totalBalance += balance;
            if (Number.isFinite(proj.totalInterest)) totalRemainingInterest += proj.totalInterest;
            if (proj.payoffDate && (!latestPayoff || proj.payoffDate > latestPayoff)) latestPayoff = proj.payoffDate;
        }

        cardsTarget.innerHTML += renderLoanCard(loan, balance, inferredRate, effectiveRate, monthlyPmt, proj);
    }

    // Wire edit buttons.
    cardsTarget.querySelectorAll('[data-edit-loan]').forEach(btn => {
        btn.addEventListener('click', () => openLoanModal(parseInt(btn.dataset.editLoan, 10)));
    });

    // Combined card only shown when ≥2 loans set up.
    if (setupCount >= 2) {
        combinedCard.style.display = '';
        const combinedPayoff = latestPayoff
            ? `${monthYearLabel(latestPayoff)} (${Math.round((latestPayoff - new Date()) / 86400000 / 30.44 / 12 * 10) / 10} years)`
            : '—';
        combinedTarget.innerHTML = `
            <div class="row-spread" style="padding:8px 0;">
                <span>Total outstanding balance</span>
                <span class="bold" style="font-size:22px;">${fmtMoney(totalBalance)}</span>
            </div>
            <div class="row-spread" style="padding:6px 0;border-top:1px solid var(--border-soft);">
                <span>Combined payoff (latest of the two)</span>
                <span>${combinedPayoff}</span>
            </div>
            <div class="row-spread" style="padding:6px 0;">
                <span>Combined remaining interest</span>
                <span class="bold stat-neg">${fmtMoney(totalRemainingInterest)}</span>
            </div>
        `;
    } else {
        combinedCard.style.display = 'none';
    }
}

function renderLoanCard(loan, balance, inferredRate, effectiveRate, monthlyPmt, proj) {
    const setUp = loan.anchorBalance != null && loan.anchorDate != null;
    if (!setUp) {
        return `<div class="card">
            <div class="row-spread" style="margin-bottom:6px;">
                <span class="card-title" style="margin:0;">${escapeHTML(loan.label)}</span>
                <button class="btn btn-primary btn-sm" data-edit-loan="${loan.id}">Set up</button>
            </div>
            <div class="muted small">Enter the current outstanding balance and the date of your most recent statement to enable projections.</div>
        </div>`;
    }
    const rateLabel = loan.currentRate != null
        ? `${loan.currentRate.toFixed(2)}% (manual)`
        : inferredRate != null
            ? `${inferredRate.toFixed(2)}% (inferred)`
            : '—';
    let payoffLabel;
    if (proj.neverPaysOff) payoffLabel = '⚠️ Payment too low to cover interest';
    else if (proj.payoffDate == null) payoffLabel = effectiveRate == null ? 'Set rate to project' : 'No recent payments';
    else payoffLabel = `${monthYearLabel(proj.payoffDate)} (~${(proj.months/12).toFixed(1)} years)`;

    const remInterestLabel = proj.neverPaysOff ? '∞' : proj.totalInterest != null ? fmtMoney(proj.totalInterest) : '—';
    const anchorLabel = `${fmtMoney(loan.anchorBalance)} on ${formatRowDate(loan.anchorDate)}`;

    return `<div class="card">
        <div class="row-spread" style="margin-bottom:6px;">
            <span class="card-title" style="margin:0;">${escapeHTML(loan.label)}</span>
            <button class="btn btn-secondary btn-sm" data-edit-loan="${loan.id}">Edit</button>
        </div>
        <div class="row-spread" style="padding:8px 0;">
            <span>Current balance</span>
            <span class="bold" style="font-size:20px;">${fmtMoney(balance)}</span>
        </div>
        <div class="muted small" style="padding:0 0 6px;">Anchor: ${anchorLabel}</div>
        <div class="row-spread" style="padding:6px 0;border-top:1px solid var(--border-soft);">
            <span>Current rate</span>
            <span>${rateLabel}</span>
        </div>
        <div class="row-spread" style="padding:6px 0;">
            <span>Avg monthly payment (last 3 mo)</span>
            <span>${fmtMoney(monthlyPmt)}</span>
        </div>
        <div class="row-spread" style="padding:6px 0;">
            <span>Estimated payoff</span>
            <span>${payoffLabel}</span>
        </div>
        <div class="row-spread" style="padding:6px 0;">
            <span>Total remaining interest</span>
            <span class="bold stat-neg">${remInterestLabel}</span>
        </div>
    </div>`;
}

// One-time seed: create empty placeholders for Willetton + Tranmere on first launch.
async function maybeSeedLoans() {
    const existing = await getAllLoans();
    if (existing.length > 0) return;
    for (const suburb of ['Willetton', 'Tranmere']) {
        await addLoan({ label: suburb, anchorBalance: null, anchorDate: null, currentRate: null, notes: '' });
    }
}

// Settings list (CRUD entry point).
async function renderLoansManager() {
    const loans = await getAllLoans();
    const list = $('loanManageList');
    if (!list) return;
    if (loans.length === 0) {
        list.innerHTML = '<div class="muted small">No loans yet. Add one.</div>';
        return;
    }
    list.innerHTML = loans.map(l => {
        const sub = (l.anchorBalance != null && l.anchorDate != null)
            ? `Anchor ${fmtMoney(l.anchorBalance)} on ${formatRowDate(l.anchorDate)}`
            : 'Not set up';
        return `<div class="renewal-row">
            <div class="meta">
                <div class="label">${escapeHTML(l.label)}</div>
                <div class="sub">${sub}${l.currentRate != null ? ` · ${l.currentRate.toFixed(2)}% manual` : ''}</div>
            </div>
            <div class="actions">
                <button class="btn btn-secondary btn-sm" data-edit-loan-set="${l.id}">Edit</button>
            </div>
        </div>`;
    }).join('');
    list.querySelectorAll('[data-edit-loan-set]').forEach(btn => {
        btn.addEventListener('click', () => openLoanModal(parseInt(btn.dataset.editLoanSet, 10)));
    });
}

// ---- Edit modal ----
let editingLoanId = null;
async function openLoanModal(id = null) {
    editingLoanId = id;
    if (id == null) {
        $('loanModalTitle').textContent = 'New loan';
        $('loanLabel').value = '';
        $('loanAnchorBalance').value = '';
        $('loanAnchorDate').value = '';
        $('loanCurrentRate').value = '';
        $('loanNotes').value = '';
        $('loanDeleteBtn').style.display = 'none';
    } else {
        const loans = await getAllLoans();
        const l = loans.find(x => x.id === id);
        if (!l) return;
        $('loanModalTitle').textContent = `Edit · ${l.label}`;
        $('loanLabel').value = l.label || '';
        $('loanAnchorBalance').value = l.anchorBalance != null ? l.anchorBalance : '';
        $('loanAnchorDate').value = l.anchorDate ? dateToISO(new Date(l.anchorDate)) : '';
        $('loanCurrentRate').value = l.currentRate != null ? l.currentRate : '';
        $('loanNotes').value = l.notes || '';
        $('loanDeleteBtn').style.display = '';
    }
    $('loanStatus').textContent = '';
    $('loanModal').classList.add('open');
}
function closeLoanModal() {
    $('loanModal').classList.remove('open');
    editingLoanId = null;
}
async function saveLoan() {
    const label = $('loanLabel').value.trim();
    if (!label) { setStatus('loanStatus', 'Label is required.', 'error'); return; }
    const anchorBal = $('loanAnchorBalance').value;
    const anchorDt = $('loanAnchorDate').value;
    const rate = $('loanCurrentRate').value;
    const rec = {
        label,
        anchorBalance: anchorBal === '' ? null : parseFloat(anchorBal),
        anchorDate: anchorDt ? parseDateString(anchorDt) : null,
        currentRate: rate === '' ? null : parseFloat(rate),
        notes: $('loanNotes').value.trim()
    };
    if (editingLoanId == null) await addLoan(rec);
    else await updateLoan(editingLoanId, rec);
    showToast('Saved');
    closeLoanModal();
    if (state.activeView === 'loans') renderLoans();
    if (state.activeView === 'settings') renderLoansManager();
}
async function deleteLoanFromModal() {
    if (editingLoanId == null) return;
    if (!confirm('Delete this loan?')) return;
    await deleteLoan(editingLoanId);
    showToast('Deleted');
    closeLoanModal();
    if (state.activeView === 'loans') renderLoans();
    if (state.activeView === 'settings') renderLoansManager();
}

/* ====================== SETTINGS ====================== */

async function renderSettings() {
    await renderBudgetEditor();
    await renderLoansManager();
    await renderRenewalsManager();
    await renderEmployerBulkTool();
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
    // Pull every store so a single export file is a complete backup.
    const [expenses, budgets, favorites, renewals, loans] = await Promise.all([
        getAllExpenses(),
        getAllBudgets(),
        getAllFavorites(),
        getAllRenewals(),
        getAllLoans()
    ]);
    const out = {
        formatVersion: 3,
        exportedAt: new Date().toISOString(),
        expenses:  expenses.map(r => ({ ...r, date: dateToISO(new Date(r.date)) })),
        budgets,
        favorites,
        renewals:  renewals.map(r => ({ ...r, lastPaidDate: dateToISO(new Date(r.lastPaidDate)) })),
        loans:     loans.map(l => ({ ...l, anchorDate: l.anchorDate ? dateToISO(new Date(l.anchorDate)) : null }))
    };
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'expenses.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${expenses.length} expenses · ${budgets.length} budgets · ${favorites.length} favorites · ${renewals.length} renewals · ${loans.length} loans`);
}

async function importDataFromFile(file) {
    try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const imported = { expenses: 0, budgets: 0, favorites: 0, renewals: 0, loans: 0 };

        if (Array.isArray(parsed)) {
            // Legacy format: a flat array of expenses (pre-v2 backups).
            await importAllExpenses(parsed);
            imported.expenses = parsed.length;
        } else if (parsed && typeof parsed === 'object') {
            // New format: an object containing one array per store. Only stores
            // that are PRESENT in the file are wiped & replaced. Missing keys
            // leave the existing data alone.
            if (Array.isArray(parsed.expenses))  { await importAllExpenses(parsed.expenses);   imported.expenses  = parsed.expenses.length; }
            if (Array.isArray(parsed.budgets))   { await importAllBudgets(parsed.budgets);     imported.budgets   = parsed.budgets.length; }
            if (Array.isArray(parsed.favorites)) { await importAllFavorites(parsed.favorites); imported.favorites = parsed.favorites.length; }
            if (Array.isArray(parsed.renewals))  { await importAllRenewals(parsed.renewals);   imported.renewals  = parsed.renewals.length; }
            if (Array.isArray(parsed.loans))     { await importAllLoans(parsed.loans);         imported.loans     = parsed.loans.length; }
        } else {
            throw new Error('Invalid JSON');
        }

        invalidateCache();
        await refreshOverdueIndicators(); // re-evaluate banner/title after renewal restore
        const msg = `Imported ${imported.expenses} expenses, ${imported.budgets} budgets, ${imported.favorites} favorites, ${imported.renewals} renewals, ${imported.loans} loans.`;
        setStatus('settingsStatus', msg, 'success');
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
        // Self-hosted in vendor/ so no third-party CDN is contacted at runtime.
        script.src = 'vendor/pdf.min.js';
        script.onload = () => {
            if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
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

// ---- Month/year picker (tap label to open) ----
// Two-column picker: years (left) + months (right). Tapping either column
// applies immediately and re-renders the heatmap; tap Done or the backdrop
// to close. Year range goes from the earliest record's year up to next year.
async function openMonthPicker() {
    const all = await ensureCache();
    const years = new Set();
    for (const r of all) years.add(new Date(r.date).getFullYear());
    years.add(new Date().getFullYear());     // ensure current year
    years.add(new Date().getFullYear() + 1); // and one future year
    const sortedYears = [...years].sort((a,b) => b - a); // newest first

    const monthsCol = $('mpMonths');
    const yearsCol  = $('mpYears');

    function renderCells() {
        yearsCol.innerHTML = sortedYears.map(y =>
            `<button class="mp-cell ${y === state.heatmap.year ? 'active' : ''}" data-mp-year="${y}">${y}</button>`
        ).join('');
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        monthsCol.innerHTML = monthNames.map((m, i) =>
            `<button class="mp-cell ${i === state.heatmap.month ? 'active' : ''}" data-mp-month="${i}">${m}</button>`
        ).join('');
        // Scroll the active item into view so the user sees the current selection.
        const activeYear = yearsCol.querySelector('.active');
        const activeMonth = monthsCol.querySelector('.active');
        if (activeYear) activeYear.scrollIntoView({ block: 'center' });
        if (activeMonth) activeMonth.scrollIntoView({ block: 'center' });
    }

    renderCells();
    $('monthPickerModal').classList.add('open');

    // Single delegated click handler — applies on any year or month tap.
    function onPickerClick(e) {
        const yEl = e.target.closest('[data-mp-year]');
        const mEl = e.target.closest('[data-mp-month]');
        if (yEl) {
            state.heatmap.year = parseInt(yEl.dataset.mpYear, 10);
            state.heatmap.selectedDay = null;
            renderBrowse();
            renderCells();
        } else if (mEl) {
            state.heatmap.month = parseInt(mEl.dataset.mpMonth, 10);
            state.heatmap.selectedDay = null;
            renderBrowse();
            renderCells();
        }
    }
    // Re-attach (replace) so we don't accumulate listeners across opens.
    monthsCol.onclick = onPickerClick;
    yearsCol.onclick = onPickerClick;
}
function closeMonthPicker() {
    $('monthPickerModal').classList.remove('open');
}
$('hmLabel').addEventListener('click', openMonthPicker);
$('monthPickerClose').addEventListener('click', closeMonthPicker);
$('monthPickerDone').addEventListener('click', closeMonthPicker);
$('monthPickerModal').addEventListener('click', (e) => { if (e.target.id === 'monthPickerModal') closeMonthPicker(); });

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

$('trendMaWindow').addEventListener('change', (e) => {
    state.trendMaWindow = parseInt(e.target.value, 10) || 6;
    ensureCache().then(all => renderTrend(all));
});

// Restore + listen for the 'Exclude Maintenance' toggle. Persisted in localStorage.
$('trendExcludeMaint').checked = state.trendExcludeMaint;
$('trendExcludeMaint').addEventListener('change', (e) => {
    state.trendExcludeMaint = e.target.checked;
    try { localStorage.setItem('trendExcludeMaint', state.trendExcludeMaint ? '1' : '0'); } catch {}
    ensureCache().then(all => renderTrend(all));
});

// Property view selectors + CSV export
$('propertySelect').addEventListener('change', (e) => {
    state.property.suburb = e.target.value;
    state.property.fyStartYear = null; // force redefault to most recent valid FY
    renderProperty();
});
$('propertyFY').addEventListener('change', (e) => {
    state.property.fyStartYear = parseInt(e.target.value, 10);
    renderProperty();
});
$('propertyExportBtn').addEventListener('click', exportPropertyCSV);

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

// Renewals: add/edit modal + Settings list buttons
$('renewalAddBtn').addEventListener('click', () => openRenewalModal(null));
$('renewalClose').addEventListener('click', closeRenewalModal);
$('renewalSaveBtn').addEventListener('click', saveRenewal);
$('renewalDeleteBtn').addEventListener('click', deleteRenewalFromModal);
$('renewalModal').addEventListener('click', (e) => { if (e.target.id === 'renewalModal') closeRenewalModal(); });

// Loans: add/edit modal
$('loanAddBtn').addEventListener('click', () => openLoanModal(null));
$('loanModalClose').addEventListener('click', closeLoanModal);
$('loanSaveBtn').addEventListener('click', saveLoan);
$('loanDeleteBtn').addEventListener('click', deleteLoanFromModal);
$('loanModal').addEventListener('click', (e) => { if (e.target.id === 'loanModal') closeLoanModal(); });

// keyboard escape closes modal/sheet
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeEditModal(); closeFilterSheet(); closeRenewalModal(); closeMonthPicker(); closeLoanModal(); }
});

/* ====================== INIT ====================== */

(async function init() {
    setupAddDescSuggest();
    resetAddForm();
    await ensureCache();
    refreshAddRecentsAndFavs();
    // One-time seed of default insurance/rates/ESL policies, then refresh the overdue banner + title.
    try {
        await maybeSeedRenewals();
        await refreshOverdueIndicators();
    } catch (e) {
        console.warn('Renewals init failed', e);
    }
})();
