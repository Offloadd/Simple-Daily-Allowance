// Daily Allowance Tracker - Main Application
// All data stored in Firestore instead of localStorage

// ============================================================================
// COLOR SCHEME FUNCTIONS
// ============================================================================

function getBalanceColor(balance) {
    if (!data.colorScheme) {
        // Fallback to default if no color scheme exists
        return balance >= 0 ? '#4ade80' : '#f87171';
    }
    
    const ranges = balance >= 0 ? data.colorScheme.positive : data.colorScheme.negative;
    
    for (let range of ranges) {
        if (balance >= range.min && balance <= range.max) {
            return range.color;
        }
    }
    
    // Fallback
    return balance >= 0 ? '#4ade80' : '#f87171';
}

function addColorRange(type) {
    const minInput = document.getElementById(`${type}Min`);
    const maxInput = document.getElementById(`${type}Max`);
    const colorInput = document.getElementById(`${type}Color`);
    
    const min = parseFloat(minInput.value);
    const max = parseFloat(maxInput.value);
    const color = colorInput.value;
    
    if (isNaN(min) || isNaN(max)) {
        alert('Please enter valid numbers for min and max');
        return;
    }
    
    if (min > max) {
        alert('Min must be less than or equal to max');
        return;
    }
    
    if (type === 'positive' && (min < 0 || max < 0)) {
        alert('Positive ranges must have values >= 0');
        return;
    }
    
    if (type === 'negative' && (min > 0 || max > 0)) {
        alert('Negative ranges must have values <= 0');
        return;
    }
    
    data.colorScheme[type].push({ min, max, color });
    
    // Sort ranges
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
    
    const minInput = document.getElementById(`edit-${type}-min-${index}`);
    const maxInput = document.getElementById(`edit-${type}-max-${index}`);
    const colorInput = document.getElementById(`edit-${type}-color-${index}`);
    
    const min = parseFloat(minInput.value);
    const max = parseFloat(maxInput.value);
    const color = colorInput.value;
    
    if (isNaN(min) || isNaN(max)) {
        alert('Please enter valid numbers');
        return;
    }
    
    if (min > max) {
        alert('Min must be less than or equal to max');
        return;
    }
    
    range.min = min;
    range.max = max;
    range.color = color;
    range.editing = false;
    
    // Re-sort
    data.colorScheme[type].sort((a, b) => a.min - b.min);
    
    saveAndUpdate();
}

// ============================================================================
// AUTHENTICATION FUNCTIONS
// ============================================================================

async function signIn() {
    console.log('Sign in button clicked');
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    console.log('Email:', email);
    console.log('Password length:', password ? password.length : 0);
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    if (!window.auth) {
        alert('Firebase not initialized. Please refresh the page.');
        console.error('Auth not available:', window.auth);
        return;
    }
    
    try {
        console.log('Attempting sign in...');
        await window.auth.signInWithEmailAndPassword(email, password);
        console.log('Sign in successful');
    } catch (error) {
        console.error('Sign in error:', error);
        alert(getErrorMessage(error));
    }
}

async function signUp() {
    console.log('Sign up button clicked');
    const email = document.getElementById('emailInput').value;
    const password = document.getElementById('passwordInput').value;
    
    console.log('Email:', email);
    console.log('Password length:', password ? password.length : 0);
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    if (!window.auth) {
        alert('Firebase not initialized. Please refresh the page.');
        console.error('Auth not available:', window.auth);
        return;
    }
    
    try {
        console.log('Attempting to create account...');
        await window.auth.createUserWithEmailAndPassword(email, password);
        console.log('Account created successfully');
        alert('Account created successfully!');
    } catch (error) {
        console.error('Sign up error:', error);
        alert(getErrorMessage(error));
    }
}

async function signOut() {
    try {
        await auth.signOut();
        data = getDefaultData(); // Reset data
    } catch (error) {
        console.error('Sign out error:', error);
        alert('Error signing out: ' + error.message);
    }
}

