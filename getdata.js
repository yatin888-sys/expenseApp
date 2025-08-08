"use strict";

import { sumExpPageEl, trendsExpPageEl, setDateRangeForSmmry, clearTable, createTableHeader, appendRowsToTable, boldLastRow, switchPageTo, getDateWithTimeZero, addDaysToDate, addMonthsToDate, getNextWeekday, getDateStringFromDateObj, tableName } from './globals.js';
import { getRecordsWhereDateRangeAndCategory, getRecordsWhereDateRangeCategoryAndSubCategory, getAllHistDocs } from './myDB.js';

let trendsChartVar;

async function summarizeExpForDuration() {
    const selectedRange = sumExpPageEl.expSummryDuration.options[sumExpPageEl.expSummryDuration.selectedIndex].text;
    const { startDate, endDate } = setDateRangeForSmmry(selectedRange);
    
    let expenseSummary = await getSummary(startDate, endDate);

    const catChartCtx = sumExpPageEl.canvasForCatChart.getContext('2d');
    ChartManager.createCatChart(catChartCtx, expenseSummary);
    TableManager.populateCategoryTable(expenseSummary);
    
    sumExpPageEl.canvasForSubCatChart.style.display = 'none';
    
    sumExpPageEl.subCategoryExpTable.style.display = 'none';
    
    sumExpPageEl.tableSavings.style.display = 'block';
    await TableManager.populateSavingsTbl();
    sumExpPageEl.tableSavings.scrollIntoView({ behavior: 'smooth'});

    const salaryRecordsArray = await getRecordsWhereDateRangeCategoryAndSubCategory(tableName, startDate, endDate, "Income", "Salary");
    let totals = summarizeSalaries(salaryRecordsArray);

    const rentalIncomeRecordsArray = await getRecordsWhereDateRangeCategoryAndSubCategory(tableName, startDate, endDate, "Income", "Rental Income");
    summarizeRentalIncome(rentalIncomeRecordsArray, totals);
    
    displaySalaryTotals(totals, sumExpPageEl.salarySectionDiv);

}

/**
 * Creates a summary of expenses category-wise or sub-category-wise and optionally calculates total Income.
 * @param {Date} startDate - The start date for the summary range.
 * @param {Date} endDate - The end date for the summary range.
 * @param {Object} [config={}] - Configuration Object
 * @param {string} [config.key='category'] - The key to summarize by ('category' or 'subcategory').
 * @param {boolean} [config.includeIncome=false] - Whether to include income in the summary.
 * @param {string|null} [config.filterCategory=null] - A category to filter by.
 * @returns {Promise<Object>} - A summary of expenses and optionally the total income. The summary expense object will have property keys as the categories / sub-categories and values as amount.
 */
async function getSummary(startDate, endDate, config = {}) {

    // Destructure config with default values
    const { key = 'category', includeIncome = false, filterCategory = null } = config;

    const recordsArray = await getRecordsWhereDateRangeAndCategory(tableName, startDate, endDate, filterCategory);
    const expenseSummary = {};
    let totalIncome = 0;

    recordsArray.forEach((rec) => {
        const summaryKey = rec[key];
        const amountValue = parseFloat(rec.amount);

        if (summaryKey === 'Income') {
            totalIncome  += amountValue;
        } else {
            if (!expenseSummary[summaryKey]) {
                expenseSummary[summaryKey] = 0;
            }
            expenseSummary[summaryKey] += amountValue;
        }
    });

    return includeIncome ? { expenseSummary, totalIncome } : expenseSummary;
}

const ChartManager = (() => {
    let catChart;
    let subCatChart;

    /**
     * Create a chart and destroy the existing one if necessary.
     * @param {CanvasRenderingContext2D} ctx 
     * @param {Record<string, number>} data 
     * @param {'category' | 'subcategory'} type 
     */
    function createChart(ctx, data, type) {
        // Determine which chart to destroy and recreate
        if (type === 'category' && catChart) {
            catChart.destroy();
        } else if (type === 'subcategory' && subCatChart) {
            subCatChart.destroy();
        }

        const chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(data),
                datasets: [{
                    data: Object.values(data),
                }]
            },
            options: {
                legend: {
                    display: true,
                    position: 'bottom',
                },
                
                borderWidth: 8,
                borderRadius: 2,
                hoverBorderWidth: 0,
                borderColor: '#d09683',
                plugins: {
                    colors: {
                        forceOverride: true
                      }
                },
                tooltips: {
                    enabled: true,
                    itemSort: function (a, b) {
                      // Sort the items by value in descending order
                      
                      return b.datasetIndex - a.datasetIndex;
                    },
                    callbacks: {
                      label: function (tooltipItem, data) {
                        
                        const dataset = data.datasets[tooltipItem.datasetIndex];
                        const total = dataset.data.reduce((accumulator, currentValue) => accumulator + currentValue);
                        const currentValue = dataset.data[tooltipItem.index];
                        const percentage = Math.round((currentValue / total) * 100);
                        
                        return `${data.labels[tooltipItem.index]}: ${currentValue} ( ${percentage}%)`;
                      }
                    }
                  }      
            }
        });

        if (type === 'category') {
            catChart = chart;
        } else if (type === 'subcategory') {
            subCatChart = chart;
        }
    }
    
    return {
        createCatChart: (ctx, data) => createChart(ctx, data, 'category'),
        createSubCatChart: (ctx, data) => createChart(ctx, data, 'subcategory')
    };
})();

