import { footerEl, addExpPageEl, modExpPageEl, modExpFrmPageEl, trgChngEventForEl, poplSubCat, touchdata, sumExpPageEl, trendsExpPageEl, switchPageTo, changeSelectionFunc2 } from './globals.js'

import { importToIndexedDB, exportFromIndexedDB } from './myDB.js';

import { resetAddExpEls, sendData } from './adddata.js';

import { resetModExpEls, dateChangemodExp, handleModExpTblSwipe, getRowClickedModExpTbl, updateRecordsWithModExpFrmPage, fltrRecodrsArry } from './moddata.js';

import { summarizeExpForDuration, showChartTableForSubCategories, handleSubCategoryRowClick, handleSavingsTblClick } from './getdata.js';

//Event listeners for Footer Menu
footerEl.addExpIcon.addEventListener('click', async () => {
    if (footerEl.pageId === 'addExpPage') {
        return;
    } else {
        footerEl.pageId = 'addExpPage'
        await showPage();
    } 
});
footerEl.modExpIcon.addEventListener('click', async () => {
    if (footerEl.pageId === 'modExpPage') {
        return;
    } else {
        footerEl.pageId = 'modExpPage'
        await showPage();
    } 
});
footerEl.sumExpIcon.addEventListener('click', async () => {
    if (footerEl.pageId === 'sumExpPage') {
        return;
    } else {
        footerEl.pageId = 'sumExpPage'
        await showPage();
    } 
});

//Event listeners for AddData
addExpPageEl.addExpCat.addEventListener('change', () => {
    poplSubCat(addExpPageEl.addExpCat, addExpPageEl.addExpSubCat);
});
addExpPageEl.submitBtnAddExp.addEventListener('click', sendData);

addExpPageEl.exportBtn.addEventListener('click', exportBackup);
addExpPageEl.importBtn.addEventListener('click', importBackup);
document.getElementById('importFile').addEventListener('change', selectFileAndImport);

//Event listeners for ModData
modExpPageEl.dateInput.addEventListener('change', async function () {
    await dateChangemodExp();
});
modExpPageEl.durationSelect.addEventListener('change', async function () {
    await dateChangemodExp();
});

modExpPageEl.modExpTbl.addEventListener('touchstart', function(event) {
    touchdata.touchStartX = event.touches[0].clientX;
    touchdata.touchStartY = event.touches[0].clientY;
    touchdata.touchStartTime = new Date().getTime();
});

modExpPageEl.modExpTbl.addEventListener('touchend', async function(event) {
    let endX = event.changedTouches[0].clientX;
    let endY = event.changedTouches[0].clientY;
    let endTime = new Date().getTime();
    

    let deltaX = endX - touchdata.touchStartX;
    let deltaY = endY - touchdata.touchStartY;
    let duration = endTime - touchdata.touchStartTime;

    if (duration < 200 && Math.abs(deltaX) < 10 && Math.abs(deltaY) < 10) {
        const targetRow = event.target.closest('tr');
        getRowClickedModExpTbl(targetRow);
    } else {
        if (duration < 1000) {
            handleModExpTblSwipe(deltaX);
            await dateChangemodExp();
            modExpPageEl.modExpTbl.scrollLeft = 0;
        }
    }
});

modExpFrmPageEl.catSelect.addEventListener('change', () => {
    poplSubCat(modExpFrmPageEl.catSelect, modExpFrmPageEl.subCatSelect);
});

modExpFrmPageEl.filterButton.addEventListener('click', async function() {
    const dateModExpString = modExpPageEl.dateInput.value;
    await fltrRecodrsArry(dateModExpString);
});
modExpFrmPageEl.updateButton.addEventListener('click', async () => updateRecordsWithModExpFrmPage());
modExpFrmPageEl.goToModExpPageBtn.addEventListener('click', () => switchPageTo(modExpPageEl.pageParentDiv, modExpFrmPageEl.pageParentDiv));

//Event listeners for GetData
sumExpPageEl.expSummryDuration.addEventListener('change', summarizeExpForDuration);
sumExpPageEl.categoryExpTable.addEventListener('click', showChartTableForSubCategories);
sumExpPageEl.subCategoryExpTable.addEventListener('click', handleSubCategoryRowClick);

sumExpPageEl.tableSavings.addEventListener('click', handleSavingsTblClick);
trendsExpPageEl.goToSumExpPageBtn.addEventListener('click', () => switchPageTo(sumExpPageEl.sumExpPage, trendsExpPageEl.trendsExpPage));

async function showPage() {
    const selectedPage = document.getElementById(footerEl.pageId);

    footerEl.pages.forEach(page => {
        if (page === selectedPage) {
            page.classList.remove('inactive-page');
            page.classList.add('active-page');
        } else {
            page.classList.remove('active-page');
            page.classList.add('inactive-page');
        }
    });

    switch (footerEl.pageId) {
        case 'addExpPage':
            resetAddExpEls();
            break;
        case 'modExpPage':
            resetModExpEls();
            await trgChngEventForEl(modExpPageEl.dateInput);
            break;
        case 'sumExpPage':
            changeSelectionFunc2(sumExpPageEl.expSummryDuration, 'This Month');
            await trgChngEventForEl(sumExpPageEl.expSummryDuration);
            break;

    }

    footerEl.icons.forEach(icon => {
        icon.classList.remove('active');
    });

    const activeIcon = document.getElementById(`${footerEl.pageId.replace('Page', 'Icon')}`);
    activeIcon.classList.add('active');
}

await showPage();

async function importBackup() {
    // Trigger the file input
    document.getElementById('importFile').click();
}

// Handle the file selection and import
async function selectFileAndImport(event) {
    const file = event.target.files[0]; // Get the selected file

    if (file) {
        const reader = new FileReader();
        
        // Read the file content
        reader.onload = function(e) {
            try {
                const jsonData = JSON.parse(e.target.result); // Parse JSON file

                // Call function to update IndexedDB with the imported data
                importToIndexedDB(jsonData);
            } catch (error) {
                console.error('Error parsing JSON file:', error);
            }
        };
        
        // Read the file as text
        reader.readAsText(file);
    }
}

async function exportBackup() {
    try {
        const expenses = await exportFromIndexedDB();
        downloadJSON(expenses, 'expenses.json');
    } catch (error) {
        console.error('Error exporting JSON file:', error);
    }
}

function downloadJSON(data, filename) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}