function getErrorMessage(error) {
    const messages = {
        'auth/email-already-in-use': 'Email already registered',
        'auth/invalid-email': 'Invalid email address',
        'auth/weak-password': 'Password too weak',
        'auth/user-not-found': 'No account found',
        'auth/wrong-password': 'Incorrect password',
        'auth/invalid-credential': 'Invalid email or password'
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
            
            // Merge with defaults to ensure all properties exist
            data = {
                ...getDefaultData(),
                ...firestoreData
            };
        } else {
            console.log('No data in Firestore, using defaults');
            data = getDefaultData();
            // Save defaults to Firestore
            await saveAndUpdate();
        }
        
        // Initialize form fields
        document.getElementById('dailyAllowance').value = data.dailyAllowance;
        document.getElementById('startDate').value = data.startDate;
        document.getElementById('spendingDate').value = new Date().toISOString().split('T')[0];
        
        updateDisplay();
    } catch (error) {
        console.error('Error loading from Firestore:', error);
        data = getDefaultData();
        updateDisplay();
    }
}

async function saveData() {
    const docRef = getUserDocRef();
    if (!docRef) {
        console.log('No user, skipping Firestore save');
        return;
    }
    
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
        dailyAllowance: 20,
        startDate: new Date().toISOString().split('T')[0],
        lastAllowanceDate: new Date().toISOString().split('T')[0],
        lastLogCheck: null, // Track when we last checked for new entries
        totalAccumulated: 20,
        spending: [],
        proposed: [],
        wishlist: [],
        wishlistCategories: [
            { id: 1, name: 'Unassigned', order: 0 }
        ],
        allowanceHistory: [],
        allowanceLog: [],
        colorScheme: {
            positive: [
                { min: 0, max: 20, color: '#3b82f6' },      // Blue
                { min: 21, max: 50, color: '#10b981' },     // Green
                { min: 51, max: 999999, color: '#8b5cf6' }  // Purple
            ],
            negative: [
                { min: -20, max: -1, color: '#f59e0b' },    // Orange
                { min: -50, max: -21, color: '#ef4444' },   // Red
                { min: -999999, max: -51, color: '#7f1d1d' } // Dark Red
            ]
        },
        sectionVisibility: {
            proposedPurchases: true,
            wishList: true,
            recordSpending: true,
            settings: true,
            allowanceHistory: true,
            allowanceLog: true,
            categoryManagement: true,
            colorScheme: true
        },
        categoryVisibility: {}
    };
}

let data = getDefaultData();

// ============================================================================
// SECTION TOGGLE FUNCTIONS
// ============================================================================

function toggleSection(sectionName) {
    data.sectionVisibility[sectionName] = !data.sectionVisibility[sectionName];
    updateSectionVisibility();
    saveData(); // Just save, don't regenerate logs
}

function updateSectionVisibility() {
    const sections = [
        { name: 'proposedPurchases', contentId: 'proposedPurchasesContent' },
        { name: 'wishList', contentId: 'wishListContent' },
        { name: 'recordSpending', contentId: 'recordSpendingContent' },
        { name: 'settings', contentId: 'settingsContent' },
        { name: 'allowanceHistory', contentId: 'allowanceHistoryContent' },
        { name: 'allowanceLog', contentId: 'allowanceLogContent' },
        { name: 'categoryManagement', contentId: 'categoryManagementContent' },
        { name: 'colorScheme', contentId: 'colorSchemeContent' }
    ];
    
    sections.forEach(section => {
        const content = document.getElementById(section.contentId);
        if (!content) return;
        
        const button = content.previousElementSibling.querySelector('.toggle-btn');
        
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
    updateDisplay();
}

// ============================================================================
// DATE/TIME FUNCTIONS (PST)
// ============================================================================

function getPSTDate() {
    const now = new Date();
    const pstOffset = -8 * 60;
    const localOffset = now.getTimezoneOffset();
    const pstTime = new Date(now.getTime() + (localOffset - pstOffset) * 60 * 1000);
    
    // Just return today's actual date in PST, don't add a day
    return pstTime.toISOString().split('T')[0];
}

// ============================================================================
// ALLOWANCE LOG FUNCTIONS
// ============================================================================

function shouldCheckForNewEntries() {
    const todayPST = getPSTDate();
    
    // If we've never checked, we should check
    if (!data.lastLogCheck) {
        return true;
    }
    
    // If the last check was on a different day, we should check
    if (data.lastLogCheck !== todayPST) {
        return true;
    }
    
    // Otherwise, we already checked today
    return false;
}

function generateDailyLogEntries() {
    const todayPST = getPSTDate();
    
    // Check if we should even run this
    if (!shouldCheckForNewEntries()) {
        console.log('Already checked for new allowance entries today, skipping');
        return;
    }
    
    console.log('Checking for new allowance entries...');
    
    const startDate = new Date(data.startDate);
    const currentDate = new Date(todayPST);
    
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
                editing: false  // Make sure new entries aren't in editing mode
            });
            entriesAdded++;
            console.log(`Added allowance entry for ${dateStr}: $${applicableRate}`);
        }
    });
    
    if (entriesAdded > 0) {
        console.log(`Added ${entriesAdded} new allowance entries`);
    } else {
        console.log('No new allowance entries needed');
    }
    
    data.allowanceLog.sort((a, b) => a.date.localeCompare(b.date));
    
    let runningTotal = 0;
    data.allowanceLog.forEach(entry => {
        runningTotal += entry.amountAdded;
        entry.newAccumulated = runningTotal;
    });
    
    if (data.allowanceLog.length > 0) {
        data.totalAccumulated = data.allowanceLog[data.allowanceLog.length - 1].newAccumulated;
    }
    
    // Update the last check date
    data.lastLogCheck = todayPST;
    
    // Save if we added entries
    if (entriesAdded > 0) {
        saveData();
    }
}

