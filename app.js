// Daily Allowance Tracker - Main Application
// All data stored in Firestore instead of localStorage
// ============================================================================
// PART 1 OF 3
// ============================================================================

// ============================================================================
// COLOR SCHEME FUNCTIONS
// ============================================================================

function getBalanceColor(balance) {
    if (!data.colorScheme) {
        return balance >= 0 ? '#4ade80' : '#f87171';
    }
    const ranges = balance >= 0 ? data.colorScheme.positive : data.colorScheme.negative;
    for (let range of ranges) {
        if (balance >= range.min && balance <= range.max) return range.color;
    }
    return balance >= 0 ? '#4ade80' : '#f87171';
}

function addColorRange(type) {
    const minInput   = document.getElementById(`${type}Min`);
    const maxInput   = document.getElementById(`${type}Max`);
    const colorInput = document.getElementById(`${type}Color`);
    const min = parseFloat(minInput.value);
    const max = parseFloat(maxInput.value);
    const color = colorInput.value;
    if (isNaN(min) || isNaN(max)) { alert('Please enter valid numbers for min and max'); return; }
    if (min > max) { alert('Min must be less than or equal to max'); return; }
    if (type === 'positive' && (min < 0 || max < 0)) { alert('Positive ranges must have values >= 0'); return; }
    if (type === 'negative' && (min > 0 || max > 0)) { alert('Negative ranges must have values <= 0'); return; }
    data.colorScheme[type].push({ min, max, color });
    data.colorScheme[type].sort((a, b) => a.min - b.min);
    minInput.value = '';
    maxInput.value = '';
    colorInput.value = '#000000';
    saveAndUpdate();
}

function deleteColorRange(type, index) {
    data.colorScheme[type].splice(index, 1);
    saveAndUpdate();
}

function editColorRange(type, index) {
    const range = data.colorScheme[type][index];
    range.editing = true;
    updateDisplay();
}

function saveColorRange(type, index) {
    const range = data.colorScheme[type][index];
    const min   = parseFloat(document.getElementById(`edit-${type}-min-${index}`).value);
    const max   = parseFloat(document.getElementById(`edit-${type}-max-${index}`).value);
    const color = document.getElementById(`edit-${type}-color-${index}`).value;
    if (isNaN(min) || isNaN(max)) { alert('Please enter valid numbers'); return; }
    if (min > max) { alert('Min must be less than or equal to max'); return; }
    range.min = min; range.max = max; range.color = color; range.editing = false;
    data.colorScheme[type].sort((a, b) => a.min - b.min);
    saveAndUpdate();
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

async function signIn() {
    const email    = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    if (!email || !password) { alert('Please enter email and password'); return; }
    if (!window.auth) { alert('Firebase not initialized. Please refresh the page.'); return; }
    try {
        await window.auth.signInWithEmailAndPassword(email, password);
        console.log('Sign in successful');
    } catch (error) {
        console.error('Sign in error:', error);
        alert(getErrorMessage(error));
    }
}

async function signUp() {
    const email    = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    if (!email || !password) { alert('Please enter email and password'); return; }
    if (password.length < 6) { alert('Password must be at least 6 characters'); return; }
    if (!window.auth) { alert('Firebase not initialized. Please refresh the page.'); return; }
    try {
        await window.auth.createUserWithEmailAndPassword(email, password);
        alert('Account created successfully!');
    } catch (error) {
        console.error('Sign up error:', error);
        alert(getErrorMessage(error));
    }
}

async function signOut() {
    try {
        await auth.signOut();
        data = getDefaultData();
    } catch (error) {
        console.error('Sign out error:', error);
        alert('Error signing out: ' + error.message);
    }
}

function getErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Email already registered',
        'auth/invalid-email':        'Invalid email address',
        'auth/weak-password':        'Password too weak',
        'auth/user-not-found':       'No account found',
        'auth/wrong-password':       'Incorrect password',
        'auth/invalid-credential':   'Invalid email or password'
    };
    return messages[error.code] || error.message;
}

// ============================================================================
// FIRESTORE DATA FUNCTIONS
// ============================================================================

function getUserDocRef() {
    if (!window.currentUser) return null;
    return db.collection('dailyAllowanceTracker').doc(window.currentUser.uid);
}

async function loadUserData() {
    const docRef = getUserDocRef();
    if (!docRef) return;

    try {
        const doc = await docRef.get();
        if (doc.exists) {
            const firestoreData = doc.data();
            console.log('Loaded data from Firestore');

            const defaults = getDefaultData();
            data = {
                ...defaults,
                ...firestoreData,
                sectionVisibility: {
                    ...defaults.sectionVisibility,
                    ...(firestoreData.sectionVisibility || {})
                },
                categoryVisibility: firestoreData.categoryVisibility || {},
                incomeEntries: Array.isArray(firestoreData.incomeEntries) ? firestoreData.incomeEntries : defaults.incomeEntries,
                billableTotal: firestoreData.billableTotal != null ? firestoreData.billableTotal : defaults.billableTotal,
                sectionTitles: { ...defaults.sectionTitles, ...(firestoreData.sectionTitles || {}) }
            };
        } else {
            console.log('No data in Firestore, using defaults');
            data = getDefaultData();
            await saveAndUpdate();
        }

        document.getElementById('dailyAllowance').value = data.dailyAllowance;
        document.getElementById('startDate').value      = data.startDate;
        document.getElementById('spendingDate').value   = new Date().toISOString().split('T')[0];
        document.getElementById('it-date').value        = new Date().toISOString().split('T')[0];

        updateDisplay();
    } catch (error) {
        console.error('Error loading from Firestore:', error);
        data = getDefaultData();
        updateDisplay();
    }
}

async function saveData() {
    const docRef = getUserDocRef();
    if (!docRef) { console.log('No user, skipping Firestore save'); return; }
    try {
        await docRef.set(data);
        console.log('Data saved to Firestore');
    } catch (error) {
        console.error('Error saving to Firestore:', error);
        alert('Error saving data. Please try again.');
    }
}

async function saveAndUpdate() {
    await saveData();
    updateDisplay();
}

// ============================================================================
// DATA MODEL
// ============================================================================

function getDefaultData() {
    return {
        dailyAllowance:    20,
        startDate:         new Date().toISOString().split('T')[0],
        lastAllowanceDate: new Date().toISOString().split('T')[0],
        lastLogCheck:      null,
        totalAccumulated:  20,
        spending:          [],
        proposed:          [],
        wishlist:          [],
        wishlistCategories: [{ id: 1, name: 'Unassigned', order: 0 }],
        allowanceHistory:  [],
        allowanceLog:      [],
        colorScheme: {
            positive: [
                { min: 0,       max: 20,     color: '#3b82f6' },
                { min: 21,      max: 50,     color: '#10b981' },
                { min: 51,      max: 999999, color: '#8b5cf6' }
            ],
            negative: [
                { min: -20,     max: -1,     color: '#f59e0b' },
                { min: -50,     max: -21,    color: '#ef4444' },
                { min: -999999, max: -51,    color: '#7f1d1d' }
            ]
        },
        sectionVisibility: {
            proposedPurchases:     true,
            wishList:              true,
            recordSpending:        true,
            settings:              true,
            allowanceHistory:      true,
            allowanceLog:          true,
            categoryManagement:    true,
            colorScheme:           true,
            incomeTracker:         true,
            incomeEntries:         true,
            sectionTitles:         true,
            bizExpenses:           true,
            bizCategoryManagement: true
        },
        categoryVisibility:    {},
        incomeEntries:         [],
        billableTotal:         0,
        bizExpenses:           [],
        bizExpenseCategories:  [{ id: 1, name: 'Unassigned', order: 0 }],
        bizCategoryVisibility: {},
        sectionTitles: {
            proposedPurchases: '🛒 Proposed Purchases',
            wishList:          '⭐ Non Monthlies',
            recordSpending:    '💳 Record Spending',
            incomeTracker:     '📈 Income Tracker',
            settings:          '⚙️ Settings'
        }
    };
}

