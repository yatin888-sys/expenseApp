
export const footerEl = {
    addExpIcon: document.getElementById('addExpIcon'),
    modExpIcon: document.getElementById('modExpIcon'),
    sumExpIcon: document.getElementById('sumExpIcon'),
    pages: document.querySelectorAll('.page'),
    icons: document.querySelectorAll('.footer img'),
    pageId: 'addExpPage'
};

export const addExpPageEl = {
    dateAddExp: document.getElementById('dateAddExp'),
    amountAddExp: document.getElementById("amount"),
    descAddExp: document.getElementById("description"),
    addExpCat: document.getElementById("addExpCat"),
    addExpSubCat: document.getElementById("addExpSubCat"),
    submitBtnAddExp: document.getElementById("submitBtn"),
    sendToDBStatus: document.getElementById("sendToDBStatus"),
    addExpPageDiv: document.getElementById('addExpPage'),
    importBtn: document.getElementById("importBtn"),
    exportBtn: document.getElementById("exportBtn")
};

export const modExpPageEl = {
    pageParentDiv: document.getElementById('modExpPage'),
    dateInput: document.getElementById('dateModExp'),
    durationSelect: document.getElementById('dateTypeModExp'),
    modExpTbl: document.getElementById('modExpTbl'),
    paginationContainer: document.getElementById('pagination')
};

export const modExpFrmPageEl = {
    pageParentDiv: document.getElementById('modExpFrmPage'),
    dateInput: document.getElementById('dateModExpFrm'),
    amountInput: document.getElementById('amountModExpFrm'),
    descInput: document.getElementById('descModExpFrm'),
    catSelect: document.getElementById('catModExpFrm'),
    subCatSelect: document.getElementById('subCatModExpFrm'),
    filterButton: document.getElementById('fltrBtnSubCatModExpFrm'),
    docIDPara: document.getElementById("docIDModExpFrm"),
    updateButton: document.getElementById('updateBtnModExpFrm'),
    updateDBStatus: document.getElementById("updateDBStatus"),
    goToModExpPageBtn: document.getElementById('goToModExpPage')
};

export const touchdata = {
    touchStartX: null,
    touchStartY: null,
    touchStartTime: null
};

export const sumExpPageEl = {
    sumExpPage: document.getElementById('sumExpPage'),
    expSummryDuration: document.getElementById('expSummryDuration'),
    canvasForCatChart: document.getElementById("canvasForCatChart"),
    categoryExpTable: document.getElementById('categoryExpTable'),
    canvasForSubCatChart: document.getElementById("canvasForSubCatChart"),
    subCategoryExpTable: document.getElementById('subCategoryExpTable'),
    tableSavings: document.getElementById('SavingsTbl'),
    salarySectionDiv: document.getElementById('divForSalarySection')
};

export const trendsExpPageEl = {
    trendsExpPage: document.getElementById('trendsExpPage'),
    divTrendsChart: document.getElementById('chartTrends'),
    canvasForTrendsChart: document.getElementById("canvasForTrendsChart"),
    forcastedExpDiv: document.getElementById("forcastedExpDiv"),
    goToSumExpPageBtn: document.getElementById('goToSumExpPage')
};

export const expCatObj = {
    'Food & Drinks': ['Groceries', 'Restaurant', 'Cafe'],
    'Shopping': ['Electronics', 'Clothes', 'Shoes', 'Stationary', 'Tools', 'Appliances'],
    'Housing': ['Rent', 'Mortgage', 'Council Rates', 'ESL', 'Maintenance'],
    'Utilities': ['Electricity Bill', 'Gas Bill', 'Water Bill', 'Phone Bill', 'Internet Bill', 'Services'],
    'Insurance': ['Home', 'Car', 'Health'],
    'Transportation': ['Public Transport', 'Taxi', 'Flight', 'Visa'],
    'Vehicle': ['Fuel', 'Parking', 'Vehicle Maintenance', 'Rentals', 'Registration'],
    'Life & Entertainment': ['Child Support', 'Haircut', 'Grooming', 'Hobbies', 'Party', 'Education', 'Family', 'Books', 'TV', 'Movies', 'Holidays', 'Hotel', 'Charity, Gifts', 'Alcohol', 'Life Events', 'Postal Services'],
    'Health': ['GP', 'Medicines', 'Hospital', 'Dentist', 'Fitness'],
    'Financial Expenses': ['Tax', 'Interest', 'Fines', 'Advisory', 'Fees, Charges'],
    'Investments': ['Savings', 'Collections'],
    'Income': ['Salary', 'Rental Income', 'Interest, Dividents', 'Sale', 'Grants', 'Refunds', 'Coupons'],
    'Others': ['Missing']
}