const TableManager = (() => {
    /**
     * Clears the table and prepares it with headers.
     * @param {HTMLTableElement} table - The table element to clear and prepare.
     * @param {Array<string>} headers - The headers to set for the table.
     * @returns {HTMLTableSectionElement} - The tbody element of the table.
     */
    function clearAndPrepareTable(table, headers) {
        clearTable(table);
        const theadEl = createTableHeader(headers);
        table.appendChild(theadEl);
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        return tbody;
    }

    /**
     * Appends summary rows to a table body and makes the last row bold.
     * @param {HTMLTableSectionElement} tbody - The tbody element to append rows to.
     * @param {Array<object>} summaryArray - The summary data (Array of objects) to populate the rows.
     * @param {Array<string>} fields - The fields to use as columns in the table.
     */
    function appendSummaryRows(tbody, summaryArray, fields) {
        appendRowsToTable(tbody, summaryArray, fields);
        boldLastRow(tbody.parentElement);
    }

     /**
     * Calculates the total amount from a summary object.
     * @param {object} summary - The summary object containing amounts.
     * @returns {number} - The total amount.
     */
    function calculateTotal(summary) {
        return Object.values(summary).reduce((total, amount) => total + amount, 0);
    }

    /**
     * Prepares a summary array for table display. Formats amount property value and calculates and sets the percentage property of the new objects that will be returned as array.
     * @param {object} summary - The summary object containing amounts.
     * @param {number} totalExpenditure - The total expenditure amount.
     * @param {Array<string>} fields - The fields to use as columns in the table.
     * @returns {Array<object>} - The prepared summary array of objects with the elements in the fields array as keys and formatted values of summary object as values.
     */
    function prepareSummaryArray(summary, totalExpenditure, fields) {
        return Object.entries(summary).map(([key, amount]) => {
            const percentage =  ((amount / totalExpenditure) * 100).toFixed(2);
            return fields.reduce((obj, field) => {
                obj[field] = field === 'amount' ? `$${amount.toLocaleString()}` : field === 'percentage' ? `${percentage}%` : key;
                return obj;
            }, {});
        }).sort((a,b) => parseFloat(b.amount.replace(/[$,]/g, '')) - parseFloat(a.amount.replace(/[$,]/g, '')));
    }

     /**
     * Populates the category expense table with summary data.
     * @param {object} expenseSummary - The expense summary data object with key as category and amount as values
     */
    function populateCategoryTable(expenseSummary) {
        const totalExpenditure = calculateTotal(expenseSummary);
        const tbody = clearAndPrepareTable(sumExpPageEl.categoryExpTable, ['Category', 'Total Amount', 'Percentage']);
        const summaryArray = prepareSummaryArray(expenseSummary, totalExpenditure, ['category', 'amount', 'percentage']);

        summaryArray.push({
            category: 'Total',
            amount: `$${totalExpenditure.toLocaleString()}`,
            percentage: '100%'
        });
        appendSummaryRows(tbody, summaryArray, ['category', 'amount', 'percentage']);
        
        sumExpPageEl.categoryExpTable.classList.add('catSumExpTblClass');
    }

    /**
     * Populates the sub-category expense table with summary data.
     * @param {object} expenseSummary - The expense summary data object with property keys as sub-categories and values as amount.
     * @param {string} cat - The category name.
     */
    function populateSubCategoryTable(expenseSummary, cat) {
        const totalAmountAllSubCategories = calculateTotal(expenseSummary);
        const totalExpense = calculateTotalFromCategoryTable(sumExpPageEl.categoryExpTable);
        const tbody = clearAndPrepareTable(sumExpPageEl.subCategoryExpTable, ['Sub-Category', 'Total Amount', '% Cat', '% Total']);

        const summaryArray = Object.entries(expenseSummary).map(([subCat, amount]) => ({
            subcategory: subCat,
            amount: `$${amount.toLocaleString()}`,
            percentsubcat: `${((amount / totalAmountAllSubCategories) * 100).toFixed(2)}%`,
            percenttotal: `${((amount / totalExpense) * 100).toFixed(2)}%`
        })).sort((a, b) => parseFloat(b.amount.replace(/[$,]/g, '')) - parseFloat(a.amount.replace(/[$,]/g, '')));

        summaryArray.push({
            subcategory: cat,
            amount: `$${totalAmountAllSubCategories.toLocaleString()}`,
            percentsubcat: `100%`,
            percenttotal: `${((totalAmountAllSubCategories / totalExpense) * 100).toFixed(2)}%`
        });
        appendSummaryRows(tbody, summaryArray, ['subcategory', 'amount', 'percentsubcat', 'percenttotal']);
        
        sumExpPageEl.subCategoryExpTable.classList.add('catSumExpTblClass');
    }

    /**
     * Populates the savings table with summary data.
     */
    async function populateSavingsTbl() {
        const tbody = clearAndPrepareTable(sumExpPageEl.tableSavings, ['Total', 'Amount']);
        const selectedRange = sumExpPageEl.expSummryDuration.options[sumExpPageEl.expSummryDuration.selectedIndex].text;
        let { startDate, endDate } = setDateRangeForSmmry(selectedRange);
        let { expenseSummary, totalIncome } = await getSummary(startDate, endDate, { includeIncome: true });
        const totalExpenditure = calculateTotal(expenseSummary);

        const tblArray = [ {
            category: 'Expense',
            amount: `$${totalExpenditure.toLocaleString()}`
    
        }, {
            category: 'Income',
            amount: `$${totalIncome.toLocaleString()}`
        } ];
    
        appendRowsToTable(tbody, tblArray, ['category', 'amount']);
        appendSavingsRow(tbody, totalIncome, totalExpenditure);
        sumExpPageEl.tableSavings.classList.add('catSumExpTblClass');
        styleEvenRows(sumExpPageEl.tableSavings);
    }

    /**
     * Extracts the total amount from the last row of the category table.
     * @param {HTMLTableElement} categoryTable - The category table element.
     * @returns {number} - The total amount from the last row.
     */
    function calculateTotalFromCategoryTable(categoryTable) {
        const lastRow = categoryTable.rows[categoryTable.rows.length - 1];
        return parseFloat(lastRow.cells[1].textContent.replace(/[$,]/g, ''));
    }

    /**
     * Adds the final Savings Row to the Savings Table
     * @param {HTMLTableSectionElement} tbody - The tbody element of the table.
     * @param {number} totalIncome - The total income amount.
     * @param {number} totalExpenditure - The total expenditure amount.
     */
    function appendSavingsRow (tbody, totalIncome, totalExpenditure) {
        let row = tbody.insertRow();
        let cellSavingsLabel = row.insertCell(0);
        let cellSavingsAmount = row.insertCell(1);

        const savingsIcon = document.createElement('img');
        savingsIcon.src = 'savings.png';
        savingsIcon.alt = '';
        savingsIcon.height = 40;
        savingsIcon.width = 40;

        const textSpan = document.createElement('span');
        textSpan.textContent = 'Savings';
        textSpan.style.marginLeft = '10px';
        textSpan.style.color = 'black';

        const strgEl = document.createElement('strong');
        strgEl.appendChild(textSpan);

        const containerDiv = document.createElement('div');
        containerDiv.style.display = 'flex';
        containerDiv.style.alignItems = 'center';
        containerDiv.appendChild(savingsIcon);
        containerDiv.appendChild(strgEl);
        

        cellSavingsLabel.appendChild(containerDiv);

        let SavingsAmount = totalIncome - totalExpenditure;
        const strgEl2 = document.createElement('strong');
        strgEl2.style.color = 'black';
        strgEl2.textContent = `$${SavingsAmount.toLocaleString()}`;

        cellSavingsAmount.appendChild(strgEl2);
    }

    /**
     * @param {HTMLElement | null} table
     */
    function styleEvenRows(table) {
        if (!table) return;

        const evenRows = document.querySelectorAll(`#${table.id} tbody tr:nth-child(even)`);
        evenRows.forEach(row => {
            
            row.style.backgroundColor = '#0000000b';
        });
    }

    return {
        populateCategoryTable,
        populateSubCategoryTable,
        populateSavingsTbl
    };

})();