function getDailyAllowanceForDate(dateStr) {
    const relevantChanges = data.allowanceHistory
        .filter(change => change.date <= dateStr)
        .sort((a, b) => b.date.localeCompare(a.date));
    
    if (relevantChanges.length > 0) {
        return relevantChanges[0].amount;
    }
    
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
    const amount = parseFloat(document.getElementById('logAmount').value);
    
    if (!dateInput || amount < 0 || isNaN(amount)) {
        alert('Please fill in date and amount');
        return;
    }
    
    const existingIndex = data.allowanceLog.findIndex(log => log.date === dateInput);
    if (existingIndex !== -1) {
        alert('An entry for this date already exists. Please edit or delete it first.');
        return;
    }
    
    data.allowanceLog.push({
        id: Date.now(),
        timestamp: new Date(dateInput + 'T05:00:00').toISOString(),
        date: dateInput,
        amountAdded: amount,
        manualEntry: true
    });
    
    document.getElementById('logDate').value = '';
    document.getElementById('logAmount').value = '';
    
    regenerateLogTotals();
    saveAndUpdate();
}

function editAllowanceLog(id) {
    const item = data.allowanceLog.find(item => item.id === id);
    if (!item) return;
    
    item.editing = true;
    // Don't call updateDisplay which triggers generateDailyLogEntries
    // Just re-render the allowance log
    renderAllowanceLog();
}

function saveAllowanceLog(id) {
    const item = data.allowanceLog.find(item => item.id === id);
    if (!item) return;
    
    const dateInput = document.getElementById(`log-date-${id}`);
    const amountInput = document.getElementById(`log-amount-${id}`);
    
    const newDate = dateInput.value;
    const newAmount = parseFloat(amountInput.value);
    
    if (!newDate || newAmount < 0 || isNaN(newAmount)) {
        alert('Please enter valid values');
        return;
    }
    
    const existingEntry = data.allowanceLog.find(log => log.date === newDate && log.id !== id);
    if (existingEntry) {
        alert('An entry for this date already exists.');
        return;
    }
    
    item.date = newDate;
    item.timestamp = new Date(newDate + 'T05:00:00').toISOString();
    item.amountAdded = newAmount;
    item.editing = false;
    
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
    const amount = parseFloat(document.getElementById('historyAmount').value);
    
    if (!dateInput || !amount || amount <= 0) {
        alert('Please fill in date and amount');
        return;
    }
    
    data.allowanceHistory.push({
        id: Date.now(),
        date: dateInput,
        amount: amount,
        previousAmount: null
    });
    
    document.getElementById('historyDate').value = '';
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
    
    const dateInput = document.getElementById(`history-date-${id}`);
    const amountInput = document.getElementById(`history-amount-${id}`);
    
    const newDate = dateInput.value;
    const newAmount = parseFloat(amountInput.value);
    
    if (!newDate || !newAmount || newAmount <= 0) {
        alert('Please enter valid date and amount');
        return;
    }
    
    item.date = newDate;
    item.amount = newAmount;
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
    const name = document.getElementById('spendingName').value.trim();
    const amount = parseFloat(document.getElementById('spendingAmount').value);
    const dateInput = document.getElementById('spendingDate').value;
    
    if (!name || !amount || amount <= 0 || !dateInput) {
        alert('Please fill in all spending fields');
        return;
    }
    
    data.spending.push({
        id: Date.now(),
        name: name,
        amount: amount,
        date: dateInput
    });
    
    document.getElementById('spendingName').value = '';
    document.getElementById('spendingAmount').value = '';
    
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
    
    const nameInput = document.getElementById(`spending-name-${id}`);
    const amountInput = document.getElementById(`spending-amount-${id}`);
    
    const newName = nameInput.value.trim();
    const newAmount = parseFloat(amountInput.value);
    
    if (!newName || !newAmount || newAmount <= 0) {
        alert('Please enter valid name and amount');
        return;
    }
    
    item.name = newName;
    item.amount = newAmount;
    item.editing = false;
    
    saveAndUpdate();
}