export const expCat = Object.keys(expCatObj);

export const tableName = 'expenses';

export const dateToday = new Date();
dateToday.setHours(0, 0, 0, 0);
export const yearToday = dateToday.getFullYear();
export const monthToday = String(dateToday.getMonth() + 1).padStart(2, '0'); // Adding 1 because months are zero-indexed
export const dayToday = String(dateToday.getDate()).padStart(2, '0');


/**
 * populate select element with the items in the options array
 * @param {HTMLSelectElement} selectElement 
 * @param {Array} options 
 */
export function populateCatSelect (selectElement, options) {
    selectElement.innerHTML = '';

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.text = "Select an Option";
    defaultOption.disabled = true;
    defaultOption.selected = true;
    selectElement.appendChild(defaultOption);

    options.forEach((option) => {
        const optionElement = document.createElement("option");
        let sanitizedOptionValue = option.replace(/\s/g, '');
        optionElement.value = sanitizedOptionValue.toLowerCase();
        optionElement.text = option;
        selectElement.appendChild(optionElement);
    });
}

/**
 * Changes the selectElement selection to the required selection.
 * @param {HTMLSelectElement} selectElement as HTML element
 * @param {string} reqSelection as string
 */
export function changeSelectionFunc2(selectElement, reqSelection) {
    let matchingOptionCat = Array.from(selectElement.options).find(
        (option) => option.text === reqSelection
    );
    if (matchingOptionCat) {
        matchingOptionCat.selected = true;
    }
}

export async function trgChngEventForEl(element) { 
    const event = new Event('change', { bubbles: true});
    await element.dispatchEvent(event);
}

export function isISODate(str) {
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
    return isoDateRegex.test(str);
}

export function isValidDate(str) {
    const dateObject = new Date(str);
    return !isNaN(dateObject.getTime());
}

/**
 * Switches page
 * @param {*} pgToBeActive 
 * @param {*} pgToBeInactive 
 */
export function switchPageTo(pgToBeActive, pgToBeInactive) {
    pgToBeActive.classList.remove('inactive-page');
    pgToBeActive.classList.add('active-page');

    pgToBeInactive.classList.remove('active-page');
    pgToBeInactive.classList.add('inactive-page');
}

/**
 * Determines the date range based on the selected summary duration.
 * @param {string} selectedRange 
 * @returns {object} An object containing the start and end dates with keys - startDate & endDate
 */
export function setDateRangeForSmmry(selectedRange) {
    let startDate, endDate;
    const monthTodayInt = parseInt(monthToday);
    const dayTodayInt = parseInt(dayToday);
    switch (selectedRange) {
        case 'This Month':
            startDate = new Date(yearToday, monthTodayInt - 1, 1); // Start of the current month
            endDate = new Date(yearToday, monthTodayInt, 0); // End of the current month
            break;
        case 'Previous Month':
            startDate = new Date(yearToday, monthTodayInt - 2, 1); // Start of the previous month
            endDate = new Date(yearToday, monthTodayInt - 1, 0); // End of the previous month
            break;
        case 'This Quarter':
            ({ startDate, endDate } = getQuarterDates()); 
            break;
        case 'This Year':
            if (monthTodayInt <= 6) {
                startDate = new Date((yearToday - 1), 6, 1); // Financial year started previous year
            } else {
                startDate = new Date(yearToday, 6, 1); // Financial year started this year
            }
            endDate = new Date(yearToday, (monthTodayInt - 1), dayTodayInt);       
            break;
        case 'Previous Year':
            if (monthTodayInt <= 6) {
                startDate = new Date((yearToday - 2), 6, 1); // Financial year started previous year
                endDate = new Date((yearToday - 1), 5, 30);
            } else {
                startDate = new Date((yearToday - 1), 6, 1); // Financial year started this year
                endDate = new Date(yearToday, 5, 30);
            }   
            break;
        case 'Previous to Last Year':
            if (monthTodayInt <= 6) {
                startDate = new Date((yearToday - 3), 6, 1); // Financial year started previous year
                endDate = new Date((yearToday - 2), 5, 30);
            } else {
                startDate = new Date((yearToday - 2), 6, 1); // Financial year started this year
                endDate = new Date((yearToday - 1), 5, 30);
            }   
            break;
        default:
            console.warn('Unexpected selected range:', selectedRange);
            startDate = null;
            endDate = null;
            break;
    }
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);
    return { startDate, endDate };
}