/**
 * This function is triggered when any row of the Category-wise summary table is clicked.
 * @param {*} event 
 * @returns 
 */
async function showChartTableForSubCategories(event) {
    try {
        const clickedRow = event.target.closest('tr');

        if (!clickedRow) return;

        let firstCellText = clickedRow.cells[0].textContent;
            if (firstCellText == 'Category' || firstCellText == 'Total') {
                return;
            }

            const category = firstCellText;
            const selectedRange = sumExpPageEl.expSummryDuration.options[sumExpPageEl.expSummryDuration.selectedIndex].text;
            let { startDate, endDate } = setDateRangeForSmmry(selectedRange); 
            let expenseSummary = await getSummary(startDate, endDate, {
                key: 'subcategory',
                filterCategory: category
            });
            
            sumExpPageEl.canvasForSubCatChart.style.display = 'block';
            const subCatChartCtx = sumExpPageEl.canvasForSubCatChart.getContext('2d');
            ChartManager.createSubCatChart(subCatChartCtx, expenseSummary);
            TableManager.populateSubCategoryTable(expenseSummary, category);
        
            sumExpPageEl.subCategoryExpTable.style.display = 'block';
            sumExpPageEl.subCategoryExpTable.scrollIntoView({ behavior: 'smooth'});

    } catch (error) {
        console.error('Error getting expense summary Sub-Category-wise:', error);
    }
}