// ============================================================================
// PROPOSED PURCHASES FUNCTIONS
// ============================================================================

function addProposed() {
    const name = document.getElementById('proposedName').value.trim();
    const amount = parseFloat(document.getElementById('proposedAmount').value);
    
    if (!name || !amount || amount <= 0) {
        alert('Please fill in all proposed purchase fields');
        return;
    }
    
    data.proposed.push({
        id: Date.now(),
        name: name,
        amount: amount
    });
    
    document.getElementById('proposedName').value = '';
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
    
    const nameInput = document.getElementById(`proposed-name-${item.id}`);
    const amountInput = document.getElementById(`proposed-amount-${item.id}`);
    
    const newName = nameInput.value.trim();
    const newAmount = parseFloat(amountInput.value);
    
    if (!newName || !newAmount || newAmount <= 0) {
        alert('Please enter valid name and amount');
        return;
    }
    
    item.name = newName;
    item.amount = newAmount;
    item.editing = false;
    
    saveAndUpdate();
}

function moveProposedToWishlist(id) {
    const item = data.proposed.find(item => item.id === id);
    if (!item) return;
    
    data.wishlist.push({
        id: Date.now(),
        name: item.name,
        amount: item.amount,
        categoryId: 1 // Default to Unassigned
    });
    
    data.proposed = data.proposed.filter(item => item.id !== id);
    saveAndUpdate();
}

// ============================================================================
// WISHLIST & CATEGORY FUNCTIONS
// ============================================================================

function addCategory() {
    const name = document.getElementById('newCategoryName').value.trim();
    
    if (!name) {
        alert('Please enter a category name');
        return;
    }
    
    const newId = Math.max(...data.wishlistCategories.map(c => c.id), 0) + 1;
    data.wishlistCategories.push({
        id: newId,
        name: name,
        order: data.wishlistCategories.length
    });
    
    document.getElementById('newCategoryName').value = '';
    saveAndUpdate();
}

function deleteCategory(id) {
    if (id === 1) {
        alert('Cannot delete the Unassigned category');
        return;
    }
    
    data.wishlist.forEach(item => {
        if (item.categoryId === id) {
            item.categoryId = 1;
        }
    });
    
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
    
    const nameInput = document.getElementById(`category-name-${id}`);
    const newName = nameInput.value.trim();
    
    if (!newName) {
        alert('Please enter a valid category name');
        return;
    }
    
    category.name = newName;
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
    const button = document.getElementById(`category-toggle-${categoryId}`);
    
    if (element) {
        element.classList.toggle('hidden');
        const isHidden = element.classList.contains('hidden');
        data.categoryVisibility[categoryId] = !isHidden;
        
        if (button) {
            button.textContent = isHidden ? 'Show' : 'Hide';
        }
        
        saveData(); // Just save, don't regenerate logs
    }
}