export function getQuarterDates() {
    const today = new Date();
    const currentMonth = today.getMonth() + 1; // Months are 0-indexed, so we add 1

    let startDate, endDate;

    switch (Math.ceil(currentMonth / 3)) {
        case 1: // Quarter 1 (January - March)
            startDate = new Date(today.getFullYear(), 0, 1);
            endDate = new Date(today.getFullYear(), 2, 31);
            break;

        case 2: // Quarter 2 (April - June)
            startDate = new Date(today.getFullYear(), 3, 1);
            endDate = new Date(today.getFullYear(), 5, 30); // Adjust as needed
            break;

        case 3: // Quarter 3 (July - September)
            startDate = new Date(today.getFullYear(), 6, 1);
            endDate = new Date(today.getFullYear(), 8, 30); // Adjust as needed
            break;

        case 4: // Quarter 4 (October - December)
            startDate = new Date(today.getFullYear(), 9, 1);
            endDate = new Date(today.getFullYear(), 11, 31);
            break;

        default:
            break;
    }

    return { startDate, endDate };
}

export function boldLastRow(tblV) {
    const lstRw = tblV.querySelector('tbody tr:last-child');
    if (lstRw) {
        lstRw.querySelectorAll('td').forEach(cell => {
            const strongEl = document.createElement('strong');
            strongEl.textContent = cell.textContent;
            strongEl.style.color = 'black';
            cell.innerHTML = '';
            cell.appendChild(strongEl);
        });
    }

    const evenRows = tblV.querySelectorAll('tbody tr:nth-child(even)');

    evenRows.forEach(row => {
        row.style.backgroundColor = '#0000000b';
    });

}

/**
 * This function populates subCatSel based on selection of catSel using id attributes
 * @param {HTMLSelectElement} catSelElm is the category element
 * @param {HTMLSelectElement} subCatSelElm is the subcategory element
 */
export function poplSubCat(catSelElm, subCatSelElm) {
    const selectedExpCat = catSelElm.options[catSelElm.selectedIndex].text;
    populateCatSelect(subCatSelElm, expCatObj[selectedExpCat]);
}

/**
 * returns date object with time reset to 0
 * @param {*} dateString is string for the date in yyyy-mm-dd format
 * @returns 
 */
export function getDateWithTimeZero(dateString) {
    let yr = parseInt(dateString.split('-')[0]);
    let mth = parseInt(dateString.split('-')[1]) - 1;
    let dt = parseInt(dateString.split('-')[2]);
    let dtObj = new Date(yr, mth, dt);
    dtObj.setHours(0, 0, 0, 0);
    return dtObj;
}

/**
 * returns date in string yyyy-mm-dd format
 * @param {*} dtObj is date object variable
 */
export function getDateStringFromDateObj(dtObj) {
    let yrV = dtObj.getFullYear();
    let mthV = String(dtObj.getMonth() + 1).padStart(2, '0');
    let dtV = String(dtObj.getDate()).padStart(2, '0');

    let dateStringToReturn = yrV + '-' + mthV + '-' + dtV;
    return dateStringToReturn;
}

/**
 * Increases the date if required to the next work day and returns as string
 * @param {*} dateString is date in string format of yyyy-mm-dd
 * @returns 
 */
export function getNextWeekday(dateString) {
    let dtObj = getDateWithTimeZero(dateString);

    let dayOfWeek = dtObj.getDay();

    if (dayOfWeek === 0) {
        dtObj.setDate(dtObj.getDate() + 1);
    } else if (dayOfWeek === 6) {
        dtObj.setDate(dtObj.getDate() + 2);
    }

    let dateToReturn = getDateStringFromDateObj(dtObj);
    return dateToReturn;
}


