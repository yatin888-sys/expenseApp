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

// Batch import function for image files
async function handleBatchImportImage() {
    // Create file input dynamically
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jpg,.jpeg,.bmp,.png,image/*';
    input.click();

    input.onchange = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Use Tesseract.js to extract text from image
        addExpPageEl.sendToDBStatus.textContent = 'Processing image...';
        const { Tesseract } = window; // Assumes Tesseract is loaded globally

        try {
            const result = await Tesseract.recognize(file, 'eng');
            const text = result.data.text;
            // Parse transactions from OCR text
            const transactions = parseTransactionsFromText(text);

            // Get all existing records from DB
            const existingRecords = await getAllHistDocs(tableName);

            let addedCount = 0;
            for (const tx of transactions) {
                // Check if record with same date and amount exists
                const exists = existingRecords.some(
                    rec =>
                        rec.amount === tx.amount &&
                        getDateStringFromDateObj(new Date(rec.date)) === tx.date
                );
                if (!exists) {
                    
                    // Determine category/subcategory using keywordMap
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
                    // Add to DB
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
        } catch (err) {
            addExpPageEl.sendToDBStatus.textContent = 'Error processing image.';
            console.error(err);
        }
    };
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