/**
 * Summarizes the Salaries based on the description containing "Yatin" or "Asha".
 * @param {Array<Object>} records - Array of expense objects filtered for Salary subcategory.
 * @returns {Object} - An object with total amounts for "Yatin" and "Asha".
 */
function summarizeSalaries(records) {
    let totals = {
        yatin: 0.0,
        asha: 0.0,
        rentalIncome: 0.0
    };

    records.forEach(record => {
        if (record.description.toLowerCase().includes("yatin")) {
            totals.yatin += parseFloat(record.amount) || 0;
        } else if (record.description.toLowerCase().includes("asha")) {
            totals.asha += parseFloat(record.amount) || 0;
        }
    });

    return totals;
}

/**
 *  Appends the summarized rentalIncome to the totals object 
 * @param {Array<Object>} rentalIncomeRecordsArray - Array of expense objects filtered for Rental Income subcategory.
 * @param {*} totals - Income Object with properies - yatin, asha & rentalIncome
 */
function summarizeRentalIncome(rentalIncomeRecordsArray, totals) {
    // Ensure the totals object exists
    if (!totals || typeof totals !== "object") {
        throw new Error("Invalid totals object provided");
    }
    
    // Sum the 'amount' property from each object in the array
    const totalAmount = rentalIncomeRecordsArray.reduce((sum, record) => {
        if (record && typeof record.amount === "number") {
            return sum + record.amount;
        }
        return sum; // Skip invalid records
    }, 0);
    
    // Add the calculated total as a new property to the totals object
    totals.rentalIncome = totalAmount;
}

/**
 * Displays the salary totals for Yatin and Asha in the specified div element.
 * @param {Object} totals - Object containing totals for Yatin and Asha.
 * @param {HTMLElement} targetDiv - The div element to display the totals.
 */
function displaySalaryTotals(totals, targetDiv) {
    // Clear the contents of the div element
    targetDiv.innerHTML = "";

    // Create and add the line for Yatin's total salary
    const yatinLine = document.createElement("p");
    yatinLine.textContent = `Yatin's Salary: $${totals.yatin.toLocaleString()}`;
    targetDiv.appendChild(yatinLine);

    // Create and add the line for Asha's total salary
    const ashaLine = document.createElement("p");
    ashaLine.textContent = `Asha's Salary: $${totals.asha.toLocaleString()}`;
    targetDiv.appendChild(ashaLine);

    // Create and add the line for total Rental Income
    const rentalIncomeLine = document.createElement("p");
    rentalIncomeLine.textContent = `Rental Income: $${totals.rentalIncome.toLocaleString()}`;
    targetDiv.appendChild(rentalIncomeLine);
}

/**
 * This function is triggered when any row of the Sub-Category-wise summary table is clicked.
 * @param {*} event 
 * @returns 
 */
async function handleSubCategoryRowClick(event) {
    const clickedRow = event.target.closest("tr");
    if (!clickedRow) return;

    const subCategory = clickedRow.cells[0].textContent; // Subcategory name
    const isParentCategory = clickedRow.rowIndex === sumExpPageEl.subCategoryExpTable.rows.length - 1;
    const wasHeaderClicked = clickedRow.rowIndex === 0;

    if (wasHeaderClicked) return; // Header row cliked. No rendering required.

    if (isParentCategory) {
        // Fetch and render trends for the parent category
        const category = subCategory; // Assuming last row is the category total
        await navigateToTrendsPage(() => renderTrendsChartForCategory(category));
    } else {
        // Fetch and render trends for the subcategory
        await navigateToTrendsPage(() => renderTrendsChartForSubCategory(subCategory));
    }
}

/**
 * This function is triggered when Savings Table is clicked
 */