/**
 * Decreases the date if required to the previous work day and returns as string
 * @param {*} dateString is date in string format of yyyy-mm-dd
 * @returns 
 */
export function getPreviousWeekday(dateString) {
    let dtObj = getDateWithTimeZero(dateString);

    let dayOfWeek = dtObj.getDay();

    if (dayOfWeek === 0) {
        dtObj.setDate(dtObj.getDate() - 2);
    } else if (dayOfWeek === 6) {
        dtObj.setDate(dtObj.getDate() - 1);
    }

    let dateToReturn = getDateStringFromDateObj(dtObj);
    return dateToReturn;
}

/**
 * Returns interval in days between two date strings
 * @param {*} date1String is date in string in yyyy-mm-dd format
 * @param {*} date2String is date in string in yyyy-mm-dd format
 * @returns 
 */
export function getIntervalInDays(date1String, date2String) {
    let dtObj1 = getDateWithTimeZero(date1String);
    let dtObj2 = getDateWithTimeZero(date2String);

    let intervalMilliSeconds = Math.abs(dtObj1.getTime() - dtObj2.getTime());
    let interval = intervalMilliSeconds / (1000 * 60 * 60 * 24);
    return parseInt(interval);
}

/**
 * Adds days to the supplied date and returns new date string
 * @param {string} dateString is date in yyyy-mm-dd string format
 * @param {interger} numOfDays is number of days to add in integer
 * @returns date (after adding days) in string format.
 */
export function addDaysToDate(dateString, numOfDays) {
    let dtObj = getDateWithTimeZero(dateString);

    dtObj.setDate(dtObj.getDate() + parseInt(numOfDays));

    let dateToReturn = getDateStringFromDateObj(dtObj);
    return dateToReturn;
}

/**
 * Adds months to the supplied date and returns new date string
 * @param {string} dateString is date in yyyy-mm-dd string format
 * @param {integer} numOfDays is number of months to add in integer
 * @returns date (after adding months) in string format.
 */
export function addMonthsToDate(dateString, numOfMonths) {
    let dtObj = getDateWithTimeZero(dateString);

    dtObj.setMonth(dtObj.getMonth() + parseInt(numOfMonths));

    let dateToReturn = getDateStringFromDateObj(dtObj);
    return dateToReturn;
}


/**
 * Creates and returns a table header element and appends all the headers array elements.
 * @param {Array} headers – All the headers in an array
 * @returns HTML Table Head (thead) element
 */
export function createTableHeader(headers) {
    const theadEl = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach((value) => {
        const thElement = document.createElement('th');
        thElement.textContent = value;
        headerRow.appendChild(thElement);
    });
    theadEl.appendChild(headerRow);
    return theadEl;
}

/**
 * Appends rows to an existing table body element.
 * @param {HTMLTableSectionElement} tbody - The tbody element to append rows to.
 * @param {Array<object>} dataArray - The data to populate the rows, should be an array of objects.
 * @param {Array<String>} [columns] - The keys from the data objects to be used as columns.
 * If not provided, all keys from the first object in dataArray will be used which can mess the order of the columns.
 * @throws {Error} Throws an error if tbody is not a valid HTMLTableSectionElement or dataArray is not an array.
 */
export function appendRowsToTable(tbody, dataArray, columns = null) {
    if (!(tbody instanceof HTMLTableSectionElement)) {
        throw new Error('Invalid tbody element');
    }

    if (!Array.isArray(dataArray)) {
        throw new Error('dataArray must be an array');
    }

    if (dataArray.length === 0) {
        console.warn('dataArray is empty, no rows to append');
        return;
    }

    // Use all keys from the first object in dataArray if columns are not provided
    if (!columns) {
        columns = Object.keys(dataArray[0]);
    }

    dataArray.forEach(data => {
        const row = document.createElement('tr');
        columns.forEach(column => {
            const cell = document.createElement('td');
            cell.textContent = data[column] !== undefined ? data[column] : '';
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

/**
 * Deletes all the rows inside the table and deletes table header and table body elements
 * @param {HTMLTableSectionElement} table 
 */
export function clearTable(table) {
    while (table.rows.length > 0) {
        table.deleteRow(0);
    }

    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');

    if (thead) {
        table.removeChild(thead);
    }

    if (tbody) {
        table.removeChild(tbody);
    }
}