let data = getDefaultData();

// ============================================================================
// SECTION TOGGLE FUNCTIONS
// ============================================================================

function toggleSection(sectionName) {
    data.sectionVisibility[sectionName] = !data.sectionVisibility[sectionName];
    updateSectionVisibility();
    const docRef = getUserDocRef();
    if (docRef) docRef.update({ sectionVisibility: data.sectionVisibility });
}

function updateSectionVisibility() {
    const sections = [
        { name: 'proposedPurchases',    contentId: 'proposedPurchasesContent' },
        { name: 'wishList',             contentId: 'wishListContent' },
        { name: 'recordSpending',       contentId: 'recordSpendingContent' },
        { name: 'settings',             contentId: 'settingsContent' },
        { name: 'allowanceHistory',     contentId: 'allowanceHistoryContent' },
        { name: 'allowanceLog',         contentId: 'allowanceLogContent' },
        { name: 'categoryManagement',   contentId: 'categoryManagementContent' },
        { name: 'colorScheme',          contentId: 'colorSchemeContent' },
        { name: 'incomeTracker',        contentId: 'incomeTrackerContent' },
        { name: 'incomeEntries',        contentId: 'incomeEntriesContent' },
        { name: 'sectionTitles',        contentId: 'sectionTitlesContent' },
        
        
    ];

    sections.forEach(section => {
        const content = document.getElementById(section.contentId);
        if (!content) return;
        const button = content.previousElementSibling
            ? content.previousElementSibling.querySelector('.toggle-btn')
            : null;
        if (data.sectionVisibility[section.name]) {
            content.classList.remove('hidden');
            if (button) button.textContent = 'Hide';
        } else {
            content.classList.add('hidden');
            if (button) button.textContent = 'Show';
        }
    });
}

// ============================================================================
// SETTINGS FUNCTIONS
// ============================================================================

function updateSettings() {
    const newAllowance = parseFloat(document.getElementById('dailyAllowance').value) || 0;
    const oldAllowance = data.dailyAllowance;
    if (newAllowance !== oldAllowance) {
        data.allowanceHistory.push({
            id: Date.now(),
            date: new Date().toISOString().split('T')[0],
            amount: newAllowance,
            previousAmount: oldAllowance
        });
    }
    data.dailyAllowance = newAllowance;
    data.startDate = document.getElementById('startDate').value;
    saveAndUpdate();
}

// ============================================================================
// DATE/TIME FUNCTIONS
// ============================================================================

