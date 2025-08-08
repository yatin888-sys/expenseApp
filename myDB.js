import { tableName, getDateStringFromDateObj, getDateWithTimeZero } from './globals.js';

const dbName = 'ExpensesDB';
const dbVersion = 1;


async function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(tableName)) {
                const objectStore = db.createObjectStore(tableName, { keyPath: 'id', autoIncrement: true });
                objectStore.createIndex('date', 'date', { unique: false });
                objectStore.createIndex('amount', 'amount', { unique: false });
                objectStore.createIndex('description', 'description', { unique: false });
                objectStore.createIndex('category', 'category', { unique: false });
                objectStore.createIndex('subcategory', 'subcategory', { unique: false });
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function addRecordToDB(tblName, data) {
    const db = await openDatabase();
    const transaction = db.transaction([tblName], 'readwrite');
    const objectStore = transaction.objectStore(tblName);

    return new Promise((resolve, reject) => {
        const request = objectStore.add(data);

        request.onsuccess = (event) => {
            console.log(`Record added with ID: ${event.target.result}`);
            resolve(event.target.result); // Resolve the promise with the record ID
        };

        request.onerror = (event) => {
            console.error(`Error adding record: ${event.target.error}`);
            reject(event.target.error);
        };
    });
}

async function getRecordsWhereDateIs(tblName, dateLookupObj) {
    const db = await openDatabase();
    const transaction = db.transaction([tblName], 'readonly');
    const objectStore = transaction.objectStore(tblName);
    const index = objectStore.index('date');
    
    return new Promise((resolve, reject) => {
        const request = index.getAll(dateLookupObj);

        request.onsuccess = (event) => {
            resolve(event.target.result); // Resolve the promise with the array of records
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function getRecordsWhereDateRangeAndCategory(tblName, startdtObj, enddtObj, category = null) {
    const db = await openDatabase();
    const transaction = db.transaction([tblName], 'readonly');
    const objectStore = transaction.objectStore(tblName);
    const index = objectStore.index('date');

    return new Promise((resolve, reject) => {
        const range = IDBKeyRange.bound(startdtObj, enddtObj);
        const request = index.openCursor(range);
        const results = [];

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if (category === null || cursor.value.category === category) {
                    results.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(results);
            }
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function getRecordsWhereDateRangeCategoryAndSubCategory(tblName, startdtObj, enddtObj, category, subcategory) {
    const db = await openDatabase();
    const transaction = db.transaction([tblName], 'readonly');
    const objectStore = transaction.objectStore(tblName);
    const index = objectStore.index('date');

    return new Promise((resolve, reject) => {
        const range = IDBKeyRange.bound(startdtObj, enddtObj);
        const request = index.openCursor(range);
        const results = [];

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                if ((cursor.value.category === category) && (cursor.value.subcategory === subcategory)) {
                    results.push(cursor.value);
                }
                cursor.continue();
            } else {
                resolve(results);
            }
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function updateRecord(tblName, docId, newValueObj) {
    const db = await openDatabase();
    const transaction = db.transaction([tblName], 'readwrite');

    const objectStore = transaction.objectStore(tblName);

    return new Promise((resolve, reject) => {
        const request = objectStore.get(docId);

        request.onsuccess = (event) => {
            const data = event.target.result;
            if (data) {
                Object.assign(data, newValueObj);
                const updateRequest = objectStore.put(data);
                updateRequest.onsuccess = () => {
                    resolve();
                };
                updateRequest.onerror = (error) => {
                    reject(error);
                };
            } else {
                reject(new Error('Document not found'));
            }
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };

    });
}

async function getAllHistDocs(tblName) {
    const db = await openDatabase();
    const transaction = db.transaction([tblName], 'readonly');
    const objectStore = transaction.objectStore(tblName);

    return new Promise((resolve, reject) => {
        const request = objectStore.getAll();
        request.onsuccess = (event) => {
            resolve(event.target.result); // Resolve the promise with the array of records
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

async function importToIndexedDB(expenses) {
    const db = await openDatabase();
    const transaction = db.transaction([tableName], 'readwrite');
    const objectStore = transaction.objectStore(tableName);
    let id = 0;

    // Clear the object store
    const clearRequest = objectStore.clear();
    clearRequest.onsuccess = () => {
        console.log('Cleared existing data');
        // Add new data
        expenses.forEach(expense => {
            id = id + 1;
            let dateObj = getDateWithTimeZero(expense.date);
            expense.date = dateObj;
            expense.id = id;
            objectStore.add(expense);
        });
    };
    clearRequest.onerror = (event) => {
        console.error('Error clearing data:', event.target.error);
    };

    transaction.oncomplete = () => {
        console.log('All data imported successfully');
    };

    transaction.onerror = (event) => {
        console.error('Transaction error:', event.target.error);
    };
}

async function exportFromIndexedDB() {
    const db = await openDatabase();
    const transaction = db.transaction([tableName], 'readonly');
    const objectStore = transaction.objectStore(tableName);

    return new Promise((resolve, reject) => {
        const request = objectStore.getAll();

        request.onsuccess = (event) => {
            const data = event.target.result;
            // Format the date properties
            const formattedData = data.map(record => {
                if (record.date instanceof Date) {
                    record.date = getDateStringFromDateObj(record.date);
                }
                return record;
            });
            resolve(formattedData); // Resolve the promise with the array of formatted records
        };

        request.onerror = (event) => {
            reject(event.target.error);
        };
    });
}

export { addRecordToDB, getRecordsWhereDateIs, getRecordsWhereDateRangeAndCategory, getRecordsWhereDateRangeCategoryAndSubCategory, updateRecord, getAllHistDocs, importToIndexedDB, exportFromIndexedDB }