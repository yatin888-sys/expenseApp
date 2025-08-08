"use strict";

import { modExpPageEl, modExpFrmPageEl, changeSelectionFunc2, switchPageTo, populateCatSelect, isISODate, isValidDate, getDateWithTimeZero, addDaysToDate, addMonthsToDate, getDateStringFromDateObj, expCat, expCatObj, tableName } from './globals.js';
import { getRecordsWhereDateIs, getRecordsWhereDateRangeAndCategory, updateRecord } from './myDB.js';

/**
 * Reset the date in Modify Expense Page with today's date. Change the duration type Select element to 'Date
 */
function resetModExpEls() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    modExpPageEl.dateInput.value = getDateStringFromDateObj(today);
    changeSelectionFunc2(modExpPageEl.durationSelect, 'Date');
    modExpPageEl.modExpTbl.innerHTML = '';
}

/**
 * Get expense records (Array of objects) for the date or duration in Modify Expense Page and tabulate them. 
 */
async function dateChangemodExp() {
    const dateStr = modExpPageEl.dateInput.value;
    const recordsModExp = await getRecords(dateStr);
    updatePagination(recordsModExp);
    renderRecordTable(1, recordsModExp);
    highlightPageLink(1);
}

/**
 * Retrieves records from the expenseTbl based on the provided date string.
 * If the duration type is 'date', retrieves records for that date.
 * Otherwise, retrieves records for the specified month.
 * 
 * @param {string} dateStr - Date string in the 'YYYY-MM-DD'format.
 * @returns {Promise<Array<object>>} - Promise resolving to an array of record objects.
 * @throws {Error} - Throws an error if the user is not signed in or if there is a problem with the query.
 */
async function getRecords(dateStr) {    
    const dateLookupObj = getDateWithTimeZero(dateStr);
    const durationModExp = modExpPageEl.durationSelect.value;
    let recordsModExp = [];

    if (durationModExp === 'date') {
        recordsModExp = await getRecordsWhereDateIs(tableName, dateLookupObj);
    } else {
        const [year, month] = dateStr.split('-').map(Number);
        let startDateObj = new Date(year, month - 1, 1); // -1 as months are zero-indexed
        startDateObj.setHours(0, 0, 0, 0);
        let endDateObj = new Date(year, month, 0);
        endDateObj.setHours(0, 0, 0, 0);

        try {
            recordsModExp = await getRecordsWhereDateRangeAndCategory(tableName, startDateObj, endDateObj);
        } catch (error) {
            console.error(`Error Fetching records for ${getDateStringFromDateObj(startDateObj)} to ${getDateStringFromDateObj(endDateObj)}:`, error);
        }
    }

    return recordsModExp;
}

/**
 * Updates the pagination Container div based on 15 records per page. Adds click event listener for each page link.
 * @param {Array<object>} recordsModExp - All the expense records (array of objectS) for the selected duration.
 */
function updatePagination(recordsModExp) {
    const totalPages = Math.ceil(recordsModExp.length / 15);
    modExpPageEl.paginationContainer.innerHTML = '';

    for (let i = 1; i <= totalPages; i++) {
        const pageLink = document.createElement('a');
        pageLink.href = '#';
        pageLink.textContent = i;
        pageLink.classList.add('page-link');
        pageLink.addEventListener('click', () => {
            renderRecordTable(i, recordsModExp);
            highlightPageLink(i);
        });
        modExpPageEl.paginationContainer.appendChild(pageLink);
    }
    modExpPageEl.paginationContainer.classList.add('modExpTblPageHeader');
    
}

/**
 * Update the records table in Modify Expense Page based on the page clicked.
 * @param {number} currentPage - Page number clicked
 * @param {Array<object>} recordsModExp - All the expense records (array of objectS) for the selected duration.
 */
function renderRecordTable(currentPage, recordsModExp) {
    modExpPageEl.modExpTbl.innerHTML = '';
    const tableSection = document.getElementById('modExpTblSec');
    tableSection.classList.remove('addBgcModExpTblSec');
    modExpPageEl.paginationContainer.classList.remove('addBgcmodExpTblPageHeader');

    if (recordsModExp.length === 0) return;

    tableSection.classList.add('addBgcModExpTblSec');
    modExpPageEl.paginationContainer.classList.add('addBgcmodExpTblPageHeader');

    createTableHeader();
    const tbodyModExp = document.createElement('tbody');

    const paginatedRecords = recordsModExp.slice((currentPage - 1) * 15, currentPage * 15);

    paginatedRecords.forEach(record => {
        const row = tbodyModExp.insertRow();
        ['date', 'amount', 'category', 'subcategory', 'description', 'id'].forEach((field) => {
            const cell = row.insertCell();
            if (field === 'date') {
                const dateObj = record[field];
                const formattedDate = dateObj.toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',  // 'short' gives abbreviated month names (e.g., 'Oct')
                    year: '2-digit'
                  });
                cell.textContent = formattedDate;
            } else {
                cell.textContent = record[field];
            }
        });
    });

    modExpPageEl.modExpTbl.appendChild(tbodyModExp);
    modExpPageEl.modExpTbl.classList.add('modExpTblClass');
    
    highlightEvenRows();
}