function getPSTDate() {
    const now = new Date();
    const year  = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day   = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================================================
// ALLOWANCE LOG FUNCTIONS
// ============================================================================

function shouldCheckForNewEntries() {
    const todayPST = getPSTDate();
    if (!data.lastLogCheck) return true;
    if (data.lastLogCheck !== todayPST) return true;
    return false;
}

function generateDailyLogEntries() {
    const todayPST = getPSTDate();
    if (!shouldCheckForNewEntries()) {
        console.log('Already checked for new allowance entries today, skipping');
        return;
    }
    console.log('Checking for new allowance entries...');
    const startDate   = new Date(data.startDate + 'T00:00:00');
    const currentDate = new Date(todayPST + 'T00:00:00');
    const existingLogDates = new Set(data.allowanceLog.map(log => log.date));
    const allDates = [];
    for (let d = new Date(startDate); d <= currentDate; d.setDate(d.getDate() + 1)) {
        allDates.push(d.toISOString().split('T')[0]);
    }
    let entriesAdded = 0;
    allDates.forEach(dateStr => {
        if (!existingLogDates.has(dateStr)) {
            const applicableRate = getDailyAllowanceForDate(dateStr);
            data.allowanceLog.push({
                id: Date.now() + entriesAdded,
                timestamp: new Date(dateStr + 'T05:00:00').toISOString(),
                date: dateStr,
                amountAdded: applicableRate,
                autoGenerated: true,
                editing: false
            });
            entriesAdded++;
        }
    });
    data.allowanceLog.sort((a, b) => a.date.localeCompare(b.date));
    let runningTotal = 0;
    data.allowanceLog.forEach(entry => {
        runningTotal += entry.amountAdded;
        entry.newAccumulated = runningTotal;
    });
    if (data.allowanceLog.length > 0) {
        data.totalAccumulated = data.allowanceLog[data.allowanceLog.length - 1].newAccumulated;
    }
    data.lastLogCheck = todayPST;
    if (entriesAdded > 0) saveData();
}

function getDailyAllowanceForDate(dateStr) {
    const relevantChanges = data.allowanceHistory
        .filter(change => change.date <= dateStr)
        .sort((a, b) => b.date.localeCompare(a.date));
    if (relevantChanges.length > 0) return relevantChanges[0].amount;
    return data.dailyAllowance;
}

function regenerateLogTotals() {
    data.allowanceLog.sort((a, b) => a.date.localeCompare(b.date));
    let runningTotal = 0;
    data.allowanceLog.forEach(entry => {
        runningTotal += entry.amountAdded;
        entry.newAccumulated = runningTotal;
    });
    if (data.allowanceLog.length > 0) {
        data.totalAccumulated = data.allowanceLog[data.allowanceLog.length - 1].newAccumulated;
    }
}

function addAllowanceLog() {
    const dateInput = document.getElementById('logDate').value;
    const amount    = parseFloat(document.getElementById('logAmount').value);
    if (!dateInput || amount < 0 || isNaN(amount)) { alert('Please fill in date and amount'); return; }
    const existingIndex = data.allowanceLog.findIndex(log => log.date === dateInput);
    if (existingIndex !== -1) { alert('An entry for this date already exists. Please edit or delete it first.'); return; }
    data.allowanceLog.push({
        id: Date.now(),
        timestamp: new Date(dateInput + 'T05:00:00').toISOString(),
        date: dateInput,
        amountAdded: amount,
        manualEntry: true
    });
    document.getElementById('logDate').value   = '';
    document.getElementById('logAmount').value = '';
    regenerateLogTotals();
    saveAndUpdate();
}

function editAllowanceLog(id) {
    const item = data.allowanceLog.find(item => item.id === id);
    if (!item) return;
    item.editing = true;
    renderAllowanceLog();
}

function saveAllowanceLog(id) {
    const item = data.allowanceLog.find(item => item.id === id);
    if (!item) return;
    const newDate   = document.getElementById(`log-date-${id}`).value;
    const newAmount = parseFloat(document.getElementById(`log-amount-${id}`).value);
    if (!newDate || newAmount < 0 || isNaN(newAmount)) { alert('Please enter valid values'); return; }
    const existingEntry = data.allowanceLog.find(log => log.date === newDate && log.id !== id);
    if (existingEntry) { alert('An entry for this date already exists.'); return; }
    item.date        = newDate;
    item.timestamp   = new Date(newDate + 'T05:00:00').toISOString();
    item.amountAdded = newAmount;
    item.editing     = false;
    regenerateLogTotals();
    saveAndUpdate();
}

function deleteAllowanceLog(id) {
    data.allowanceLog = data.allowanceLog.filter(item => item.id !== id);
    regenerateLogTotals();
    saveAndUpdate();
}

// ============================================================================
// ALLOWANCE HISTORY FUNCTIONS
// ============================================================================

function addAllowanceHistory() {
    const dateInput = document.getElementById('historyDate').value;
    const amount    = parseFloat(document.getElementById('historyAmount').value);
    if (!dateInput || !amount || amount <= 0) { alert('Please fill in date and amount'); return; }
    data.allowanceHistory.push({ id: Date.now(), date: dateInput, amount: amount, previousAmount: null });
    document.getElementById('historyDate').value   = '';
    document.getElementById('historyAmount').value = '';
    data.allowanceHistory.sort((a, b) => a.date.localeCompare(b.date));
    saveAndUpdate();
}

function editAllowanceHistory(id) {
    const item = data.allowanceHistory.find(item => item.id === id);
    if (!item) return;
    item.editing = true;
    updateDisplay();
}

function saveAllowanceHistory(id) {
    const item = data.allowanceHistory.find(item => item.id === id);
    if (!item) return;
    const newDate   = document.getElementById(`history-date-${id}`).value;
    const newAmount = parseFloat(document.getElementById(`history-amount-${id}`).value);
    if (!newDate || !newAmount || newAmount <= 0) { alert('Please enter valid date and amount'); return; }
    item.date    = newDate;
    item.amount  = newAmount;
    item.editing = false;
    saveAndUpdate();
}

function deleteAllowanceHistory(id) {
    data.allowanceHistory = data.allowanceHistory.filter(item => item.id !== id);
    saveAndUpdate();
}

// ============================================================================
// SPENDING FUNCTIONS
// ============================================================================

function calculateTotalSpent() {
    return data.spending.reduce((sum, item) => sum + item.amount, 0);
}

function addSpending() {
    const name         = document.getElementById('spendingName').value.trim();
    const amount       = parseFloat(document.getElementById('spendingAmount').value);
    const dateInput    = document.getElementById('spendingDate').value;
    const nonMonthlyId = parseInt(document.getElementById('spendingNonMonthly').value) || null;
    if (!name || !amount || amount <= 0 || !dateInput) { alert('Please fill in all spending fields'); return; }
    data.spending.push({ id: Date.now(), name, amount, date: dateInput, nonMonthlyId });
    document.getElementById('spendingName').value       = '';
    document.getElementById('spendingAmount').value     = '';
    document.getElementById('spendingNonMonthly').value = '';
    saveAndUpdate();
}

function deleteSpending(id) {
    data.spending = data.spending.filter(item => item.id !== id);
    saveAndUpdate();
}

function editSpending(id) {
    const item = data.spending.find(item => item.id === id);
    if (!item) return;
    item.editing = true;
    updateDisplay();
}

function saveSpending(id) {
    const item = data.spending.find(item => item.id === id);
    if (!item) return;
    const newName   = document.getElementById(`spending-name-${id}`).value.trim();
    const newAmount = parseFloat(document.getElementById(`spending-amount-${id}`).value);
    if (!newName || !newAmount || newAmount <= 0) { alert('Please enter valid name and amount'); return; }
    item.name    = newName;
    item.amount  = newAmount;
    item.editing = false;
    saveAndUpdate();
}

// ============================================================================
// PROPOSED PURCHASES FUNCTIONS
// ============================================================================

function addProposed() {
    const name   = document.getElementById('proposedName').value.trim();
    const amount = parseFloat(document.getElementById('proposedAmount').value);
    if (!name || !amount || amount <= 0) { alert('Please fill in all proposed purchase fields'); return; }
    data.proposed.push({ id: Date.now(), name, amount });
    document.getElementById('proposedName').value   = '';
    document.getElementById('proposedAmount').value = '';
    saveAndUpdate();
}

function deleteProposed(id) {
    data.proposed = data.proposed.filter(item => item.id !== id);
    saveAndUpdate();
}

function editProposed(id) {
    const item = data.proposed.find(item => item.id === id);
    if (!item) return;
    item.editing = true;
    updateDisplay();
}

function saveProposed(id) {
    const item = data.proposed.find(item => item.id === id);
    if (!item) return;
    const newName   = document.getElementById(`proposed-name-${item.id}`).value.trim();
    const newAmount = parseFloat(document.getElementById(`proposed-amount-${item.id}`).value);
    if (!newName || !newAmount || newAmount <= 0) { alert('Please enter valid name and amount'); return; }
    item.name    = newName;
    item.amount  = newAmount;
    item.editing = false;
    saveAndUpdate();
}

function moveProposedToWishlist(id) {
    const item = data.proposed.find(item => item.id === id);
    if (!item) return;
    data.wishlist.push({ id: Date.now(), name: item.name, amount: item.amount, categoryId: 1 });
    data.proposed = data.proposed.filter(item => item.id !== id);
    saveAndUpdate();
}

// ============================================================================
// WISHLIST & CATEGORY FUNCTIONS
// ============================================================================

function addCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    if (!name) { alert('Please enter a category name'); return; }
    const newId = Math.max(...data.wishlistCategories.map(c => c.id), 0) + 1;
    data.wishlistCategories.push({ id: newId, name, order: data.wishlistCategories.length });
    document.getElementById('newCategoryName').value = '';
    saveAndUpdate();
}

function deleteCategory(id) {
    if (id === 1) { alert('Cannot delete the Unassigned category'); return; }
    data.wishlist.forEach(item => { if (item.categoryId === id) item.categoryId = 1; });
    data.wishlistCategories = data.wishlistCategories.filter(cat => cat.id !== id);
    saveAndUpdate();
}

function editCategory(id) {
    const category = data.wishlistCategories.find(cat => cat.id === id);
    if (!category) return;
    category.editing = true;
    updateDisplay();
}

function saveCategory(id) {
    const category = data.wishlistCategories.find(cat => cat.id === id);
    if (!category) return;
    const newName = document.getElementById(`category-name-${id}`).value.trim();
    if (!newName) { alert('Please enter a valid category name'); return; }
    category.name    = newName;
    category.editing = false;
    saveAndUpdate();
}

function changeItemCategory(itemId, newCategoryId) {
    const item = data.wishlist.find(item => item.id === itemId);
    if (!item) return;
    item.categoryId = parseInt(newCategoryId);
    saveAndUpdate();
}

function toggleCategory(categoryId) {
    const element = document.getElementById(`category-items-${categoryId}`);
    const button  = document.getElementById(`category-toggle-${categoryId}`);
    if (element) {
        element.classList.toggle('hidden');
        const isHidden = element.classList.contains('hidden');
        data.categoryVisibility[categoryId] = !isHidden;
        if (button) button.textContent = isHidden ? 'Show' : 'Hide';
        const docRef = getUserDocRef();
        if (docRef) docRef.update({ categoryVisibility: data.categoryVisibility });
    }
}

function addWishlist() {
    const name       = document.getElementById('wishlistName').value.trim();
    const amount     = parseFloat(document.getElementById('wishlistAmount').value);
    const categoryId = parseInt(document.getElementById('wishlistCategory').value);
    if (!name || !amount || amount <= 0 || !categoryId) { alert('Please fill in all fields including category'); return; }
    data.wishlist.push({ id: Date.now(), name, amount, categoryId });
    document.getElementById('wishlistName').value     = '';
    document.getElementById('wishlistAmount').value   = '';
    document.getElementById('wishlistCategory').value = '';
    saveAndUpdate();
}

function deleteWishlist(id) {
    data.wishlist = data.wishlist.filter(item => item.id !== id);
    saveAndUpdate();
}

function editWishlist(id) {
    const item = data.wishlist.find(item => item.id === id);
    if (!item) return;
    item.editing = true;
    updateDisplay();
}