function addWishlist() {
    const name = document.getElementById('wishlistName').value.trim();
    const amount = parseFloat(document.getElementById('wishlistAmount').value);
    const categoryId = parseInt(document.getElementById('wishlistCategory').value);
    
    if (!name || !amount || amount <= 0 || !categoryId) {
        alert('Please fill in all fields including category');
        return;
    }
    
    data.wishlist.push({
        id: Date.now(),
        name: name,
        amount: amount,
        categoryId: categoryId
    });
    
    document.getElementById('wishlistName').value = '';
    document.getElementById('wishlistAmount').value = '';
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
    
    const nameInput = document.getElementById(`wishlist-name-${item.id}`);
    const amountInput = document.getElementById(`wishlist-amount-${item.id}`);
    
    const newName = nameInput.value.trim();
    const newAmount = parseFloat(amountInput.value);
    
    if (!newName || !newAmount || newAmount <= 0) {
        alert('Please enter valid name and amount');
        return;
    }
    
    item.name = newName;
    item.amount = newAmount;
    item.editing = false;
    
    saveAndUpdate();
}

function moveWishlistToProposed(id) {
    const item = data.wishlist.find(item => item.id === id);
    if (!item) return;
    
    data.proposed.push({
        id: Date.now(),
        name: item.name,
        amount: item.amount
    });
    
    saveAndUpdate();
}

// ============================================================================
// DISPLAY / RENDER FUNCTIONS
// ============================================================================

