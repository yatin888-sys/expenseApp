import { addExpPageEl, populateCatSelect, getDateWithTimeZero, getDateStringFromDateObj, expCat, tableName, expCatObj, changeSelectionFunc2 } from './globals.js';

import { addRecordToDB, getAllHistDocs } from './myDB.js';

function resetAddExpEls() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    addExpPageEl.dateAddExp.value = getDateStringFromDateObj(today);
    
    addExpPageEl.amountAddExp.value = "";
    addExpPageEl.descAddExp.value = "";
    addExpPageEl.addExpCat.value = "";
    populateCatSelect(addExpPageEl.addExpCat, expCat);
    addExpPageEl.addExpSubCat.value = '';

    addExpPageEl.sendToDBStatus.innerHTML = "";
}

async function sendData() {
    
    let currAddExpCat = '';
    let currAddExpSubCat = '';
    
    if (!addExpPageEl.amountAddExp.value.trim() || !addExpPageEl.descAddExp.value.trim()) {
        addExpPageEl.sendToDBStatus.textContent = 'Please fill in all the fields.';
        return;
    }
    
    try {
        currAddExpCat = addExpPageEl.addExpCat.options[addExpPageEl.addExpCat.selectedIndex].text;
        currAddExpSubCat = addExpPageEl.addExpSubCat.options[addExpPageEl.addExpSubCat.selectedIndex].text;
        if ((currAddExpCat == "Select an Option") || (currAddExpSubCat == "Select an Option")) {
            addExpPageEl.sendToDBStatus.textContent = 'Please select Expense Category & Subcategory.';
            return; 
        }
    } catch (error) {
        addExpPageEl.sendToDBStatus.textContent = 'Please select Expense Category & Subcategory.';
        return;        
    }

    try {
        const data = {
            date: getDateWithTimeZero(addExpPageEl.dateAddExp.value),
            amount: parseFloat(addExpPageEl.amountAddExp.value),
            description: addExpPageEl.descAddExp.value,
            category: currAddExpCat,
            subcategory: currAddExpSubCat
        };
        const id = await addRecordToDB(tableName, data);
        addExpPageEl.sendToDBStatus.textContent = `Document added with ID: ${id}`;
    } catch (error) {
        throw error;
    }
    
    const addDataInpEls = addExpPageEl.addExpPageDiv.querySelectorAll('input');
    addDataInpEls.forEach(function (input) {
        input.value = '';
    });
    addExpPageEl.addExpCat.value = "";
    addExpPageEl.addExpSubCat.value = '';
}

// Move keywordMap to module scope so it can be reused
const keywordMap = [
    { keywords: ["coles", "woolies", "prime products", "supermarket", "joymall", "groceries"], category: "Food & Drinks", subcategory: "Groceries" },
    { keywords: ["laika", "coffee", "grain", "bakery", "cafe"], category: "Food & Drinks", subcategory: "Cafe" },
    { keywords: ["kleenheat", "alinta gas", "atco gas", "aga gas"], category: "Utilities", subcategory: "Gas Bill" },
    { keywords: ["electricity", "power", "synergy"], category: "Utilities", subcategory: "Electricity Bill" },
    { keywords: ["sawater", "water corp", "sa water"], category: "Utilities", subcategory: "Water Bill" },
    { keywords: ["iinet", "internet"], category: "Utilities", subcategory: "Internet Bill" },
    { keywords: ["day care"], category: "Life & Entertainment", subcategory: "Child Support" },
    { keywords: ["salary"], category: "Income", subcategory: "Salary" },
    { keywords: ["rental"], category: "Income", subcategory: "Rental Income" },
    { keywords: ["mortgage"], category: "Housing", subcategory: "Mortgage" },
    { keywords: ["fuel"], category: "Vehicle", subcategory: "Fuel" },
    { keywords: ["parking"], category: "Vehicle", subcategory: "Parking" },
    { keywords: ["tranmere loan", "willetton loan"], category: "Financial Expenses", subcategory: "Interest" },
    { keywords: ["haircut"], category: "Life & Entertainment", subcategory: "Haircut" },
    { keywords: ["smartrider", "transperth", "smart rider"], category: "Transportation", subcategory: "Public Transport" },
    { keywords: ["bupa", "health insurance"], category: "Insurance", subcategory: "Health" },
    { keywords: ["netflix", "disney"], category: "Life & Entertainment", subcategory: "TV" }
];