function saveWishlist(id) {
    const item = data.wishlist.find(item => item.id === id);
    if (!item) return;
    const newName   = document.getElementById(`wishlist-name-${item.id}`).value.trim();
    const newAmount = parseFloat(document.getElementById(`wishlist-amount-${item.id}`).value);
    if (!newName || !newAmount || newAmount <= 0) { alert('Please enter valid name and amount'); return; }
    item.name    = newName;
    item.amount  = newAmount;
    item.editing = false;
    saveAndUpdate();
}

function moveWishlistToProposed(id) {
    const item = data.wishlist.find(item => item.id === id);
    if (!item) return;
    data.proposed.push({ id: Date.now(), name: item.name, amount: item.amount });
    saveAndUpdate();
}

// ============================================================================
// END OF PART 1 — continue with app-part2.js
// ============================================================================
// ============================================================================
// PART 2 OF 3
// Display / Render functions + Timeline CSV Export
// ============================================================================

function updateDisplay() {
    try { generateDailyLogEntries(); } catch(e) { console.error('generateDailyLogEntries failed:', e); }
    const accumulated = data.totalAccumulated;
    const spent       = calculateTotalSpent();
    const available   = accumulated - spent;

    document.getElementById('totalAccumulated').textContent = `$${accumulated.toFixed(2)}`;
    document.getElementById('totalSpent').textContent       = `$${spent.toFixed(2)}`;

    const availableBalanceDiv = document.getElementById('availableBalance');
    const balanceColor = getBalanceColor(available);
    availableBalanceDiv.innerHTML = `<span style="color: ${balanceColor}; font-weight: bold;">$${available.toFixed(2)}</span>`;

    try { renderSpendingList(); } catch(e) { console.error('renderSpendingList failed:', e); }
    try { renderProposedList(available); } catch(e) { console.error('renderProposedList failed:', e); }
    try { renderWishlist(); } catch(e) { console.error('renderWishlist failed:', e); }
    try { renderCategoriesManagement(); } catch(e) { console.error('renderCategoriesManagement failed:', e); }
    try { renderAllowanceHistory(); } catch(e) { console.error('renderAllowanceHistory failed:', e); }
    try { renderAllowanceLog(); } catch(e) { console.error('renderAllowanceLog failed:', e); }
    try { renderColorScheme(); } catch(e) { console.error('renderColorScheme failed:', e); }
    try { renderIncomeTracker(); } catch(e) { console.error('renderIncomeTracker failed:', e); }
    try { renderSectionTitles(); } catch(e) { console.error('renderSectionTitles failed:', e); }
    try { updateSectionVisibility(); } catch(e) { console.error('updateSectionVisibility failed:', e); }
}

function renderSpendingList() {
    const spendingList = document.getElementById('spendingList');
    spendingList.innerHTML = data.spending
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(item => {
            const [year, month, day] = item.date.split('-');
            const formattedDate = `${month}/${day}/${year}`;
            if (item.editing) {
                return `
                    <li class="item editing">
                        <div class="item-details">
                            <input type="text" id="spending-name-${item.id}" class="edit-name-input" value="${item.name}">
                            <input type="number" id="spending-amount-${item.id}" class="edit-amount-input" value="${item.amount}" step="0.01" min="0">
                        </div>
                        <div class="item-buttons">
                            <button class="save-btn" onclick="saveSpending(${item.id})">Save</button>
                            <button class="delete-btn" onclick="deleteSpending(${item.id})">Delete</button>
                        </div>
                    </li>`;
            } else {
                const nmCat = item.nonMonthlyId
                    ? (data.wishlistCategories || []).find(c => c.id === item.nonMonthlyId)
                    : null;
                return `
                    <li class="item">
                        <div class="item-details">
                            <div class="item-name">${item.name}${nmCat ? ` <span style="color:#667eea;font-size:0.8em;">→ ${nmCat.name}</span>` : ''}</div>
                            <div class="item-date">${formattedDate}</div>
                        </div>
                        <span class="item-amount">$${item.amount.toFixed(2)}</span>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editSpending(${item.id})">Edit</button>
                            <button class="delete-btn" onclick="deleteSpending(${item.id})">Delete</button>
                        </div>
                    </li>`;
            }
        }).join('');
}

function renderProposedList(available) {
    const proposedList  = document.getElementById('proposedList');
    let runningBalance  = available;
    const totalProposed = data.proposed.reduce((sum, item) => sum + item.amount, 0);

    proposedList.innerHTML = data.proposed.map(item => {
        const canAfford = runningBalance >= item.amount;
        if (canAfford) runningBalance -= item.amount;
        if (item.editing) {
            return `
                <li class="item proposed-item ${canAfford ? 'can-afford' : 'cannot-afford'} editing">
                    <div class="item-details">
                        <input type="text" id="proposed-name-${item.id}" class="edit-name-input" value="${item.name}">
                        <input type="number" id="proposed-amount-${item.id}" class="edit-amount-input" value="${item.amount}" step="0.01" min="0">
                    </div>
                    <div class="item-buttons">
                        <button class="save-btn" onclick="saveProposed(${item.id})">Save</button>
                        <button class="delete-btn" onclick="deleteProposed(${item.id})">Delete</button>
                    </div>
                </li>`;
        } else {
            return `
                <li class="item proposed-item ${canAfford ? 'can-afford' : 'cannot-afford'}">
                    <div class="item-details">
                        <div class="item-name">${item.name}</div>
                        <span class="afford-status ${canAfford ? 'afford-yes' : 'afford-no'}">
                            ${canAfford ? '✓ Can Afford' : '✗ Cannot Afford'}
                        </span>
                    </div>
                    <span class="item-amount">$${item.amount.toFixed(2)}</span>
                    <div class="item-buttons">
                        <button class="move-btn" onclick="moveProposedToWishlist(${item.id})">→ Wish</button>
                        <button class="edit-btn" onclick="editProposed(${item.id})">Edit</button>
                        <button class="delete-btn" onclick="deleteProposed(${item.id})">Delete</button>
                    </div>
                </li>`;
        }
    }).join('');

    const remainingAfter = available - totalProposed;
    document.getElementById('totalProposed').textContent     = `$${totalProposed.toFixed(2)}`;
    document.getElementById('proposedAvailable').textContent = `$${available.toFixed(2)}`;
    document.getElementById('remainingAfter').textContent    = `$${remainingAfter.toFixed(2)}`;
    document.getElementById('remainingAfter').className      = remainingAfter >= 0
        ? 'proposed-totals-amount totals-positive'
        : 'proposed-totals-amount totals-negative';
}