/**
 * Create table header for the Modify Expense Page table
 */
function createTableHeader() {
    const headerRowModExp = modExpPageEl.modExpTbl.createTHead().insertRow(0);
    ['Date', 'Amount', 'Category', 'SubCategory', 'Description', 'DocID'].forEach((heading) => {
        const cell = headerRowModExp.insertCell();
        cell.textContent = heading;
    });
}

/**
 * Highlight even rows in the table
 */
function highlightEvenRows() {
    const evenRows = document.querySelectorAll('#modExpTbl tbody tr:nth-child(even)');

    evenRows.forEach(row => {
        row.style.backgroundColor = '#0000000b';
    });
}

/**
 * Highlight the page number that is clicked
 * @param {number} pageNumber 
 */
function highlightPageLink(pageNumber) {
    const pageLinks = document.querySelectorAll('.page-link');
    pageLinks.forEach((link, index) => {
        if (index === pageNumber - 1) {
            link.classList.add('active-link');
        } else {
            link.classList.remove('active-link');
        }
    });
}

/**
 * Collects the data of the row clicked in Modify Expense Table Page and stores it in the modExpFrmPage div element dataset.
 * This dataset is accessed to transfer it to Modify Expense Form Page when the table click event listener is triggered.
 * @param {HTMLTableRowElement} targetRow - Clicked Row
 * @returns 
 */
function getRowClickedModExpTbl (targetRow) {
    if (!targetRow || (targetRow.cells[0].textContent === 'Date')) {
        return;
    }

    let rowDataObj;        
    rowDataObj = {
        date: targetRow.cells[0].textContent,
        amount: targetRow.cells[1].textContent,
        description: targetRow.cells[4].textContent,
        category: targetRow.cells[2].textContent,
        subcategory: targetRow.cells[3].textContent,
        docIDKey: targetRow.cells[5].textContent,
        rowKey: Array.from(targetRow.parentElement.rows).indexOf(targetRow)
    }

    switchPageTo(modExpFrmPageEl.pageParentDiv, modExpPageEl.pageParentDiv);

    resetModExpFrm();
    transferRowDataToModExpFrm(rowDataObj);
    modExpFrmPageEl.pageParentDiv.dataset.currModExpTblRow = '';
    modExpFrmPageEl.pageParentDiv.dataset.currModExpTblRow = JSON.stringify(rowDataObj);
}

/**Resets the Modify Expense Form Page */
function resetModExpFrm() {
    modExpFrmPageEl.dateInput.value = "";
    modExpFrmPageEl.amountInput.value = "";
    modExpFrmPageEl.descInput.value = "";
    modExpFrmPageEl.catSelect.value = "";
    populateCatSelect(modExpFrmPageEl.catSelect, expCat);
    modExpFrmPageEl.subCatSelect.value = '';

    modExpFrmPageEl.docIDPara.innerHTML = "";
    modExpFrmPageEl.updateDBStatus.innerHTML = "";
}

/**
 * This function transfers the clicked row data saved in the modExpFrmPage div element dataset to Modify Expense Form page elements
 * @param {Object} rowDataObj - The cell data for the row clicked
 */
function transferRowDataToModExpFrm(rowDataObj) {
    const dateObj = new Date(rowDataObj.date);
    modExpFrmPageEl.dateInput.value = getDateStringFromDateObj(dateObj);
    modExpFrmPageEl.amountInput.value = rowDataObj.amount;
    modExpFrmPageEl.descInput.value = rowDataObj.description;
    changeSelectionFunc2(modExpFrmPageEl.catSelect, rowDataObj.category);

    populateCatSelect(modExpFrmPageEl.subCatSelect, expCatObj[rowDataObj.category]);
    changeSelectionFunc2(modExpFrmPageEl.subCatSelect, rowDataObj.subcategory);

    modExpFrmPageEl.docIDPara.innerHTML = rowDataObj.docIDKey;
}

/**
 * Updates database with the data in the Modify Expense Form Page
 * @returns 
 */