function updateDisplay() {
    generateDailyLogEntries();
    
    const accumulated = data.totalAccumulated;
    const spent = calculateTotalSpent();
    const available = accumulated - spent;
    
    // Update balances
    document.getElementById('totalAccumulated').textContent = `$${accumulated.toFixed(2)}`;
    document.getElementById('totalSpent').textContent = `$${spent.toFixed(2)}`;
    
    const availableBalanceDiv = document.getElementById('availableBalance');
    const balanceColor = getBalanceColor(available);
    availableBalanceDiv.innerHTML = `<span style="color: ${balanceColor}; font-weight: bold;">$${available.toFixed(2)}</span>`;
    
    // Update spending list
    renderSpendingList();
    
    // Update proposed list
    renderProposedList(available);
    
    // Update wishlist
    renderWishlist();
    
    // Update categories management
    renderCategoriesManagement();
    
    // Update allowance history
    renderAllowanceHistory();
    
    // Update allowance log
    renderAllowanceLog();
    
    // Update color scheme
    renderColorScheme();
    
    // Update section visibility
    updateSectionVisibility();
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
                    </li>
                `;
            } else {
                return `
                    <li class="item">
                        <div class="item-details">
                            <div class="item-name">${item.name}</div>
                            <div class="item-date">${formattedDate}</div>
                        </div>
                        <span class="item-amount">$${item.amount.toFixed(2)}</span>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editSpending(${item.id})">Edit</button>
                            <button class="delete-btn" onclick="deleteSpending(${item.id})">Delete</button>
                        </div>
                    </li>
                `;
            }
        }).join('');
}

function renderProposedList(available) {
    const proposedList = document.getElementById('proposedList');
    let runningBalance = available;
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
                </li>
            `;
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
                </li>
            `;
        }
    }).join('');
    
    const remainingAfter = available - totalProposed;
    document.getElementById('totalProposed').textContent = `$${totalProposed.toFixed(2)}`;
    document.getElementById('proposedAvailable').textContent = `$${available.toFixed(2)}`;
    document.getElementById('remainingAfter').textContent = `$${remainingAfter.toFixed(2)}`;
    document.getElementById('remainingAfter').className = remainingAfter >= 0 ? 'proposed-totals-amount totals-positive' : 'proposed-totals-amount totals-negative';
}

function renderWishlist() {
    const categorySelect = document.getElementById('wishlistCategory');
    categorySelect.innerHTML = '<option value="">Select category...</option>' + 
        data.wishlistCategories
            .sort((a, b) => a.order - b.order)
            .map(cat => `<option value="${cat.id}">${cat.name}</option>`)
            .join('');
    
    const wishlistList = document.getElementById('wishlistList');
    let wishlistHTML = '';
    
    data.wishlistCategories
        .sort((a, b) => a.order - b.order)
        .forEach(category => {
            const categoryItems = data.wishlist.filter(item => item.categoryId === category.id);
            
            if (categoryItems.length > 0 || category.id === 1) {
                const isVisible = data.categoryVisibility[category.id] !== false;
                
                wishlistHTML += `
                    <div class="category-section">
                        <div class="category-header">
                            <div class="category-title" onclick="toggleCategory(${category.id})" style="cursor: pointer; flex: 1;">${category.name} (${categoryItems.length})</div>
                            <button id="category-toggle-${category.id}" class="toggle-btn" onclick="toggleCategory(${category.id}); event.stopPropagation();" style="padding: 5px 12px; font-size: 0.85em;">${isVisible ? 'Hide' : 'Show'}</button>
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
                                        </div>
                                    `;
                                } else {
                                    return `
                                        <div class="item category-item">
                                            <div class="item-details">
                                                <div class="item-name">${item.name}</div>
                                                <select onchange="changeItemCategory(${item.id}, this.value)" style="padding: 5px; border: 1px solid #667eea; border-radius: 5px; font-size: 0.85em; margin-top: 5px;">
                                                    ${categoryOptions}
                                                </select>
                                            </div>
                                            <span class="item-amount">$${item.amount.toFixed(2)}</span>
                                            <div class="item-buttons">
                                                <button class="move-btn" onclick="moveWishlistToProposed(${item.id})">→ Proposed</button>
                                                <button class="edit-btn" onclick="editWishlist(${item.id})">Edit</button>
                                                <button class="delete-btn" onclick="deleteWishlist(${item.id})">Delete</button>
                                            </div>
                                        </div>
                                    `;
                                }
                            }).join('')}
                            ${categoryItems.length === 0 ? '<div style="padding: 10px; color: #6b7280; font-style: italic;">No items in this category</div>' : ''}
                        </div>
                    </div>
                `;
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
                        <input type="text" id="category-name-${cat.id}" value="${cat.name}" style="flex: 1; padding: 8px; border: 2px solid #667eea; border-radius: 5px;">
                        <div class="item-buttons">
                            <button class="save-btn" onclick="saveCategory(${cat.id})">Save</button>
                            <button class="delete-btn" onclick="deleteCategory(${cat.id})">Delete</button>
                        </div>
                    </div>
                `;
            } else {
                return `
                    <div class="category-management-item">
                        <span style="font-weight: bold;">${cat.name}</span>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editCategory(${cat.id})">Edit</button>
                            ${cat.id !== 1 ? `<button class="delete-btn" onclick="deleteCategory(${cat.id})">Delete</button>` : ''}
                        </div>
                    </div>
                `;
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
                            <input type="date" id="history-date-${item.id}" value="${item.date}" style="width: 150px;">
                            <input type="number" id="history-amount-${item.id}" value="${item.amount}" step="0.01" min="0" style="width: 100px;">
                        </div>
                        <div class="item-buttons">
                            <button class="save-btn" onclick="saveAllowanceHistory(${item.id})">Save</button>
                            <button class="delete-btn" onclick="deleteAllowanceHistory(${item.id})">Delete</button>
                        </div>
                    </li>
                `;
            } else {
                const [year, month, day] = item.date.split('-');
                const formattedDate = `${month}/${day}/${year}`;
                return `
                    <li class="item">
                        <div class="item-details">
                            <div class="item-name">${formattedDate}: Changed to $${item.amount.toFixed(2)}/day${item.previousAmount !== null ? ` (was $${item.previousAmount.toFixed(2)})` : ''}</div>
                        </div>
                        <div class="item-buttons">
                            <button class="edit-btn" onclick="editAllowanceHistory(${item.id})">Edit</button>
                            <button class="delete-btn" onclick="deleteAllowanceHistory(${item.id})">Delete</button>
                        </div>
                    </li>
                `;
            }
        }).join('');
}