function renderWishlist() {
    const categorySelect = document.getElementById('wishlistCategory');
    categorySelect.innerHTML = '<option value="">Select category...</option>' +
        data.wishlistCategories
            .sort((a, b) => a.order - b.order)
            .map(cat => `<option value="${cat.id}">${cat.name}</option>`)
            .join('');

    const spendingSelect = document.getElementById('spendingNonMonthly');
    if (spendingSelect) {
        spendingSelect.innerHTML = '<option value="">No non-monthly</option>' +
            data.wishlistCategories
                .filter(c => c.id !== 1)
                .sort((a, b) => a.order - b.order)
                .map(c => `<option value="${c.id}">${c.name}</option>`)
                .join('');
    }

    const wishlistList = document.getElementById('wishlistList');
    let wishlistHTML = '';

    data.wishlistCategories
        .sort((a, b) => a.order - b.order)
        .forEach(category => {
            const categoryItems = data.wishlist.filter(item => item.categoryId === category.id);
            if (categoryItems.length > 0 || category.id === 1) {
                const isVisible     = data.categoryVisibility[category.id] !== false;
                const categoryTotal = categoryItems.reduce((sum, item) => sum + item.amount, 0);
                const paid          = (data.spending || [])
                    .filter(s => s.nonMonthlyId === category.id || s.nonMonthlyId === String(category.id))
                    .reduce((sum, s) => sum + s.amount, 0);
                const injections    = (data.spending || [])
                    .filter(s => s.nonMonthlyId === category.id || s.nonMonthlyId === String(category.id))
                    .sort((a, b) => b.date.localeCompare(a.date));
                const remaining     = categoryTotal - paid;
                const paidLabel     = paid > 0
                    ? `<span style="color:#10b981;font-size:0.85em;margin-right:6px;">paid $${paid.toFixed(2)}</span>
                       <span style="color:${remaining <= 0 ? '#10b981' : '#f59e0b'};font-weight:600;margin-right:10px;">left $${remaining.toFixed(2)}</span>`
                    : `<span style="font-weight:600;color:#667eea;margin-right:10px;">$${categoryTotal.toFixed(2)}</span>`;

                wishlistHTML += `
                    <div class="category-section">
                        <div class="category-header">
                            <div class="category-title" onclick="toggleCategory(${category.id})" style="cursor:pointer;flex:1;">${category.name} (${categoryItems.length})</div>
                            ${paidLabel}
                            <button id="category-toggle-${category.id}" class="toggle-btn" onclick="toggleCategory(${category.id});event.stopPropagation();" style="padding:5px 12px;font-size:0.85em;">${isVisible ? 'Hide' : 'Show'}</button>
                        </div>
                        <div id="category-items-${category.id}" class="category-items${isVisible ? '' : ' hidden'}">
                            ${categoryItems.map(item => {
                                const categoryOptions = data.wishlistCategories
                                    .sort((a, b) => a.order - b.order)
                                    .map(cat => `<option value="${cat.id}" ${cat.id === item.categoryId ? 'selected' : ''}>${cat.name}</option>`)
                                    .join('');
                                if (item.editing) {
                                    return `
                                        <div class="item category-item editing">
                                            <div class="item-details">
                                                <input type="text" id="wishlist-name-${item.id}" class="edit-name-input" value="${item.name}">
                                                <input type="number" id="wishlist-amount-${item.id}" class="edit-amount-input" value="${item.amount}" step="0.01" min="0">
                                            </div>
                                            <div class="item-buttons">
                                                <button class="save-btn" onclick="saveWishlist(${item.id})">Save</button>
                                                <button class="delete-btn" onclick="deleteWishlist(${item.id})">Delete</button>
                                            </div>
                                        </div>`;
                                } else {
                                    return `
                                        <div class="item category-item">
                                            <div class="item-details">
                                                <div class="item-name">${item.name}</div>
                                                <select onchange="changeItemCategory(${item.id}, this.value)" style="padding:5px;border:1px solid #667eea;border-radius:5px;font-size:0.85em;margin-top:5px;">
                                                    ${categoryOptions}
                                                </select>
                                            </div>
                                            <span class="item-amount">$${item.amount.toFixed(2)}</span>
                                            <div class="item-buttons">
                                                <button class="move-btn" onclick="moveWishlistToProposed(${item.id})">→ Proposed</button>
                                                <button class="edit-btn" onclick="editWishlist(${item.id})">Edit</button>
                                                <button class="delete-btn" onclick="deleteWishlist(${item.id})">Delete</button>
                                            </div>
                                        </div>`;
                                }
                            }).join('')}
                            ${categoryItems.length === 0 ? '<div style="padding:10px;color:#6b7280;font-style:italic;">No items in this category</div>' : ''}
                            ${injections.length > 0 ? `
                                <div style="border-top:1px solid #e5e7eb;margin-top:8px;padding-top:8px;">
                                    <div style="font-size:0.8em;color:#6b7280;padding:4px 10px 6px;font-style:italic;">Payments applied:</div>
                                    ${injections.map(s => {
                                        const [yr,mo,dy] = s.date.split('-');
                                        return `<div class="item category-item" style="opacity:0.8;">
                                            <div class="item-details">
                                                <div class="item-name" style="color:#10b981;">↓ ${s.name}</div>
                                                <div class="item-date">${mo}/${dy}/${yr}</div>
                                            </div>
                                            <span class="item-amount" style="color:#10b981;">-$${s.amount.toFixed(2)}</span>
                                        </div>`;
                                    }).join('')}
                                </div>` : ''}
                        </div>
                    </div>`;
            }
        });

    wishlistList.innerHTML = wishlistHTML;
}

function renderCategoriesManagement() {
    const categoriesList = document.getElementById('categoriesList');
    categoriesList.innerHTML = data.wishlistCategories
        .sort((a, b) => a.order - b.order)
        .map(cat => {
            if (cat.editing) {
                return `
                    <div class="category-management-item">
                        <input type="text" id="category-name-${cat.id}" value="${cat.name}" style="flex:1;padding:8px;border:2px solid #667eea;border-radius:5px;">
                        <div class="item-buttons">
                            <button class="save-btn" onclick="saveCategory(${cat.id})">Save</button>
                            ${cat.id !== 1 ? `<button class="delete-btn" onclick="deleteCategory(${cat.id})">Delete</button>` : ''}
                        </div>
                    </div>`;
            } else {
                return `
                    <div class="category-management-item">
                        <span style="font-weight:bold;">${cat.name}</span>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editCategory(${cat.id})">Edit</button>
                            ${cat.id !== 1 ? `<button class="delete-btn" onclick="deleteCategory(${cat.id})">Delete</button>` : ''}
                        </div>
                    </div>`;
            }
        }).join('');
}

function renderAllowanceHistory() {
    const historyList = document.getElementById('historyList');
    historyList.innerHTML = data.allowanceHistory
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(item => {
            if (item.editing) {
                return `
                    <li class="item">
                        <div class="item-details">
                            <input type="date" id="history-date-${item.id}" value="${item.date}" style="width:150px;">
                            <input type="number" id="history-amount-${item.id}" value="${item.amount}" step="0.01" min="0" style="width:100px;">
                        </div>
                        <div class="item-buttons">
                            <button class="save-btn" onclick="saveAllowanceHistory(${item.id})">Save</button>
                            <button class="delete-btn" onclick="deleteAllowanceHistory(${item.id})">Delete</button>
                        </div>
                    </li>`;
            } else {
                const [year, month, day] = item.date.split('-');
                return `
                    <li class="item">
                        <div class="item-details">
                            <div class="item-name">${month}/${day}/${year}: Changed to $${item.amount.toFixed(2)}/day${item.previousAmount !== null ? ` (was $${item.previousAmount.toFixed(2)})` : ''}</div>
                        </div>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editAllowanceHistory(${item.id})">Edit</button>
                            <button class="delete-btn" onclick="deleteAllowanceHistory(${item.id})">Delete</button>
                        </div>
                    </li>`;
            }
        }).join('');
}