async function handleSavingsTblClick(event) {

    const clickedRow = event.target.closest("tr");
    if (!clickedRow) return;

    const firstCellText = clickedRow.cells[0].textContent; // To determine Expense or Savings
    const isSavingsTrend = clickedRow.rowIndex === sumExpPageEl.tableSavings.rows.length - 1;

    if (firstCellText === 'Total') return; // Header row cliked. No rendering required.

    if (firstCellText === 'Expense') {
        // Fetch and render trends for all Expenses
        await navigateToTrendsPage(() => renderTrendsChartForAllExpenses());
    } else if (firstCellText === 'Income') {
        // Fetch and render trends for Income
        await navigateToTrendsPage(() => renderTrendsChartForIncome());
    } else {
        // Fetch and render trends for Savings
        await navigateToTrendsPage(() => renderTrendsChartForSavings());
        
        // Show Forecasted expenses until the next Pay date 
        let allHistRecords = await getAllHistDocs(tableName);
        let nextPayDate = nextIncomeDate(allHistRecords);
        await showForecastedExpenses(nextPayDate, allHistRecords);
    }    
}

async function navigateToTrendsPage(renderChartCallback) {
    // Switch to trends page
    switchPageTo(trendsExpPageEl.trendsExpPage, sumExpPageEl.sumExpPage);

    // Destroy the previous chart instance if it exists
    if (trendsChartVar) {
        trendsChartVar.destroy();
    }

    // Render the new chart
    await renderChartCallback();

    // Clear the forecast expenses division element
    trendsExpPageEl.forcastedExpDiv.innerHTML = '';
}

async function renderTrendsChartForCategory(category) {
    let allHistRecords = await getAllHistDocs(tableName);
    const trendsSummry = fetchtrendData(allHistRecords, { category: category }, false);
    const movAvgTrends = calculateMovingAverage(trendsSummry);
    const mnthsLabelsForTrendsChart = generateLast12MonthLabels(trendsSummry);

    renderTrendsChart(trendsSummry, mnthsLabelsForTrendsChart, movAvgTrends);
}

async function renderTrendsChartForSubCategory(subCategory) {
    let allHistRecords = await getAllHistDocs(tableName);
    const trendsSummry = fetchtrendData(allHistRecords, { subcategory: subCategory }, false);
    const movAvgTrends = calculateMovingAverage(trendsSummry);
    const mnthsLabelsForTrendsChart = generateLast12MonthLabels(trendsSummry);

    renderTrendsChart(trendsSummry, mnthsLabelsForTrendsChart, movAvgTrends);
}

async function renderTrendsChartForAllExpenses() {
    let allHistRecords = await getAllHistDocs(tableName);
    const trendsSummry = fetchtrendData(allHistRecords, null, false);
    const movAvgTrends = calculateMovingAverage(trendsSummry);
    const mnthsLabelsForTrendsChart = generateLast12MonthLabels(trendsSummry);

    renderTrendsChart(trendsSummry, mnthsLabelsForTrendsChart, movAvgTrends);
}

async function renderTrendsChartForIncome() {
    let allHistRecords = await getAllHistDocs(tableName);
    const trendsSummry = fetchtrendData(allHistRecords, { category: 'Income' }, false);
    const movAvgTrends = calculateMovingAverage(trendsSummry);
    const mnthsLabelsForTrendsChart = generateLast12MonthLabels(trendsSummry);

    renderTrendsChart(trendsSummry, mnthsLabelsForTrendsChart, movAvgTrends);
}

async function renderTrendsChartForSavings() {
    let allHistRecords = await getAllHistDocs(tableName);
    const trendsSummry = fetchtrendData(allHistRecords, null, true);
    const movAvgTrends = calculateMovingAverage(trendsSummry);
    const mnthsLabelsForTrendsChart = generateLast12MonthLabels(trendsSummry);

    renderTrendsChart(trendsSummry, mnthsLabelsForTrendsChart, movAvgTrends);
}

/**
 * Generates trends data (expenses or savings) for the past 12 months based on the given filter.
 * @param {Array<object>} allHistRecords - Array with all the transactions as objects.
 * @param {Object|null} filter - Object specifying the filter criteria. Example: { category: 'Housing' } or { subcategory: 'Rent' }.
 *                                If null, calculates overall expenses or savings.
 * @param {boolean} isSavings - If true, calculates savings; otherwise, calculates expenses.
 * @returns {Array<number>} – Returns an array with trends data for up to past 12 months.
 */