// Import Tesseract.js for OCR (add this to your HTML or install via npm if using a bundler)

// Batch import function for image files and PDFs
async function handleBatchImportImage() {
    // Create file input dynamically (accept images and pdfs)
    const input = document.createElement('input');
    input.type = 'file';
    // input.accept = '.jpg,.jpeg,.bmp,.png,image/*,application/pdf,.pdf';
    input.click();

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;
        
        // Decide based on file type/extension whether to treat as PDF or image
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

        if (isPdf) {
            // Process PDF file
            addExpPageEl.sendToDBStatus.textContent = 'Processing PDF...';
            try {
                await processPDFFile(file);
            } catch (err) {
                addExpPageEl.sendToDBStatus.textContent = 'Error processing PDF.';
                console.error(err);
            }
        } else {
            // Fallback to image OCR path (existing behavior)
            addExpPageEl.sendToDBStatus.textContent = 'Processing image...';
            try {
                await processImageFile(file);
            } catch (err) {
                addExpPageEl.sendToDBStatus.textContent = 'Error processing image.';
                console.error(err);
            }
        }
    };
}

// Helper: process an image file using existing Tesseract flow
async function processImageFile(file) {
    const { Tesseract } = window; // Assumes Tesseract is loaded globally
    if (!Tesseract || !Tesseract.recognize) {
        throw new Error('Tesseract.js not available in the page.');
    }

    const result = await Tesseract.recognize(file, 'eng');
    const text = result.data.text;
    // expose extracted image OCR text for console debugging
    window.lastExtractedImageText = text;
    const transactions = parseTransactionsFromText(text);

    const existingRecords = await getAllHistDocs(tableName);

    let addedCount = 0;
    for (const tx of transactions) {
        const exists = existingRecords.some(
            rec => rec.amount === tx.amount && getDateStringFromDateObj(new Date(rec.date)) === tx.date
        );
        if (!exists) {
            // Default category/subcategory and keyword mapping
            let cat = 'Food & Drinks';
            let subcat = 'Groceries';
            const descLower = tx.description.toLowerCase();
            for (const entry of keywordMap) {
                if (entry.keywords.some(keyword => descLower.includes(keyword))) {
                    cat = entry.category;
                    subcat = entry.subcategory;
                    break;
                }
            }

            await addRecordToDB(tableName, {
                date: getDateWithTimeZero(tx.date),
                amount: tx.amount,
                description: tx.description,
                category: cat,
                subcategory: subcat
            });
            addedCount++;
        }
    }
    addExpPageEl.sendToDBStatus.textContent = `Batch import complete. ${addedCount} new records added.`;
}

// Helper: dynamically load PDF.js and return pdfjsLib
function loadPdfJs() {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        const script = document.createElement('script');
        // Using a CDN-hosted pdf.js; adjust URL if you prefer a different version or local copy
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
        script.onload = () => {
            try {
                // Set workerSrc to CDN worker
                if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
                    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                }
                resolve(window.pdfjsLib);
            } catch (err) {
                // Even if worker config fails, resolve with library reference
                resolve(window.pdfjsLib);
            }
        };
        script.onerror = (e) => reject(new Error('Failed to load pdf.js: ' + e));
        document.head.appendChild(script);
    });
}