function renderAllowanceLog() {
    const allowanceLogList = document.getElementById('allowanceLogList');
    if (data.allowanceLog.length === 0) {
        allowanceLogList.innerHTML = '<li class="item"><div class="item-details"><div class="item-name" style="color:#6b7280;">No daily allowance additions yet</div></div></li>';
        return;
    }
    allowanceLogList.innerHTML = data.allowanceLog
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(item => {
            const [year, month, day] = item.date.split('-');
            const formattedDate = `${month}/${day}/${year}`;
            if (item.editing) {
                return `
                    <li class="item log-item editing">
                        <div class="item-details">
                            <input type="date" id="log-date-${item.id}" value="${item.date}" style="padding:5px;border:2px solid #667eea;border-radius:5px;font-size:0.9em;">
                            <input type="number" id="log-amount-${item.id}" value="${item.amountAdded}" step="0.01" min="0" style="width:120px;padding:5px;border:2px solid #667eea;border-radius:5px;font-size:0.9em;" placeholder="Amount">
                        </div>
                        <div class="item-buttons">
                            <button class="save-btn" onclick="saveAllowanceLog(${item.id})">Save</button>
                            <button class="delete-btn" onclick="deleteAllowanceLog(${item.id})">Delete</button>
                        </div>
                    </li>`;
            } else {
                const typeLabel = item.manualEntry   ? '<span style="color:#f59e0b;font-size:0.85em;"> (Manual)</span>' :
                                  item.autoGenerated ? '<span style="color:#10b981;font-size:0.85em;"> (Auto)</span>' : '';
                return `
                    <li class="item log-item">
                        <div class="item-details">
                            <div class="item-name">${formattedDate}${typeLabel}</div>
                            <div class="item-date">Added: $${item.amountAdded.toFixed(2)} → Total Accumulated: $${item.newAccumulated.toFixed(2)}</div>
                        </div>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editAllowanceLog(${item.id})">Edit</button>
                            <button class="delete-btn" onclick="deleteAllowanceLog(${item.id})">Delete</button>
                        </div>
                    </li>`;
            }
        }).join('');
}

function renderColorScheme() {
    const positiveList = document.getElementById('positiveRangesList');
    const negativeList = document.getElementById('negativeRangesList');
    if (!positiveList || !negativeList) return;
    if (!data.colorScheme) data.colorScheme = getDefaultData().colorScheme;

    const renderRange = (type, list) => {
        list.innerHTML = data.colorScheme[type].map((range, index) => {
            if (range.editing) {
                return `
                    <li class="item">
                        <div class="item-details">
                            <input type="number" id="edit-${type}-min-${index}" value="${range.min}" step="0.01" style="width:80px;padding:5px;margin-right:5px;">
                            <span>to</span>
                            <input type="number" id="edit-${type}-max-${index}" value="${range.max}" step="0.01" style="width:80px;padding:5px;margin:0 5px;">
                            <input type="color" id="edit-${type}-color-${index}" value="${range.color}" style="width:50px;height:30px;margin-left:5px;">
                        </div>
                        <div class="item-buttons">
                            <button class="save-btn" onclick="saveColorRange('${type}', ${index})">Save</button>
                            <button class="delete-btn" onclick="deleteColorRange('${type}', ${index})">Delete</button>
                        </div>
                    </li>`;
            } else {
                return `
                    <li class="item">
                        <div class="item-details">
                            <div class="item-name">$${range.min} to $${range.max}</div>
                            <div style="width:30px;height:30px;background:${range.color};border:2px solid #333;border-radius:4px;margin-left:10px;"></div>
                        </div>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editColorRange('${type}', ${index})">Edit</button>
                            <button class="delete-btn" onclick="deleteColorRange('${type}', ${index})">Delete</button>
                        </div>
                    </li>`;
            }
        }).join('');
    };

    renderRange('positive', positiveList);
    renderRange('negative', negativeList);
}

// ============================================================================
// TIMELINE CSV EXPORT
// ============================================================================

function exportTimelineCSV() {
    const events = [];
    (data.spending || []).forEach(s => {
        if (!s.date) return;
        events.push({ date: s.date, type: 'spend', amount: s.amount, item: s.name || '' });
    });
    (data.allowanceLog || []).forEach(l => {
        if (!l.date) return;
        events.push({ date: l.date, type: 'allowance', amount: l.amountAdded, item: `+$${l.amountAdded.toFixed(2)}/day` });
    });
    if (events.length === 0) { alert('No spending or allowance data to export yet.'); return; }

    events.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        if (a.type === 'allowance' && b.type !== 'allowance') return -1;
        if (b.type === 'allowance' && a.type !== 'allowance') return  1;
        return 0;
    });

    let runningAccumulated = 0, runningSpent = 0;
    events.forEach(e => {
        if (e.type === 'allowance') runningAccumulated += e.amount;
        else runningSpent += e.amount;
        e.balance = runningAccumulated - runningSpent;
    });

    const escapeCSV = val => {
        const s = String(val);
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    };

    let csv = 'Date,Type,Amount,Item,Balance\n';
    events.forEach(e => {
        csv += [escapeCSV(e.date), escapeCSV(e.type), escapeCSV(e.amount.toFixed(2)), escapeCSV(e.item), escapeCSV(e.balance.toFixed(2))].join(',') + '\n';
    });

    navigator.clipboard.writeText(csv).then(() => {
        alert(`✅ Timeline CSV copied to clipboard!\n${events.length} events exported.\n\nPaste it into the Allowance section of the Timeline Viewer.`);
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = csv;
        ta.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);width:600px;height:300px;z-index:9999;font-family:monospace;font-size:12px;padding:10px;border:2px solid #667eea;border-radius:8px;';
        document.body.appendChild(ta);
        ta.select();
        alert('Clipboard access blocked. The CSV is selected below — press Ctrl+C (or Cmd+C) to copy, then close this box.');
        ta.addEventListener('blur', () => document.body.removeChild(ta));
    });
}

console.log('Allowance Tracker app loaded - waiting for auth...');

// ============================================================================
// END OF PART 2 — continue with app-part3.js
// ============================================================================
// ============================================================================
// PART 3 OF 3
// Income Tracker, Business Expenses, Section Titles
// ============================================================================

// ============================================================================
// INCOME TRACKER FUNCTIONS
// ============================================================================

function addIncomeEntry() {
    const source = document.getElementById('it-source').value.trim();
    const amount = parseFloat(document.getElementById('it-amount').value);
    const date   = document.getElementById('it-date').value;
    const note   = document.getElementById('it-note').value.trim();
    if (!source) { alert('Please enter a source.'); return; }
    if (isNaN(amount)) { alert('Please enter a valid amount.'); return; }
    if (!date) { alert('Please select a date.'); return; }
    if (!data.incomeEntries) data.incomeEntries = [];
    data.incomeEntries.push({ id: Date.now().toString(), source, amount, date, note });
    document.getElementById('it-source').value = '';
    document.getElementById('it-amount').value = '';
    document.getElementById('it-note').value   = '';
    saveAndUpdate();
}

function editIncomeEntry(id) {
    const entry = (data.incomeEntries || []).find(e => e.id === id);
    if (!entry) return;
    entry.editing = true;
    renderIncomeTracker();
}

function saveIncomeEntry(id) {
    const entry = (data.incomeEntries || []).find(e => e.id === id);
    if (!entry) return;
    const source = document.getElementById(`inc-source-${id}`).value.trim();
    const amount = parseFloat(document.getElementById(`inc-amount-${id}`).value);
    const date   = document.getElementById(`inc-date-${id}`).value;
    const note   = document.getElementById(`inc-note-${id}`).value.trim();
    if (!source) { alert('Please enter a source.'); return; }
    if (isNaN(amount)) { alert('Please enter a valid amount.'); return; }
    if (!date) { alert('Please select a date.'); return; }
    entry.source  = source;
    entry.amount  = amount;
    entry.date    = date;
    entry.note    = note;
    entry.editing = false;
    saveAndUpdate();
}

// FIX: this function was broken in the buggy version — its opening line was missing,
// leaving orphaned code that caused a JS syntax error crashing the entire script.
function deleteIncomeEntry(id) {
    data.incomeEntries = (data.incomeEntries || []).filter(e => e.id !== id);
    saveAndUpdate();
}

