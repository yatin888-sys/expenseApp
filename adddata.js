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
    if (desc.includes("coles") || desc.includes("woolies") || desc.includes("prime products") || desc.includes("supermarket") || desc.includes("joymall") || desc.includes("groceries")) {
        // Select "Food & Drinks" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Food & Drinks");
        // Populate subcategories for "Food & Drinks"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Food & Drinks"]);
        // Select "Groceries" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Groceries");
    } else if (desc.includes("laika") || desc.includes("coffee") || desc.includes("grain") || desc.includes("bakery") || desc.includes("cafe")) {
        // Select "Food & Drinks" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Food & Drinks");
        // Populate subcategories for "Food & Drinks"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Food & Drinks"]);
        // Select "Coffee" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Cafe");
    } else if (desc.includes("kleenheat" || desc.includes("alinta gas") || desc.includes("atco gas") || desc.includes("aga gas"))) {
        // Select "Utilities" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Utilities");
        // Populate subcategories for "Utilities"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Utilities"]);
        // Select "Gas Bill" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Gas Bill");
    } else if (desc.includes("electricity") || desc.includes("power") || desc.includes("synergy")) {
        // Select "Utilities" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Utilities");
        // Populate subcategories for "Utilities"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Utilities"]);
        // Select "Electricity Bill" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Electricity Bill");
    } else if (desc.includes("sawater") || desc.includes("water corp") || desc.includes("sa water")) {
        // Select "Utilities" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Utilities");
        // Populate subcategories for "Utilities"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Utilities"]);
        // Select "Water Bill" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Water Bill");
    } else if (desc.includes("iinet") || desc.includes("internet")) {
        // Select "Utilities" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Utilities");
        // Populate subcategories for "Utilities"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Utilities"]);
        // Select "Internet Bill" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Internet Bill");
    } else if (desc.includes("day care")) {
        // Select "Childcare" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Life & Entertainment");
        // Populate subcategories for "Child Support"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Life & Entertainment"]);
        // Select "Day Care" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Child Support");
    } else if (desc.includes("salary")) {
        // Select "Income" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Income");
        // Populate subcategories for "Income"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Income"]);
        // Select "Salary" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Salary");
    } else if (desc.includes("rental")) {
        // Select "Income" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Income");
        // Populate subcategories for "Income"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Income"]);
        // Select "Rental Income" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Rental Income");
    } else if (desc.includes("mortgage")) {
        // Select "Housing" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Housing");
        // Populate subcategories for "Housing"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Housing"]);
        // Select "Mortgage" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Mortgage");
    } else if (desc.includes("fuel")) {
        // Select "Vehicle" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Vehicle");
        // Populate subcategories for "Vehicle"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Vehicle"]);
        // Select "Fuel" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Fuel");
    } else if (desc.includes("parking")) {
        // Select "Vehicle" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Vehicle");
        // Populate subcategories for "Vehicle"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Vehicle"]);
        // Select "Parking" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Parking");
    } else if (desc.includes("tranmere loan") || desc.includes("willetton loan")) {
        // Select "Financial Expenses" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Financial Expenses");
        // Populate subcategories for "Financial Expenses"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Financial Expenses"]);
        // Select "Interest" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Interest");
    } else if (desc.includes("haircut")) {
        // Select "Life & Entertainment" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Life & Entertainment");
        // Populate subcategories for "Life & Entertainment"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Life & Entertainment"]);
        // Select "Haircut" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Haircut");
    } else if (desc.includes("smartrider") || desc.includes("transperth") || desc.includes("smart rider")) {
        // Select "Transportation" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Transportation");
        // Populate subcategories for "Transportation"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Transportation"]);
        // Select "Public Transport" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Public Transport");
    } else if (desc.includes("bupa") || desc.includes("health insurance")) {
        // Select "Insurance" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Insurance");
        // Populate subcategories for "Insurance"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Insurance"]);
        // Select "Health" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "Health");
    } else if (desc.includes("netflix") || desc.includes("disney")) {
        // Select "Life & Entertainment" for category
        changeSelectionFunc2(addExpPageEl.addExpCat, "Life & Entertainment");
        // Populate subcategories for "Life & Entertainment"
        populateCatSelect(addExpPageEl.addExpSubCat, expCatObj["Life & Entertainment"]);
        // Select "TV" for sub-category
        changeSelectionFunc2(addExpPageEl.addExpSubCat, "TV");
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