// Helper: process a PDF file, extract text, parse transactions and import
async function processPDFFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfjsLib = await loadPdfJs();
    if (!pdfjsLib || !pdfjsLib.getDocument) throw new Error('pdf.js failed to load');

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        console.log(`Extracted text content for page ${i}:`, content);
        const pageText = content.items.map(item => item.str).join(' ');
        fullText += '\n' + pageText;
    }

    // expose extracted PDF text for console debugging
    window.lastExtractedFullText = fullText;
    console.log('DEBUG fullText length:', (fullText||'').length);
    console.log('DEBUG fullText (excerpt):', (fullText||'').slice(0,800));
    // Reuse OCR text parser to extract transactions
    // Use PDF-specific parser which looks for Date / Particulars / Debits columns
    const transactions = parseBankPdfTransactions(fullText);
    console.log('transactions:', transactions);

    const existingRecords = await getAllHistDocs(tableName);

    let addedCount = 0;
    for (const tx of transactions) {
        const exists = existingRecords.some(
            rec => rec.amount === tx.amount && getDateStringFromDateObj(new Date(rec.date)) === tx.date
        );
        if (!exists) {
            // Default category/subcategory and keyword mapping
            let cat = 'Food & Drinks';
            let subcat = 'Groceries';
            const descLower = tx.description.toLowerCase();
            for (const entry of keywordMap) {
                if (entry.keywords.some(keyword => descLower.includes(keyword))) {
                    cat = entry.category;
                    subcat = entry.subcategory;
                    break;
                }
            }

            await addRecordToDB(tableName, {
                date: getDateWithTimeZero(tx.date),
                amount: tx.amount,
                description: tx.description,
                category: cat,
                subcategory: subcat
            });
            addedCount++;
        }
    }
    addExpPageEl.sendToDBStatus.textContent = `Batch import complete. ${addedCount} new records added.`;
}

// Helper: Parse transactions from OCR text (simple version for attached image format)
function parseTransactionsFromText(text) {
    // Example line: "Grain Bakery WA - $6.80"
    // Example date header: "Friday 08 Aug 2025"
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    let currentDate = null;
    const txs = [];
    const dateRegex = /(\d{2} \w{3} \d{4})/; // e.g. 08 Aug 2025
    const amountRegex = /-?\$([0-9,]+\.\d{2})/;
    for (const line of lines) {
        // Check for date header
        const dateMatch = line.match(dateRegex);
        if (dateMatch) {
            // Convert to yyyy-mm-dd
            const [day, mon, year] = dateMatch[1].split(' ');
            const monthNum = {
                Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
                Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12'
            }[mon];
            currentDate = `${year}-${monthNum}-${day}`;
            continue;
        }
        // Check for transaction line
        const amtMatch = line.match(amountRegex);
        if (amtMatch && currentDate) {
            // Extract description (before amount)
            const desc = line.replace(amountRegex, '').replace(/^-/, '').trim();
            // Only push if "self" is NOT in the description (case-insensitive)
            if (!desc.toLowerCase().includes('self')) {
                txs.push({
                    date: currentDate,
                    amount: parseFloat(amtMatch[1].replace(/,/g, '')),
                    description: desc
                });
            }
        }
    }
    return txs;
}