function renderAllowanceLog() {
    const allowanceLogList = document.getElementById('allowanceLogList');
    if (data.allowanceLog.length === 0) {
        allowanceLogList.innerHTML = '<li class="item"><div class="item-details"><div class="item-name" style="color: #6b7280;">No daily allowance additions yet</div></div></li>';
    } else {
        allowanceLogList.innerHTML = data.allowanceLog
            .sort((a, b) => b.date.localeCompare(a.date))
            .map(item => {
                const [year, month, day] = item.date.split('-');
                const formattedDate = `${month}/${day}/${year}`;
                
                if (item.editing) {
                    return `
                        <li class="item log-item editing">
                            <div class="item-details">
                                <input type="date" id="log-date-${item.id}" value="${item.date}" style="padding: 5px; border: 2px solid #667eea; border-radius: 5px; font-size: 0.9em;">
                                <input type="number" id="log-amount-${item.id}" value="${item.amountAdded}" step="0.01" min="0" style="width: 120px; padding: 5px; border: 2px solid #667eea; border-radius: 5px; font-size: 0.9em;" placeholder="Amount">
                            </div>
                            <div class="item-buttons">
                                <button class="save-btn" onclick="saveAllowanceLog(${item.id})">Save</button>
                                <button class="delete-btn" onclick="deleteAllowanceLog(${item.id})">Delete</button>
                            </div>
                        </li>
                    `;
                } else {
                    const typeLabel = item.manualEntry ? '<span style="color: #f59e0b; font-size: 0.85em;"> (Manual)</span>' : 
                                    item.autoGenerated ? '<span style="color: #10b981; font-size: 0.85em;"> (Auto)</span>' : '';
                    
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
                        </li>
                    `;
                }
            }).join('');
    }
}

function renderColorScheme() {
    const positiveList = document.getElementById('positiveRangesList');
    const negativeList = document.getElementById('negativeRangesList');
    
    if (!positiveList || !negativeList) return;
    
    // Ensure color scheme exists
    if (!data.colorScheme) {
        data.colorScheme = getDefaultData().colorScheme;
    }
    
    // Render positive ranges
    positiveList.innerHTML = data.colorScheme.positive.map((range, index) => {
        if (range.editing) {
            return `
                <li class="item">
                    <div class="item-details">
                        <input type="number" id="edit-positive-min-${index}" value="${range.min}" step="0.01" style="width: 80px; padding: 5px; margin-right: 5px;">
                        <span>to</span>
                        <input type="number" id="edit-positive-max-${index}" value="${range.max}" step="0.01" style="width: 80px; padding: 5px; margin: 0 5px;">
                        <input type="color" id="edit-positive-color-${index}" value="${range.color}" style="width: 50px; height: 30px; margin-left: 5px;">
                    </div>
                    <div class="item-buttons">
                        <button class="save-btn" onclick="saveColorRange('positive', ${index})">Save</button>
                        <button class="delete-btn" onclick="deleteColorRange('positive', ${index})">Delete</button>
                    </div>
                </li>
            `;
        } else {
            return `
                <li class="item">
                    <div class="item-details">
                        <div class="item-name">$${range.min} to $${range.max}</div>
                        <div style="width: 30px; height: 30px; background: ${range.color}; border: 2px solid #333; border-radius: 4px; margin-left: 10px;"></div>
                    </div>
                    <div class="item-buttons">
                        <button class="edit-btn" onclick="editColorRange('positive', ${index})">Edit</button>
                        <button class="delete-btn" onclick="deleteColorRange('positive', ${index})">Delete</button>
                    </div>
                </li>
            `;
        }
    }).join('');
    
    // Render negative ranges
    negativeList.innerHTML = data.colorScheme.negative.map((range, index) => {
        if (range.editing) {
            return `
                <li class="item">
                    <div class="item-details">
                        <input type="number" id="edit-negative-min-${index}" value="${range.min}" step="0.01" style="width: 80px; padding: 5px; margin-right: 5px;">
                        <span>to</span>
                        <input type="number" id="edit-negative-max-${index}" value="${range.max}" step="0.01" style="width: 80px; padding: 5px; margin: 0 5px;">
                        <input type="color" id="edit-negative-color-${index}" value="${range.color}" style="width: 50px; height: 30px; margin-left: 5px;">
                    </div>
                    <div class="item-buttons">
                        <button class="save-btn" onclick="saveColorRange('negative', ${index})">Save</button>
                        <button class="delete-btn" onclick="deleteColorRange('negative', ${index})">Delete</button>
                    </div>
                </li>
            `;
        } else {
            return `
                <li class="item">
                    <div class="item-details">
                        <div class="item-name">$${range.min} to $${range.max}</div>
                        <div style="width: 30px; height: 30px; background: ${range.color}; border: 2px solid #333; border-radius: 4px; margin-left: 10px;"></div>
                    </div>
                    <div class="item-buttons">
                        <button class="edit-btn" onclick="editColorRange('negative', ${index})">Edit</button>
                        <button class="delete-btn" onclick="deleteColorRange('negative', ${index})">Delete</button>
                    </div>
                </li>
            `;
        }
    }).join('');
}

// Initialize on page load
console.log('Allowance Tracker app loaded - waiting for auth...');