function saveIncomeBillable() {
    data.billableTotal = parseFloat(document.getElementById('it-billableTotal').value) || 0;
    saveData();
    renderIncomeTracker();
}

function renderIncomeTracker() {
    const entries  = data.incomeEntries || [];
    const billable = data.billableTotal || 0;
    const bankTotal     = entries.reduce((s, e) => s + e.amount, 0);
    const bankDaily     = bankTotal / 365;
    const combinedDaily = (bankTotal + billable) / 365;

    document.getElementById('it-bankTotal').textContent     = `$${bankTotal.toFixed(2)}`;
    document.getElementById('it-bankDaily').textContent     = `$${bankDaily.toFixed(2)}`;
    document.getElementById('it-combinedDaily').textContent = `$${combinedDaily.toFixed(2)}`;
    document.getElementById('it-entryCount').textContent    = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;

    const billableInput = document.getElementById('it-billableTotal');
    if (document.activeElement !== billableInput) billableInput.value = billable || '';

    document.getElementById('it-dailyRateLabel').textContent = `$${combinedDaily.toFixed(2)} / day`;

    const MAX_DAILY = 100;
    const maxAmount = MAX_DAILY * 365;
    const bar = document.getElementById('it-stackedBar');
    const sortedEntries = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));
    const segments = [];
    sortedEntries.forEach(e => segments.push({ ...e, isBillable: false }));
    if (billable > 0) segments.push({ label: 'Billable estimate', amount: billable, date: '—', note: '', isBillable: true });

    bar.innerHTML = segments.map((seg, i) => {
        const pct    = Math.min((seg.amount / maxAmount) * 100, 100);
        const bg     = seg.isBillable ? '#667eea' : (i % 2 === 0 ? '#374151' : '#9ca3af');
        const dateStr = (seg.date && seg.date !== '—')
            ? seg.date.split('-').slice(1).join('/') + '/' + seg.date.split('-')[0]
            : '—';
        const tip = encodeURIComponent(`${seg.source || seg.label} · $${seg.amount.toFixed(2)} · ${dateStr}${seg.note ? ' · ' + seg.note : ''}`);
        return `<div style="width:${pct}%; background:${bg}; height:100%; cursor:pointer; min-width:${pct > 0 ? '3px' : '0'};"
            onmouseenter="showItTip(event,'${tip}')"
            onmouseleave="hideItTip()"></div>`;
    }).join('');

    const marker60 = document.getElementById('it-marker60');
    const marker80 = document.getElementById('it-marker80');
    marker60.style.left    = (60 / MAX_DAILY * 100) + '%';
    marker60.style.display = '';
    marker80.style.left    = (80 / MAX_DAILY * 100) + '%';
    marker80.style.display = '';

    const list  = document.getElementById('it-logList');
    const empty = document.getElementById('it-empty');

    if (entries.length === 0) {
        empty.style.display = '';
        list.innerHTML = '';
        return;
    }
    empty.style.display = 'none';

    const sortedDesc = [...entries].sort((a, b) => new Date(b.date) - new Date(a.date));
    list.innerHTML = sortedDesc.map(e => {
        if (e.editing) {
            return `
        <li class="item editing">
            <div class="item-details">
                <input type="text"   id="inc-source-${e.id}" value="${e.source}"     class="edit-name-input"   placeholder="Source">
                <input type="number" id="inc-amount-${e.id}" value="${e.amount}"     class="edit-amount-input" step="0.01">
                <input type="date"   id="inc-date-${e.id}"   value="${e.date}"       style="padding:5px;border:2px solid #667eea;border-radius:5px;">
                <input type="text"   id="inc-note-${e.id}"   value="${e.note || ''}" class="edit-name-input"   placeholder="Note">
            </div>
            <div class="item-buttons">
                <button class="save-btn"   onclick="saveIncomeEntry('${e.id}')">Save</button>
                <button class="delete-btn" onclick="deleteIncomeEntry('${e.id}')">Delete</button>
            </div>
        </li>`;
        } else {
            return `
        <li class="item">
            <div class="item-details">
                <div class="item-name">${e.source}${e.note ? ' <span style="color:#9ca3af;font-size:0.85em;">— ' + e.note + '</span>' : ''}</div>
                <div style="color:#9ca3af;font-size:0.8em;">${formatIncomeDate(e.date)}</div>
            </div>
            <span class="item-amount" style="color:${e.amount < 0 ? '#f87171' : 'inherit'}">$${e.amount.toFixed(2)}</span>
            <div class="item-buttons">
                <button class="edit-btn"   onclick="editIncomeEntry('${e.id}')">Edit</button>
                <button class="delete-btn" onclick="deleteIncomeEntry('${e.id}')">Delete</button>
            </div>
        </li>`;
        }
    }).join('');
}

function formatIncomeDate(d) {
    if (!d) return '—';
    const [y, m, day] = d.split('-');
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return `${months[parseInt(m) - 1]} ${parseInt(day)}, ${y}`;
}

function showItTip(event, encoded) {
    const tip = document.getElementById('it-barTooltip');
    tip.textContent    = decodeURIComponent(encoded);
    tip.style.display  = 'block';
    tip.style.left     = Math.min(event.clientX + 12, window.innerWidth - 200) + 'px';
    tip.style.top      = (event.clientY - 40) + 'px';
}

function hideItTip() {
    const tip = document.getElementById('it-barTooltip');
    if (tip) tip.style.display = 'none';
}

// ============================================================================
// BUSINESS EXPENSES FUNCTIONS
// ============================================================================

function addBizExpense() {
    const name       = document.getElementById('bizExpenseName').value.trim();
    const amount     = parseFloat(document.getElementById('bizExpenseAmount').value);
    const categoryId = parseInt(document.getElementById('bizExpenseCategory').value);
    if (!name || !amount || amount <= 0 || !categoryId) { alert('Please fill in all fields including category'); return; }
    if (!data.bizExpenses) data.bizExpenses = [];
    data.bizExpenses.push({ id: Date.now(), name, amount, categoryId });
    document.getElementById('bizExpenseName').value     = '';
    document.getElementById('bizExpenseAmount').value   = '';
    document.getElementById('bizExpenseCategory').value = '';
    saveAndUpdate();
}

function deleteBizExpense(id) {
    data.bizExpenses = (data.bizExpenses || []).filter(item => item.id !== id);
    saveAndUpdate();
}

function editBizExpense(id) {
    const item = (data.bizExpenses || []).find(i => i.id === id);
    if (item) { item.editing = true; updateDisplay(); }
}

function saveBizExpense(id) {
    const item      = (data.bizExpenses || []).find(i => i.id === id);
    const newName   = document.getElementById(`biz-name-${id}`) ? document.getElementById(`biz-name-${id}`).value.trim() : '';
    const newAmount = document.getElementById(`biz-amount-${id}`) ? parseFloat(document.getElementById(`biz-amount-${id}`).value) : NaN;
    if (!newName || isNaN(newAmount) || newAmount <= 0) { alert('Please enter a valid name and amount'); return; }
    item.name    = newName;
    item.amount  = newAmount;
    item.editing = false;
    saveAndUpdate();
}

function addBizCategory() {
    const name = document.getElementById('newBizCategoryName').value.trim();
    if (!name) { alert('Please enter a category name'); return; }
    if (!data.bizExpenseCategories) data.bizExpenseCategories = [{ id: 1, name: 'Unassigned', order: 0 }];
    const newId = Math.max(...data.bizExpenseCategories.map(c => c.id), 0) + 1;
    data.bizExpenseCategories.push({ id: newId, name, order: data.bizExpenseCategories.length });
    document.getElementById('newBizCategoryName').value = '';
    saveAndUpdate();
}

