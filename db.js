// IndexedDB wrapper – preserves backwards compatibility with existing 'expenses' store
// and adds 'budgets' and 'favorites' stores in version 2.

const DB_NAME = 'ExpensesDB';
const DB_VERSION = 2;

export const STORE_EXPENSES  = 'expenses';
export const STORE_BUDGETS   = 'budgets';
export const STORE_FAVORITES = 'favorites';

let _dbPromise = null;

export function openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = (event) => {
            const db = event.target.result;
            // v1 - expenses store (preserve existing schema exactly)
            if (!db.objectStoreNames.contains(STORE_EXPENSES)) {
                const store = db.createObjectStore(STORE_EXPENSES, { keyPath: 'id', autoIncrement: true });
                store.createIndex('date', 'date', { unique: false });
                store.createIndex('amount', 'amount', { unique: false });
                store.createIndex('description', 'description', { unique: false });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('subcategory', 'subcategory', { unique: false });
            }
            // v2 - budgets keyed by category
            if (!db.objectStoreNames.contains(STORE_BUDGETS)) {
                db.createObjectStore(STORE_BUDGETS, { keyPath: 'category' });
            }
            // v2 - favorites with auto id
            if (!db.objectStoreNames.contains(STORE_FAVORITES)) {
                const favStore = db.createObjectStore(STORE_FAVORITES, { keyPath: 'id', autoIncrement: true });
                favStore.createIndex('description', 'description', { unique: false });
            }
        };
        req.onsuccess = (event) => resolve(event.target.result);
        req.onerror = (event) => reject(event.target.error);
    });
    return _dbPromise;
}

function tx(storeName, mode = 'readonly') {
    return openDB().then(db => db.transaction([storeName], mode).objectStore(storeName));
}

function reqToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

/* ======================= Expenses ======================= */

export async function addExpense(record) {
    const store = await tx(STORE_EXPENSES, 'readwrite');
    return reqToPromise(store.add(record));
}

export async function updateExpense(id, newValues) {
    const store = await tx(STORE_EXPENSES, 'readwrite');
    const existing = await reqToPromise(store.get(id));
    if (!existing) throw new Error(`Expense ${id} not found`);
    Object.assign(existing, newValues);
    existing.id = id;
    return reqToPromise(store.put(existing));
}

export async function deleteExpense(id) {
    const store = await tx(STORE_EXPENSES, 'readwrite');
    return reqToPromise(store.delete(id));
}

export async function getAllExpenses() {
    const store = await tx(STORE_EXPENSES, 'readonly');
    return reqToPromise(store.getAll());
}

export async function getExpensesInRange(startDateObj, endDateObj) {
    const store = await tx(STORE_EXPENSES, 'readonly');
    const idx = store.index('date');
    const range = IDBKeyRange.bound(startDateObj, endDateObj);
    return new Promise((resolve, reject) => {
        const req = idx.openCursor(range);
        const out = [];
        req.onsuccess = (e) => {
            const cur = e.target.result;
            if (cur) { out.push(cur.value); cur.continue(); }
            else resolve(out);
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

export async function importAllExpenses(records) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const t = db.transaction([STORE_EXPENSES], 'readwrite');
        const store = t.objectStore(STORE_EXPENSES);
        store.clear().onsuccess = () => {
            // Sort ascending by date for nicer ordering
            const sorted = [...records].sort((a, b) => new Date(a.date) - new Date(b.date));
            sorted.forEach(rec => {
                const copy = { ...rec };
                delete copy.id; // re-issue ids
                if (typeof copy.date === 'string') {
                    copy.date = parseDateString(copy.date);
                }
                store.add(copy);
            });
        };
        t.oncomplete = () => resolve();
        t.onerror = (e) => reject(e.target.error);
    });
}

/* ======================= Budgets ======================= */

export async function setBudget(category, monthlyAmount) {
    const store = await tx(STORE_BUDGETS, 'readwrite');
    return reqToPromise(store.put({ category, monthly: parseFloat(monthlyAmount) || 0 }));
}

export async function getBudget(category) {
    const store = await tx(STORE_BUDGETS, 'readonly');
    return reqToPromise(store.get(category));
}

export async function getAllBudgets() {
    const store = await tx(STORE_BUDGETS, 'readonly');
    return reqToPromise(store.getAll());
}

export async function deleteBudget(category) {
    const store = await tx(STORE_BUDGETS, 'readwrite');
    return reqToPromise(store.delete(category));
}

/* ======================= Favorites ======================= */

export async function addFavorite(fav) {
    const store = await tx(STORE_FAVORITES, 'readwrite');
    return reqToPromise(store.add(fav));
}

export async function getAllFavorites() {
    const store = await tx(STORE_FAVORITES, 'readonly');
    return reqToPromise(store.getAll());
}

export async function deleteFavorite(id) {
    const store = await tx(STORE_FAVORITES, 'readwrite');
    return reqToPromise(store.delete(id));
}

/* ======================= Helpers ======================= */

export function parseDateString(s) {
    // Accepts yyyy-mm-dd
    if (s instanceof Date) return s;
    const [y, m, d] = String(s).split('-').map(Number);
    const dt = new Date(y, (m || 1) - 1, d || 1);
    dt.setHours(0, 0, 0, 0);
    return dt;
}

export function dateToISO(d) {
    if (!(d instanceof Date)) d = new Date(d);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}