function fetchtrendData(allHistRecords, filter = null, isSavings = false) {
    const trendsSummary = [];
    const { monthV: startMonth, yearV: startYear } = getStrtMonthTrends(allHistRecords);
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 12; i++) {
        const checkDate = new Date(today.getFullYear(), today.getMonth() - i);
        const month = checkDate.getMonth() + 1; // JS months are zero-indexed
        const year = checkDate.getFullYear();

        // Stop if records don't go back further
        if (year <= parseInt(startYear) && month < parseInt(startMonth)) break;

        // Filter records based on month/year and provided filter criteria
        const monthlyRecords = allHistRecords.filter(rec => {
            const recordDate = new Date(rec.date); // Ensure date comparison works with Date objects
            const isSameMonthYear = recordDate.getMonth() + 1 === month && recordDate.getFullYear() === year;

            // Apply filter if specified
            if (filter && filter.category) {
                return isSameMonthYear && rec.category === filter.category;
            } else if (filter && filter.subcategory) {
                return isSameMonthYear && rec.subcategory === filter.subcategory;
            }
            return isSameMonthYear; // Default: No filtering (overall expenses or savings)
        });

        // Calculate the trend value
        let trendValue;
        if (isSavings) {
            const totalExp = monthlyRecords.filter(rec => rec.category !== 'Income').reduce((sum, rec) => sum + rec.amount, 0);
            const totalIncome = monthlyRecords.filter(rec => rec.category === 'Income').reduce((sum, rec) => sum + rec.amount, 0);
            trendValue = totalIncome - totalExp;
        } else if (!filter) {
            // Calculate total expenses only (exclude 'Income')
            trendValue = monthlyRecords.filter(rec => rec.category !== 'Income').reduce((sum, rec) => sum + rec.amount, 0);
        } else {
            trendValue = monthlyRecords.reduce((sum, rec) => sum + rec.amount, 0); // Total expenses/income for the month
        }

        trendValue = parseFloat(trendValue.toFixed(2));
        // Add trendValue to the summary
        trendsSummary.unshift(trendValue);
    }
    return trendsSummary;
}

function calculateMovingAverage(data) {
    const movingAvg = [];
    let prevMovingAvg = 0;

    data.forEach((trendValue, index) => {
        const newMovingAvg = (index === 0) ? trendValue : (prevMovingAvg * index + trendValue) / (index + 1);
        movingAvg[index] = parseFloat(newMovingAvg.toFixed(2));
        prevMovingAvg = movingAvg[index];
    });
    return movingAvg;
}

function generateLast12MonthLabels(trendsSummry) {
    const labels = [];
    let today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < trendsSummry.length; i++) {
        const labelDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthLabel = labelDate.toLocaleString('default', { month: 'short' });
        labels.unshift(monthLabel);
    }
    return labels;
}

function renderTrendsChart(trendsSummry, mnthsTrendsChartLables, movAvgTrends) {
    const canvas = trendsExpPageEl.canvasForTrendsChart;
    const ctx = canvas.getContext('2d');

    // Apply classes to the parent div and canvas
    trendsExpPageEl.divTrendsChart.classList.add('chartTrendsDivClass');
    canvas.classList.add('canvasForTrendsChartClass');

    // Reset inline width and height attributes of the canvas
    canvas.width = 800; // Match the CSS width in pixels
    canvas.height = 300; // Match the CSS height in pixels

    // Destroy the previous chart instance if it exists
    if (trendsChartVar) {
        trendsChartVar.destroy();
    }

    trendsChartVar = new Chart(ctx, {
        data: {
            datasets: [{
                type: 'bar',
                label: 'Monthly Trend',
                data: trendsSummry,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                order: 2
            }, {
                type: 'line',
                label: 'Moving Avg.',
                data: movAvgTrends,
                fill: false,
                borderColor: 'rgb(54, 162, 235)',
                order: 1,
                tension: 0.4,
                datalabels: {
                    align: 'end'
                }
            }],
            labels: mnthsTrendsChartLables
        },
        options: {
            responsive: false,
            maintainAspectRatio: false, // Allow custom width/height
            scales: {
                x: {
                    type: 'category',
                    ticks: {
                        autoSkip: false,  // Do not skip any labels
                        padding: 9,      // Add padding between labels and chart
                        maxRotation: 0,
                        minRotation: 0,
                    },
                    grid: {
                        display: false,
                    }
                },
                y: {
                  beginAtZero: true
                }
            }
        },
        plugins: [ChartDataLabels]
    });
}

/**
 * Calculates the next Pay date
 * @param {Array<object>} allHistRecords - Array of Historical transaction records where each transaction is an object
 * @returns Next Pay date as date object
 */
function nextIncomeDate(allHistRecords) {
    let earliestNextPayDate = new Date();
    earliestNextPayDate.setHours(0, 0, 0, 0);
    earliestNextPayDate.setMonth(earliestNextPayDate.getMonth() + 2); // Initializing with a far future date

    let todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    ['Yatin', 'Asha'].forEach(person => {
        // Filtering for Income Category, date <= 1 year, Salary Sub-Category & person
        let filteredRecs = filterRecordsFromHistorical(allHistRecords, "Income", 1, "Salary", person);
        let dateArray = filteredRecs.map( obj => obj.date);
        let nextPayDate = new Date(dateArray[0]);

        if (checkRecurringFreqency(dateArray, 14)) {
            nextPayDate.setDate(nextPayDate.getDate() + 14);
        } else {
            nextPayDate.setMonth(nextPayDate.getMonth() + 1);
        }
        
        earliestNextPayDate = ((nextPayDate < earliestNextPayDate) && (nextPayDate >= todayDate)) ? nextPayDate : earliestNextPayDate;
    });
    return earliestNextPayDate;
}