function deleteBizCategory(id) {
    if (id === 1) { alert('Cannot delete the Unassigned category'); return; }
    if (!data.bizExpenses) data.bizExpenses = [];
    data.bizExpenses.forEach(item => { if (item.categoryId === id) item.categoryId = 1; });
    data.bizExpenseCategories = data.bizExpenseCategories.filter(c => c.id !== id);
    saveAndUpdate();
}

function toggleBizCategory(categoryId) {
    if (!data.bizCategoryVisibility) data.bizCategoryVisibility = {};
    const el  = document.getElementById(`biz-cat-items-${categoryId}`);
    const btn = document.getElementById(`biz-cat-toggle-${categoryId}`);
    const isHidden = el.classList.contains('hidden');
    el.classList.toggle('hidden');
    btn.textContent = isHidden ? 'Hide' : 'Show';
    data.bizCategoryVisibility[categoryId] = isHidden;
    saveData();
}

function changeBizItemCategory(itemId, newCategoryId) {
    const item = (data.bizExpenses || []).find(i => i.id === itemId);
    if (item) { item.categoryId = parseInt(newCategoryId); saveAndUpdate(); }
}

function renderBizExpenses() {
    if (!data.bizExpenseCategories) data.bizExpenseCategories = [{ id: 1, name: 'Unassigned', order: 0 }];
    if (!data.bizExpenses)           data.bizExpenses = [];
    if (!data.bizCategoryVisibility) data.bizCategoryVisibility = {};

    const select = document.getElementById('bizExpenseCategory');
    if (select) {
        select.innerHTML = '<option value="">Select category...</option>' +
            data.bizExpenseCategories
                .sort((a, b) => a.order - b.order)
                .map(c => `<option value="${c.id}">${c.name}</option>`)
                .join('');
    }

    const list = document.getElementById('bizExpenseList');
    if (!list) return;
    let html = '';

    data.bizExpenseCategories
        .sort((a, b) => a.order - b.order)
        .forEach(cat => {
            const items     = data.bizExpenses.filter(i => i.categoryId === cat.id);
            const catTotal  = items.reduce((s, i) => s + i.amount, 0);
            const isVisible = data.bizCategoryVisibility[cat.id] !== false;

            if (items.length > 0 || cat.id === 1) {
                html += `
                <div class="category-section">
                    <div class="category-header">
                        <div class="category-title" onclick="toggleBizCategory(${cat.id})" style="cursor:pointer;flex:1;">${cat.name} (${items.length})</div>
                        <span style="font-weight:600;color:#667eea;margin-right:10px;">$${catTotal.toFixed(2)}</span>
                        <button id="biz-cat-toggle-${cat.id}" class="toggle-btn" onclick="toggleBizCategory(${cat.id});event.stopPropagation();" style="padding:5px 12px;font-size:0.85em;">${isVisible ? 'Hide' : 'Show'}</button>
                    </div>
                    <div id="biz-cat-items-${cat.id}" class="category-items${isVisible ? '' : ' hidden'}">
                        ${items.map(item => {
                            const catOpts = data.bizExpenseCategories
                                .sort((a, b) => a.order - b.order)
                                .map(c => `<option value="${c.id}" ${c.id === item.categoryId ? 'selected' : ''}>${c.name}</option>`)
                                .join('');
                            if (item.editing) {
                                return `
                                <div class="item category-item editing">
                                    <div class="item-details">
                                        <input type="text"   id="biz-name-${item.id}"   class="edit-name-input"   value="${item.name}">
                                        <input type="number" id="biz-amount-${item.id}" class="edit-amount-input" value="${item.amount}" step="0.01" min="0">
                                    </div>
                                    <div class="item-buttons">
                                        <button class="save-btn"   onclick="saveBizExpense(${item.id})">Save</button>
                                        <button class="delete-btn" onclick="deleteBizExpense(${item.id})">Delete</button>
                                    </div>
                                </div>`;
                            } else {
                                return `
                                <div class="item category-item">
                                    <div class="item-details">
                                        <div class="item-name">${item.name}</div>
                                        <select onchange="changeBizItemCategory(${item.id}, this.value)" style="padding:5px;border:1px solid #667eea;border-radius:5px;font-size:0.85em;margin-top:5px;">
                                            ${catOpts}
                                        </select>
                                    </div>
                                    <span class="item-amount">$${item.amount.toFixed(2)}</span>
                                    <div class="item-buttons">
                                        <button class="edit-btn"   onclick="editBizExpense(${item.id})">Edit</button>
                                        <button class="delete-btn" onclick="deleteBizExpense(${item.id})">Delete</button>
                                    </div>
                                </div>`;
                            }
                        }).join('')}
                        ${items.length === 0 ? '<div style="padding:10px;color:#6b7280;font-style:italic;">No items in this category</div>' : ''}
                    </div>
                </div>`;
            }
        });

    list.innerHTML = html;

    const mgmtList = document.getElementById('bizCategoriesList');
    if (mgmtList) {
        mgmtList.innerHTML = data.bizExpenseCategories
            .sort((a, b) => a.order - b.order)
            .map(c => `
            <div class="item">
                <div class="item-details"><div class="item-name">${c.name}</div></div>
                <div class="item-buttons">
                    ${c.id !== 1 ? `<button class="delete-btn" onclick="deleteBizCategory(${c.id})">Delete</button>` : ''}
                </div>
            </div>`).join('');
    }
}

// ============================================================================
// SECTION TITLES FUNCTIONS
// ============================================================================

function renderSectionTitles() {
    if (!data.sectionTitles) data.sectionTitles = getDefaultData().sectionTitles;

    Object.entries(data.sectionTitles).forEach(([key, title]) => {
        const el = document.getElementById(`title-${key}`);
        if (el) el.textContent = title;
    });

    const list = document.getElementById('sectionTitlesList');
    if (!list) return;
    const defaults = getDefaultData().sectionTitles;
    list.innerHTML = Object.entries(data.sectionTitles).map(([key, title]) => `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
            <span style="color:#6b7280;font-size:0.85em;min-width:140px;">${defaults[key] || key}</span>
            <input type="text" id="section-title-${key}" value="${title}"
                style="flex:1;padding:8px;border:2px solid #e5e7eb;border-radius:8px;font-size:0.95em;">
            <button class="save-btn" onclick="saveSectionTitle('${key}')">Save</button>
            <button onclick="resetSectionTitle('${key}')"
                style="padding:8px 12px;background:#f3f4f6;border:none;border-radius:6px;cursor:pointer;font-size:0.85em;color:#6b7280;">Reset</button>
        </div>`).join('');
}

function saveSectionTitle(key) {
    const input = document.getElementById(`section-title-${key}`);
    if (!input) return;
    const newTitle = input.value.trim();
    if (!newTitle) { alert('Please enter a title'); return; }
    if (!data.sectionTitles) data.sectionTitles = getDefaultData().sectionTitles;
    data.sectionTitles[key] = newTitle;
    saveAndUpdate();
}

function resetSectionTitle(key) {
    const defaults = getDefaultData().sectionTitles;
    if (!data.sectionTitles) data.sectionTitles = getDefaultData().sectionTitles;
    data.sectionTitles[key] = defaults[key];
    saveAndUpdate();
}

// ============================================================================
// END OF PART 3 — concatenate part1 + part2 + part3 to form complete app.js
// ============================================================================