async function updateRecordsWithModExpFrmPage () {

    let checkVar = checkAllInputsEntered();
    if (!checkVar) {
        return;
    }
    const currModExpTblRowObj = JSON.parse(modExpFrmPageEl.pageParentDiv.dataset.currModExpTblRow);
    let rowNo = parseInt(currModExpTblRowObj.rowKey);
    delete currModExpTblRowObj['rowKey'];
    let docID = parseInt(currModExpTblRowObj.docIDKey);
    delete currModExpTblRowObj['docIDKey'];
    
    let dateModFrmObj = getDateWithTimeZero(modExpFrmPageEl.dateInput.value);
    dateModFrmObj.setHours(0, 0, 0, 0);
    currModExpTblRowObj.date = dateModFrmObj;
    currModExpTblRowObj.amount = parseFloat(modExpFrmPageEl.amountInput.value);
    currModExpTblRowObj.description = modExpFrmPageEl.descInput.value;
    currModExpTblRowObj.category = modExpFrmPageEl.catSelect.options[modExpFrmPageEl.catSelect.selectedIndex].text;
    currModExpTblRowObj.subcategory = modExpFrmPageEl.subCatSelect.options[modExpFrmPageEl.subCatSelect.selectedIndex].text;

    try {
        await updateRecord(tableName, docID, currModExpTblRowObj);
    } catch (error) {
        console.log(`error updating doc ${docID}`, error);
    }
    
    const tbodyEl = document.querySelector('#modExpTbl tbody');
    tbodyEl.rows[rowNo].cells[0].textContent = currModExpTblRowObj.date;
    tbodyEl.rows[rowNo].cells[1].textContent = currModExpTblRowObj.amount;
    tbodyEl.rows[rowNo].cells[2].textContent = currModExpTblRowObj.description;
    tbodyEl.rows[rowNo].cells[3].textContent = currModExpTblRowObj.category;
    tbodyEl.rows[rowNo].cells[4].textContent = currModExpTblRowObj.subcategory;

    await dateChangemodExp();
    modExpFrmPageEl.updateDBStatus.innerHTML = `Doc. ${docID} has been updated.`;
}

function checkAllInputsEntered() {    
    let currModExpCat = '';
    let currModExpSubCat = '';
    let dateVal = modExpFrmPageEl.dateInput.value;

    if (!isISODate(dateVal) || !isValidDate(dateVal)) {
        return false;
    }
    
    if (!modExpFrmPageEl.amountInput.value.trim() || !modExpFrmPageEl.descInput.value.trim()) {
        modExpFrmPageEl.updateDBStatus.textContent = 'Please fill in all the fields.';
        return false;
    }
    
    try {
        currModExpCat = modExpFrmPageEl.catSelect.options[modExpFrmPageEl.catSelect.selectedIndex].text;
        currModExpSubCat = modExpFrmPageEl.subCatSelect.options[modExpFrmPageEl.subCatSelect.selectedIndex].text;
        if ((currModExpCat == "Select an Option") || (currModExpSubCat == "Select an Option")) {
            modExpFrmPageEl.updateDBStatus.textContent = 'Please select Expense Category & Subcategory.';
            return false; 
        }
    } catch (error) {
        modExpFrmPageEl.updateDBStatus.textContent = 'Please select Expense Category & Subcategory.';
        return false;        
    }
    return true;
}

/**
 * Gets and filters the records from the database and tabulates them in Modify Expense Page.
 * triggered by the Filter button in Modify Expense Form Page
 * @param {string} dateStr 
 */
async function fltrRecodrsArry(dateStr) {

    let recordsModExp = await getRecords(dateStr);
    let subCat = modExpFrmPageEl.subCatSelect.options[modExpFrmPageEl.subCatSelect.selectedIndex].text;
    let cat = modExpFrmPageEl.catSelect.options[modExpFrmPageEl.catSelect.selectedIndex].text;
    if (cat !== 'Select an Option') {
        recordsModExp = recordsModExp.filter(record => record.category === cat);
    }
    if (subCat !== 'Select an Option') {
        recordsModExp = recordsModExp.filter(record => record.subcategory === subCat);
    }
    switchPageTo(modExpPageEl.pageParentDiv, modExpFrmPageEl.pageParentDiv);
    updatePagination(recordsModExp);
    renderRecordTable(1, recordsModExp);
    highlightPageLink(1);
}

function handleModExpTblSwipe(deltaX) {
    console.log(modExpPageEl.durationSelect.value);
    if (deltaX > 0) {
        if (modExpPageEl.durationSelect.value == 'date') {
            modExpPageEl.dateInput.value = addDaysToDate(modExpPageEl.dateInput.value, -1);
        } else {
            modExpPageEl.dateInput.value = addMonthsToDate(modExpPageEl.dateInput.value, -1);
        }
    } else {
        if (modExpPageEl.durationSelect.value == 'date') {
            modExpPageEl.dateInput.value = addDaysToDate(modExpPageEl.dateInput.value, 1);
        } else {
            modExpPageEl.dateInput.value = addMonthsToDate(modExpPageEl.dateInput.value, 1);
        }
    }
}

export { resetModExpEls, dateChangemodExp, handleModExpTblSwipe, getRowClickedModExpTbl, updateRecordsWithModExpFrmPage, fltrRecodrsArry }