/**
 * Calculates the forecasted expenses for nominated cat-subcat-desc combinations and
 * tabulates them along with the next pay date above and total amount required below.
 * @param {Date} nextPayDate 
 */
async function showForecastedExpenses(nextPayDate, allHistRecords) {
    trendsExpPageEl.forcastedExpDiv.innerHTML = ""; //clear any previous content 

    const nextPayDatePara = document.createElement('p');
    nextPayDatePara.innerHTML = "Next Pay Date: " + getDateStringFromDateObj(nextPayDate);
    nextPayDatePara.classList.add('forcastedExpDivClass');
    trendsExpPageEl.forcastedExpDiv.appendChild(nextPayDatePara);

    const categories = [
        { category: 'Housing', subcategory: 'Rent', description: null},
        { category: 'Housing', subcategory: 'Mortgage', description: null},
        { category: 'Financial Expenses', subcategory: 'Interest', description: 'Willetton'},
        { category: 'Life & Entertainment', subcategory: 'Child Support', description: null}
    ];

    let forecastedExpenses = [];

    // Collect forecasted expenses for each category and subcategory
    for (let i = 0; i < categories.length; i++) {
        const cat = categories[i];
        let expenses = forecastExpenseForSubCat(allHistRecords, nextPayDate, cat.category, cat.subcategory, cat.description);

        // For Tranmere Home Loan change the amount
        if (i === 1) {
            expenses = expenses.map(exp => {
                exp.amount = 2106.26;
                return exp;
            });
        }

        expenses.forEach(exp => {
            forecastedExpenses.push({
                category: cat.category,
                subCategory: cat.subcategory,
                date: exp.date,
                amount: exp.amount
            });
        });
    }

    // Sort forecasted expenses by date
    forecastedExpenses.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Create table and its header
    const table = document.createElement('table');
    table.classList.add('catSumExpTblClass');

    const header = table.createTHead();
    const headerRow = header.insertRow(0);
    ['Category', 'Sub-Category', 'Forecast Date', 'Amount'].forEach(text => {
        const cell = headerRow.insertCell();
        cell.textContent = text;
        cell.classList.add('forcastTblHeaders');
    });

    // Populate table with forecasted expenses
    const tbody = table.createTBody();
    let totalForecastedAmount = 0;
    
    forecastedExpenses.forEach(exp => {
        const row = tbody.insertRow();

        const categoryCell = row.insertCell(0);
        categoryCell.textContent = exp.category;
        categoryCell.classList.add("forcastTblDataCells");

        const subCategoryCell = row.insertCell(1);
        subCategoryCell.textContent = exp.subCategory;
        subCategoryCell.classList.add("forcastTblDataCells");

        const dateCell = row.insertCell(2);
        dateCell.textContent = exp.date;
        dateCell.classList.add("forcastTblDataCells");

        const amountCell = row.insertCell(3);
        amountCell.textContent = `$${exp.amount.toLocaleString()}`;
        amountCell.classList.add("forcastTblDataCells");

        totalForecastedAmount += exp.amount;
    });

    // Append the table to the forecastedExpDiv
    trendsExpPageEl.forcastedExpDiv.appendChild(table);

    // Show total forecasted amount
    const totalAmountDiv = document.createElement('div');
    totalAmountDiv.textContent = `Total Forecasted Amount: $${totalForecastedAmount.toLocaleString()}`;
    trendsExpPageEl.forcastedExpDiv.appendChild(totalAmountDiv);
    totalAmountDiv.classList.add('forcastedExpDivClass');
}

/**
 * Forecasts future expenses for a subcategory until the next pay date.
 * @param {Date} nextPayDate - The next pay date as a string.
 * @param {string} cat - The category to filter records.
 * @param {string} subCat - The subcategory to filter records.
 * @param {string|null} desc - The description to filter records (optional).
 * @returns {Array} Array of forecasted expenses where each expense is an object with date and amount keys.
 */