// PDF-specific parser: looks for a header row containing Date / Particulars / Debits
// and then parses subsequent rows splitting on multi-space gaps. Returns array of
// transactions with { date: 'yyyy-mm-dd', amount: number, description: string }
function parseBankPdfTransactions(text) {
    // Split document into page blocks using common "Page X Of Y" markers if present
    const pageBlocks = text.split(/Page\s+\d+\s+Of\s+\d+/i).map(p => p.replace(/\u00A0/g, ' ').trim()).filter(Boolean);
    const txs = [];
    console.log('pageBlocks[0]:', pageBlocks[0]);

    for (const page of pageBlocks) {
        const lines = page.split('\n').map(l => l.trim()).filter(Boolean);

        // Find header line index where Date, Particulars and Debits/Credits/Balance appear
        let headerIdx = -1;
        for (let i = 0; i < lines.length; i++) {
            const l = lines[i].toLowerCase();
            if (l.includes('date') && l.includes('particulars') && l.includes('debits') && l.includes('credits') && l.includes('balance')) {
                headerIdx = i;
                break;
            }
        }

        if (headerIdx === -1) {
            // fallback to simple parser for this page
            const fallback = parseTransactionsFromText(page);
            txs.push(...fallback);
            continue;
        }

        const headerLine = lines[headerIdx];
        console.log('Header line:', headerLine);
        const h = headerLine.toLowerCase();
        const posDate = h.indexOf('date');
        const posPart = h.indexOf('particulars');
        const posDeb = h.indexOf('debit');
        const posCred = h.indexOf('credit');
        const posBal = h.indexOf('balance');

        // Determine column boundaries (end positions)
        const col1Start = posDate >= 0 ? posDate : 0;
        const col2Start = posPart >= 0 ? posPart : col1Start + 10;
        const col3Start = posDeb >= 0 ? posDeb : (posCred >= 0 ? posCred : col2Start + 30);
        const col4Start = posCred >= 0 ? posCred : (posBal >= 0 ? posBal : col3Start + 12);
        const col5Start = posBal >= 0 ? posBal : col4Start + 12;

        // parse rows after header until footer markers
        for (let i = headerIdx + 1; i < lines.length; i++) {
            const line = lines[i];
            if (/^page \d+ of \d+/i.test(line) || /important/i.test(line) || /account details/i.test(line)) break;

            // If this line starts with a date-like token, parse columns by substring positions
            if (/^(\d{1,2}\s+\w{3}\s+\d{2,4}|\d{2}[\/\-]\d{2}[\/\-]\d{4}|\d{4}-\d{2}-\d{2})/.test(line)) {
                const dateStr = (line.substring(col1Start, col2Start) || '').trim();
                const particulars = (line.substring(col2Start, col3Start) || '').trim();
                const debitField = (line.substring(col3Start, col4Start) || '').trim();
                const creditField = (line.substring(col4Start, col5Start) || '').trim();

                console.log('Parsed line:', { dateStr, particulars, debitField, creditField });

                // extract $ amounts from debit or credit fields
                const debitMatch = debitField.match(/\$\s*([0-9,]+\.\d{2})/);
                const creditMatch = creditField.match(/\$\s*([0-9,]+\.\d{2})/);

                let amount = null;
                let type = null;
                if (debitMatch) {
                    amount = parseFloat(debitMatch[1].replace(/,/g, ''));
                    type = 'debit';
                } else if (creditMatch) {
                    amount = parseFloat(creditMatch[1].replace(/,/g, ''));
                    type = 'credit';
                }

                if (amount !== null && !isNaN(amount) && amount !== 0) {
                    const normalized = normalizeDateString(dateStr);
                    if (normalized) {
                        txs.push({ date: normalized, amount: amount, description: particulars, type });
                    }
                }
            }
        }
    }

    return txs;
}

// Normalize various date formats to yyyy-mm-dd. Returns null if unparseable.
function normalizeDateString(s) {
    s = s.trim();
    // dd/mm/yyyy or dd-mm-yyyy
    let m = s.match(/^(\d{2})[\/\-](\d{2})[\/\-](\d{4})$/);
    if (m) {
        const [_, dd, mm, yyyy] = m;
        return `${yyyy}-${mm}-${dd}`;
    }
    // dd Mon yyyy (08 Aug 2025)
    m = s.match(/^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})/i);
    if (m) {
        const dd = m[1].padStart(2, '0');
        const mon = m[2].substr(0,3);
        const mmMap = {Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
        const mm = mmMap[mon.charAt(0).toUpperCase() + mon.slice(1).toLowerCase()];
        let year = m[3];
        if (year.length === 2) {
            // assume 2000s
            year = '20' + year;
        }
        return `${year}-${mm}-${dd}`;
    }
    // yyyy-mm-dd
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return s;

    // Last resort: try Date.parse
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
    return null;
}

function autoSelectCategorySubCat(descValue) {
    const desc = descValue.toLowerCase();

    for (const entry of keywordMap) {
        if (entry.keywords.some(keyword => desc.includes(keyword))) {
            changeSelectionFunc2(addExpPageEl.addExpCat, entry.category);
            populateCatSelect(addExpPageEl.addExpSubCat, expCatObj[entry.category]);
            changeSelectionFunc2(addExpPageEl.addExpSubCat, entry.subcategory);
            break; // Stop after first match
        }
    }
}

// Attach event listener after DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    if (addExpPageEl.descAddExp) {
        addExpPageEl.descAddExp.addEventListener('input', (e) => {
            autoSelectCategorySubCat(e.target.value);
        });
    } else {
        console.log("descAddExp element not found");
    }

    // Attach event listener to batch import button
    if (addExpPageEl.batchSubmitBtn) {
        addExpPageEl.batchSubmitBtn.addEventListener('click', handleBatchImportImage);
    }
});




export { resetAddExpEls, sendData }







