import { addExpPageEl, populateCatSelect, getDateWithTimeZero, getDateStringFromDateObj, expCat, tableName, expCatObj, changeSelectionFunc2 } from './globals.js';

import { addRecordToDB } from './myDB.js';

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

function autoSelectCategorySubCat(descValue) {
    const desc = descValue.toLowerCase();

    // Mapping array for keywords to category/subcategory
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

    for (const entry of keywordMap) {
        if (entry.keywords.some(keyword => desc.includes(keyword))) {
            changeSelectionFunc2(addExpPageEl.addExpCat, entry.category);
            populateCatSelect(addExpPageEl.addExpSubCat, expCatObj[entry.category]);
            changeSelectionFunc2(addExpPageEl.addExpSubCat, entry.subcategory);
            break;
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
});

export { resetAddExpEls, sendData }