function forecastExpenseForSubCat(allHistRecords, nextPayDate, cat, subCat, desc = null) {
    
    // Filter transactions for those that occurred in the last 4 years.
    const filteredRecs = desc ? filterRecordsFromHistorical(allHistRecords, cat, 4, subCat, desc) : filterRecordsFromHistorical(allHistRecords, cat, 4, subCat);

    let dateArray = filteredRecs.map( obj => obj.date);
    let amountArray = filteredRecs.map( obj => obj.amount);
    let maxAmountinLast3 = Math.max(...amountArray.slice(0, 3));

    let lastExpenseDateObj = new Date(dateArray[0]);
    let dateTodayObj = new Date();
    dateTodayObj.setHours(0, 0, 0, 0);

    let daysToNextPay = (nextPayDate.getTime() - lastExpenseDateObj.getTime()) / (1000 * 60 * 60 * 24);
  
    const arrayToReturn = [];

    if (checkRecurringFreqency(dateArray, 7)) {
        addForecastedExpenses(7);
    } else if (checkRecurringFreqency(dateArray, 14)) {
        addForecastedExpenses(14);
    } else {
        addMonthlyForecast();
    }
    return arrayToReturn;

    /**
     * Adds forecasted expenses based on a given interval.
     * @param {number} interval - The interval in days.
     */
    function addForecastedExpenses(interval) {
        let noOfForecastedExpenses = Math.floor(daysToNextPay / interval);
        for (let i=noOfForecastedExpenses; i >= 1; i--) {
            let furtureExpenseDateObj = new Date(lastExpenseDateObj);
            furtureExpenseDateObj.setDate(furtureExpenseDateObj.getDate() + interval*i);
            if (furtureExpenseDateObj >= dateTodayObj && furtureExpenseDateObj <= nextPayDate) {
                let furtureExpenseDate = getDateStringFromDateObj(furtureExpenseDateObj);
                arrayToReturn.push({ 'date': furtureExpenseDate, 'amount': maxAmountinLast3});
            }
        }
    }

    /**
     * Adds a monthly forecasted expense.
     */
    function addMonthlyForecast() {
        let nextForecastDate = addMonthsToDate(getDateStringFromDateObj(lastExpenseDateObj), 1)
        nextForecastDate = getNextWeekday(nextForecastDate);
        const nextForecastDateObj = getDateWithTimeZero(nextForecastDate);

        if (nextForecastDateObj >= dateTodayObj && nextForecastDateObj <= nextPayDate) {
            arrayToReturn.push({ 'date': nextForecastDate, 'amount': maxAmountinLast3});
        }
    }
}

/**
 * Function to get the start month and year from historical records
 * @returns the earliest month (01-indexed) and year as strings based on all the historical records.
 */
function getStrtMonthTrends(allHistRecords) {

    // Reduce to find the record with the earliest date
    const earliestDateObj = allHistRecords.reduce((prev, curr) => 
        prev.date < curr.date ? prev : curr
    );
    const earliestDate = new Date(earliestDateObj.date);

    // Extract month and year as strings
    const monthV = String(earliestDate.getMonth() + 1).padStart(2, '0');
    const yearV = String(earliestDate.getFullYear());
    return { monthV, yearV };
}

/**
 * Filters Array of record objects based on category, no. of years, optional sub-category & optional description
 * @param {Array} allHistRecords 
 * @param {string} cat 
 * @param {Number} noOfYears 
 * @param {string|null} [subCat=null]
 * @param {string|null} [desc=null]
 * @returns 
 */
function filterRecordsFromHistorical(allHistRecords, cat, noOfYears, subCat = null, desc = null) {

    // Filter records based on the category and optional subcategory and option description
    let filteredRecs = allHistRecords.filter(rec => {
        const isCategoryMatch = rec.category === cat;
        const isSubCategoryMatch = subCat ? rec.subcategory === subCat : true;
        const isDescriptionMatch = desc ? rec.description.toLowerCase().includes(desc.toLowerCase()) : true; 
        return isCategoryMatch && isSubCategoryMatch && isDescriptionMatch;
    });

    // Filter records based on the number of years
    filteredRecs = filteredRecs.filter(rec => {
        let dateToday = new Date();
        dateToday.setHours(0, 0, 0, 0);
        let cutOffDate = new Date(dateToday.getFullYear() - noOfYears, dateToday.getMonth(), dateToday.getDate());
        cutOffDate.setHours(0, 0, 0, 0);
        rec.date.setHours(0, 0, 0, 0);
        return rec.date >= cutOffDate;
    });

    // Sort records by date in descending order
    filteredRecs.sort(function(a, b) {
        return b.date - a.date;
    });

    return filteredRecs;
}

function checkRecurringFreqency(dateArray, interval) {
    if (dateArray.length < 3) return false;

    let latestDate1 = new Date(dateArray[0]);
    latestDate1.setDate(latestDate1.getDate() - parseInt(interval));

    let latestDate2 = new Date(latestDate1);
    latestDate2.setDate(latestDate2.getDate() - parseInt(interval));
    
    return isDateInArray(dateArray, latestDate1) && isDateInArray(dateArray, latestDate2);
}

function isDateInArray(dateArray, dateToCheck) {
    const normalizeDate = (date) => {
        const normalizedDate = new Date(date);
        normalizedDate.setHours(0, 0, 0, 0);
        return normalizedDate;
    };
    const normalizedCheckDate = normalizeDate(dateToCheck);

    return dateArray.some(date => normalizeDate(date).getTime() === normalizedCheckDate.getTime());
}



export { summarizeExpForDuration, showChartTableForSubCategories, handleSubCategoryRowClick, handleSavingsTblClick }