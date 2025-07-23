document.addEventListener('DOMContentLoaded', function() {
    
    // =======================================================
    // #region SHARED HELPER FUNCTIONS
    // =======================================================
    const formatCurrency = (num) => `$${num.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
    const handleFocus = (event) => { if (event.target.value === '0' || event.target.value === '0.00') event.target.value = ''; };
    const handleBlur = (event) => { if (event.target.value === '') event.target.value = '0'; };
    const preventInvalidNumberKeys = (event) => { if (['e', 'E', '+', '-'].includes(event.key)) event.preventDefault(); };
    const attachNumberInputListeners = (inputElement) => {
        if (!inputElement) return;
        inputElement.addEventListener('keydown', preventInvalidNumberKeys);
        inputElement.addEventListener('focus', handleFocus);
        inputElement.addEventListener('blur', handleBlur);
    };
    // #endregion

    let budgetChartInstance, debtProgressChartInstance, expenseChartInstance;
    let debtCounter = 0;
    let calculationMode = 'extra-payment';

    // =======================================================
    // #region MASTER EXPENSE LOGIC
    // =======================================================
    const masterExpensesContainer = document.getElementById('master-expenses-container');
    const addMasterExpenseBtn = document.getElementById('add-master-expense');

    const addMasterExpenseField = (name = '', amount = 0, category = 'need') => {
        const newExpense = document.createElement('div');
        newExpense.className = 'master-expense-item flex gap-2 items-center';
        newExpense.innerHTML = `<input type="text" class="expense-name input-highlight w-full px-4 py-2 border rounded-md" placeholder="Expense Name" value="${name}"><input type="number" class="expense-amount input-highlight w-32 px-4 py-2 border rounded-md" value="${amount}"><select class="expense-category input-highlight w-32 px-4 py-2 border rounded-md bg-white"><option value="need" ${category === 'need' ? 'selected' : ''}>Need</option><option value="want" ${category === 'want' ? 'selected' : ''}>Want</option></select><button class="delete-item bg-red-100 text-red-600 px-2 py-2 rounded-md hover:bg-red-200">✕</button>`;
        masterExpensesContainer.appendChild(newExpense);
        
        newExpense.querySelector('.delete-item').addEventListener('click', () => { newExpense.remove(); updateAllCalculators(); });
        newExpense.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', updateAllCalculators);
            input.addEventListener('change', updateAllCalculators);
            if(input.type === 'number') attachNumberInputListeners(input);
        });
    };
    // #endregion

    // =======================================================
    // #region PILLAR 1: BUDGET SETUP TOOL LOGIC
    // =======================================================
    const calculateAndDisplayBudget = (masterExpenses, debtResults) => {
        if (!document.getElementById('pillar1')) return;
        const income = parseFloat(document.getElementById('budget-income').value) || 0;
        const needsTotal = masterExpenses.filter(e => e.category === 'need').reduce((sum, e) => sum + e.amount, 0);
        const wantsTotal = masterExpenses.filter(e => e.category === 'want').reduce((sum, e) => sum + e.amount, 0);
        
        document.getElementById('budget-needs').value = needsTotal.toFixed(2);
        document.getElementById('budget-wants').value = wantsTotal.toFixed(2);
        
        const savingsAndDebtTotal = (debtResults?.monthlySavings || 0) + (debtResults?.totalMinPayment || 0) + (debtResults?.extraPayment || 0);
        document.getElementById('budget-savings').value = savingsAndDebtTotal.toFixed(2);
        
        updateBudgetChart(needsTotal, wantsTotal, savingsAndDebtTotal, income);
    };
    
    const updateBudgetChart = (needs, wants, savingsAndDebt, income) => {
        const ctx = document.getElementById('budgetChart')?.getContext('2d');
        if (!ctx) return;
        const allocated = needs + wants + savingsAndDebt;
        const remaining = income - allocated;
        const data = {
            labels: ['Needs', 'Wants', 'Savings & Debt'],
            datasets: [{ data: [needs, wants, savingsAndDebt], backgroundColor: ['#3b82f6', '#f97316', '#16a34a'], borderWidth: 2 }]
        };
        if (budgetChartInstance) {
            budgetChartInstance.data = data;
            budgetChartInstance.update();
        } else {
            budgetChartInstance = new Chart(ctx, { type: 'doughnut', data: data, options: { responsive: true, maintainAspectRatio: false, cutout: '60%', plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: function(context) { const value = context.raw || 0; const percentage = income > 0 ? ((value / income) * 100).toFixed(0) : 0; return `${context.label}: ${formatCurrency(value)} (${percentage}%)`; } } } } } });
        }
        document.getElementById('budget-remaining').textContent = formatCurrency(remaining);
    };
    // #endregion

    // =======================================================
    // #region PILLAR 2: EMERGENCY FUND CALCULATOR LOGIC
    // =======================================================
    const calculateEmergencyFund = (masterExpenses) => {
        if (!document.getElementById('pillar2')) return;
        const efExpensesContainer = document.getElementById('ef-expenses-container');
        efExpensesContainer.innerHTML = ''; 
        const needs = masterExpenses.filter(e => e.category === 'need');
        needs.forEach(e => {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center text-sm bg-gray-50 p-2 rounded';
            row.innerHTML = `<span>${e.name}</span><span class="font-medium">${formatCurrency(e.amount)}</span>`;
            efExpensesContainer.appendChild(row);
        });
        const totalMonthlyNeeds = needs.reduce((sum, e) => sum + e.amount, 0);
        
        const breakdownContainer = document.getElementById('ef-calculation-breakdown');
        breakdownContainer.innerHTML = '<h4 class="text-md font-semibold text-gray-700 text-center mb-2">Monthly Expense Breakdown (Needs)</h4>';
        needs.forEach(item => {
            const row = document.createElement('div');
            row.className = 'flex justify-between items-center text-sm border-b pb-1';
            row.innerHTML = `<span class="text-gray-600">${item.name}</span><span class="font-medium">${formatCurrency(item.amount)}</span>`;
            breakdownContainer.appendChild(row);
        });
        const totalRow = document.createElement('div');
        totalRow.className = 'flex justify-between items-center text-sm font-bold pt-2';
        totalRow.innerHTML = `<span>Total Essential Expenses</span><span>${formatCurrency(totalMonthlyNeeds)}</span>`;
        breakdownContainer.appendChild(totalRow);
        
        const goal3Month = totalMonthlyNeeds * 3;
        const goal6Month = totalMonthlyNeeds * 6;
        const currentSavings = parseFloat(document.getElementById('current-savings').value) || 0;
        
        document.getElementById('ef-3-month-goal').textContent = formatCurrency(goal3Month);
        document.getElementById('ef-6-month-goal').textContent = formatCurrency(goal6Month);
        document.getElementById('ef-3-month-calc').textContent = `${formatCurrency(totalMonthlyNeeds)} × 3 Months`;
        document.getElementById('ef-6-month-calc').textContent = `${formatCurrency(totalMonthlyNeeds)} × 6 Months`;
        
        const progressPercentage = goal3Month > 0 ? Math.min((currentSavings / goal3Month) * 100, 100) : 0;
        document.getElementById('ef-progress-bar').style.width = `${progressPercentage}%`;
        document.getElementById('ef-current-savings-label').textContent = formatCurrency(currentSavings);
        document.getElementById('ef-goal-label').textContent = formatCurrency(goal3Month);
        const monthlySavings = parseFloat(document.getElementById('monthly-savings')?.value) || 0;
        const timelineProjectionEl = document.getElementById('ef-timeline-projection');
        const timelineTextEl = document.getElementById('ef-timeline-text');
        
        if (monthlySavings > 0 && (goal3Month - currentSavings) > 0) {
            const remainingToSave = goal3Month - currentSavings;
            const monthsToGoal = Math.ceil(remainingToSave / monthlySavings);
            timelineTextEl.textContent = `At ${formatCurrency(monthlySavings)}/month, you'll reach your goal in ${monthsToGoal} months.`;
            timelineProjectionEl.classList.remove('hidden');
        } else {
            timelineProjectionEl.classList.add('hidden');
        }
    };
    // #endregion

    // =======================================================
    // #region PILLAR 3: DEBT FREEDOM CALCULATOR LOGIC
    // =======================================================
    const debtsContainer = document.getElementById('debts-container');
    const addDebtBtn = document.getElementById('add-debt');
    const clearBtn = document.getElementById('clear-btn');
    const modeExtraPaymentBtn = document.getElementById('mode-extra-payment-btn');
    const modeTargetDateBtn = document.getElementById('mode-target-date-btn');
    
    const setCalculationMode = (mode) => {
        calculationMode = mode;
        const extraPaymentContent = document.getElementById('extra-payment-mode-content');
        const targetDateContent = document.getElementById('target-date-mode-content');
        if (mode === 'extra-payment') {
            modeExtraPaymentBtn.classList.add('bg-blue-600', 'text-white');
            modeExtraPaymentBtn.classList.remove('bg-white', 'text-gray-700', 'border', 'border-gray-300');
            modeTargetDateBtn.classList.add('bg-white', 'text-gray-700', 'border', 'border-gray-300');
            modeTargetDateBtn.classList.remove('bg-blue-600', 'text-white');
            extraPaymentContent.classList.add('active');
            targetDateContent.classList.remove('active');
        } else {
            modeTargetDateBtn.classList.add('bg-blue-600', 'text-white');
            modeTargetDateBtn.classList.remove('bg-white', 'text-gray-700', 'border', 'border-gray-300');
            modeExtraPaymentBtn.classList.add('bg-white', 'text-gray-700', 'border', 'border-gray-300');
            modeExtraPaymentBtn.classList.remove('bg-blue-600', 'text-white');
            targetDateContent.classList.add('active');
            extraPaymentContent.classList.remove('active');
        }
    };
    
    const addDebtField = (debt = {}) => {
        debtCounter++;
        const newDebt = document.createElement('div');
        newDebt.className = 'debt-item flex gap-2 items-end mt-2';
        newDebt.innerHTML = `<div class="flex-grow">${debtCounter===1?'<label class="block text-sm font-medium text-gray-700 mb-1">Debt Name</label>':''}<input type="text" class="debt-name input-highlight w-full px-4 py-2 border rounded-md" placeholder="e.g., Credit Card" value="${debt.name || ''}"></div><div class="w-24">${debtCounter===1?'<label class="block text-sm font-medium text-gray-700 mb-1">Balance ($)</label>':''}<input type="number" class="debt-balance input-highlight w-full px-4 py-2 border rounded-md" value="${debt.balance || 0}"></div><div class="w-24">${debtCounter===1?'<label class="block text-sm font-medium text-gray-700 mb-1">Interest (%)</label>':''}<input type="number" class="debt-interest input-highlight w-full px-4 py-2 border rounded-md" value="${debt.interest || 0}"></div><div class="w-24">${debtCounter===1?'<label class="block text-sm font-medium text-gray-700 mb-1">Min. Pmt ($)</label>':''}<input type="number" class="debt-min-payment input-highlight w-full px-4 py-2 border rounded-md" value="${debt.minPayment || 0}"></div><button class="delete-item bg-red-100 text-red-600 px-2 py-2 rounded-md hover:bg-red-200">✕</button>`;
        debtsContainer.appendChild(newDebt);
        newDebt.querySelector('.delete-item').addEventListener('click', () => { newDebt.remove(); updateAllCalculators(); });
        newDebt.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', updateAllCalculators);
            if(input.type === 'number') {
                input.addEventListener('focus', () => input.classList.add('input-focus-expand'));
                input.addEventListener('blur', () => input.classList.remove('input-focus-expand'));
                attachNumberInputListeners(input);
            }
        });
    };
    
    const calculateDebtFreedomPlan = (income, masterExpenses) => {
        if (!document.getElementById('save-plan-btn')) return null;
        const totalIncome = income;
        const totalExpenses = masterExpenses.reduce((sum, e) => sum + e.amount, 0);
        const debtItems = document.querySelectorAll('#pillar3 .debt-item');
        let debts = Array.from(debtItems).map(item => ({ name: item.querySelector('.debt-name').value || 'Unnamed Debt', balance: parseFloat(item.querySelector('.debt-balance').value) || 0, interest: parseFloat(item.querySelector('.debt-interest').value) || 0, minPayment: parseFloat(item.querySelector('.debt-min-payment').value) || 0 })).filter(debt => debt.balance > 0);
        const strategy = document.getElementById('payoff-strategy-select').value;
        if (strategy === 'avalanche') { debts.sort((a, b) => b.interest - a.interest); } else { debts.sort((a, b) => a.balance - b.balance); }
        const totalDebt = debts.reduce((sum, debt) => sum + debt.balance, 0);
        const totalMinPayment = debts.reduce((sum, debt) => sum + debt.minPayment, 0);
        const monthlySavings = parseFloat(document.getElementById('monthly-savings').value) || 0;
        let extraPayment;
        if (calculationMode === 'target-date') {
            const targetMonths = parseInt(document.getElementById('target-months').value) || 1;
            let low = 0, high = totalDebt, bestExtraPayment = 0;
            for(let i = 0; i < 100; i++) {
                let mid = (low + high) / 2;
                const simResult = runDebtSimulation(JSON.parse(JSON.stringify(debts)), totalMinPayment + mid);
                if (simResult.months <= targetMonths) { bestExtraPayment = mid; high = mid; } else { low = mid; }
            }
            extraPayment = bestExtraPayment;
        } else {
            extraPayment = parseFloat(document.getElementById('extra-payment').value) || 0;
        }
        if (totalDebt === 0) return { totalDebt: 0, totalIncome, totalMinPayment, monthlySavings, extraPayment };
        const totalMonthlyPaymentToDebt = totalMinPayment + extraPayment;
        const finalSim = runDebtSimulation(JSON.parse(JSON.stringify(debts)), totalMonthlyPaymentToDebt);
        return { totalDebt, totalInterest: finalSim.totalInterestPaid, monthlyPayment: totalMonthlyPaymentToDebt, monthsToFreedom: finalSim.months, debtProgress: finalSim.debtProgress, totalIncome, totalExpenses, strategy, paymentSchedule: finalSim.paymentSchedule, extraPayment, originalDebts: debts, totalMinPayment, monthlySavings };
    };

    const runDebtSimulation = (debts, totalMonthlyPayment) => {
        let months = 0;
        let totalInterestPaid = 0;
        let tempDebts = JSON.parse(JSON.stringify(debts));
        let currentTotalDebt = tempDebts.reduce((sum, debt) => sum + debt.balance, 0);
        const paymentSchedule = [];
        const debtProgress = [currentTotalDebt];
        while (currentTotalDebt > 0.01 && months < 600) {
            months++;
            let interestThisMonth = 0;
            const monthPayments = { month: months, payments: [], remainingBalance: 0 };
            for (const debt of tempDebts) { if (debt.balance > 0) { const monthlyInterest = (debt.balance * (debt.interest / 100)) / 12; debt.balance += monthlyInterest; interestThisMonth += monthlyInterest; } }
            totalInterestPaid += interestThisMonth;
            let paymentPool = totalMonthlyPayment;
            for (const debt of tempDebts) { if (debt.balance > 0) { const payment = Math.min(debt.balance, debt.minPayment); debt.balance -= payment; paymentPool -= payment; if (payment > 0) monthPayments.payments.push({ name: debt.name, amount: payment }); } }
            for (const debt of tempDebts) { if (debt.balance > 0 && paymentPool > 0) { const extraPay = Math.min(debt.balance, paymentPool); debt.balance -= extraPay; paymentPool -= extraPay; const existingPayment = monthPayments.payments.find(p => p.name === debt.name); if (existingPayment) existingPayment.amount += extraPay; else if (extraPay > 0) monthPayments.payments.push({ name: debt.name, amount: extraPay }); } }
            currentTotalDebt = tempDebts.reduce((sum, debt) => sum + debt.balance, 0);
            monthPayments.remainingBalance = currentTotalDebt;
            paymentSchedule.push(monthPayments);
            debtProgress.push(Math.max(0, currentTotalDebt));
        }
        return { months, totalInterestPaid, debtProgress, paymentSchedule };
    };

    const displayDebtResults = (results) => {
        const resultsContainer = document.getElementById('results-container');
        const emptyState = document.getElementById('empty-state');
        if (!resultsContainer || !emptyState) return;
        emptyState.classList.add('hidden');
        resultsContainer.classList.remove('hidden');
        document.getElementById('print-btn').classList.remove('hidden');
        const futureDate = new Date();
        futureDate.setMonth(futureDate.getMonth() + results.monthsToFreedom);
        document.getElementById('projected-date').textContent = futureDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        document.getElementById('total-debt').textContent = formatCurrency(results.totalDebt);
        document.getElementById('total-interest').textContent = formatCurrency(results.totalInterest);
        document.getElementById('total-payment').textContent = formatCurrency(results.monthlyPayment);
        document.getElementById('months-to-freedom').textContent = results.monthsToFreedom;
        const totalRepaid = results.totalDebt + results.totalInterest;
        document.getElementById('cod-original-debt').textContent = formatCurrency(results.totalDebt);
        document.getElementById('cod-total-interest').textContent = formatCurrency(results.totalInterest);
        document.getElementById('cod-total-repaid').textContent = formatCurrency(totalRepaid);
        if (debtProgressChartInstance) debtProgressChartInstance.destroy();
        const debtCtx = document.getElementById('debtProgressChart').getContext('2d');
        debtProgressChartInstance = new Chart(debtCtx, { type: 'line', data: { labels: Array.from({ length: results.monthsToFreedom + 1 }, (_, i) => `Month ${i}`), datasets: [{ label: 'Remaining Debt Balance', data: results.debtProgress, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.1)', fill: true, tension: 0.1 }] }, options: { responsive: true, plugins: { title: { display: true, text: 'Debt Balance Over Time' } }, scales: { y: { beginAtZero: true, title: { display: true, text: 'Debt Balance ($)' } } } } });
        if (expenseChartInstance) expenseChartInstance.destroy();
        const expenseCtx = document.getElementById('expensesChart').getContext('2d');
        expenseChartInstance = new Chart(expenseCtx, { type: 'doughnut', data: { labels: results.originalDebts.map(d => d.name), datasets: [{ label: 'Debts', data: results.originalDebts.map(d => d.balance), backgroundColor: ['#3b82f6', '#ef4444', '#f97316', '#84cc16', '#14b8a6', '#a855f7', '#64748b'], borderWidth: 1 }] }, options: { responsive: true, plugins: { title: { display: true, text: 'Debt Breakdown by Balance' } } } });
        const years = Math.floor(results.monthsToFreedom / 12);
        const months = results.monthsToFreedom % 12;
        const strategyText = results.strategy === 'avalanche' ? "using the <strong>Debt Avalanche</strong> method." : "using the <strong>Debt Snowball</strong> method.";
        document.getElementById('payoff-strategy').innerHTML = `<li>To meet your goal, you'll pay <strong>${formatCurrency(results.monthlyPayment)}</strong> towards debts each month, ${strategyText}</li><li>You are projected to be debt-free in <strong>${years} years and ${months} months</strong>.</li>`;
        const disposableIncome = results.totalIncome - results.totalExpenses - results.totalMinPayment;
        const insightContainer = document.getElementById('insight-container');
        const insightElement = document.getElementById('financial-insight');
        insightContainer.classList.remove('insight-warning', 'insight-success', 'insight-neutral');
        if (calculationMode === 'target-date') {
            const requiredExtraForDebt = results.extraPayment;
            const availableAfterSavings = disposableIncome - results.monthlySavings;
            if (availableAfterSavings < requiredExtraForDebt) {
                insightContainer.classList.add('insight-warning');
                const shortfall = requiredExtraForDebt - availableAfterSavings;
                const availableExtraPayment = Math.max(0, availableAfterSavings);
                const achievableSim = runDebtSimulation(JSON.parse(JSON.stringify(results.originalDebts)), results.totalMinPayment + availableExtraPayment);
                insightElement.innerHTML = `<strong class="font-bold">Your Goal is Ambitious!</strong><br>After your savings contribution, you are short by <strong>${formatCurrency(shortfall)}</strong> per month to meet your debt target. <ul class="list-disc list-inside mt-2 space-y-1"><li>With your current budget, it would take <strong>${achievableSim.months} months</strong>.</li><li>To stick to your original goal, find ways to free up <strong>${formatCurrency(shortfall)}</strong> each month.</li></ul>`;
            } else {
                 insightContainer.classList.add('insight-success');
                 insightElement.innerHTML = `Your plan is on track. With a total monthly payment of <strong>${formatCurrency(results.monthlyPayment)}</strong> to debt and saving <strong>${formatCurrency(results.monthlySavings)}</strong>, you will meet your goal.`;
            }
        } else {
             const totalExtraUsed = results.monthlySavings + results.extraPayment;
             if (disposableIncome < totalExtraUsed) {
                insightContainer.classList.add('insight-warning');
                const shortfall = totalExtraUsed - disposableIncome;
                insightElement.innerHTML = `<strong class="font-bold">Budget Warning!</strong> Your planned savings and extra debt payments (${formatCurrency(totalExtraUsed)}) exceed your available income. You are short by <strong>${formatCurrency(shortfall)}</strong>. Please review your income and expenses.`;
             } else if (results.extraPayment > 0.01) {
                insightContainer.classList.add('insight-success');
                const minPaymentSim = runDebtSimulation(JSON.parse(JSON.stringify(results.originalDebts)), results.totalMinPayment);
                const interestSaved = minPaymentSim.totalInterestPaid - results.totalInterest;
                const monthsSaved = minPaymentSim.months - results.monthsToFreedom;
                if (interestSaved > 0.01) {
                    insightElement.innerHTML = `<strong class="font-bold">Great job!</strong> By adding an extra <strong>${formatCurrency(results.extraPayment)}</strong> to your debt and saving <strong>${formatCurrency(results.monthlySavings)}</strong> each month, you will save <strong>${formatCurrency(interestSaved)}</strong> in interest and become debt-free <strong>${monthsSaved} months</strong> sooner!`;
                } else {
                     insightContainer.classList.add('insight-neutral');
                     insightElement.textContent = `Your plan is set. Adding a small extra payment is a great start. See if you can increase it to save even more on interest.`;
                }
            } else {
                insightContainer.classList.add('insight-neutral');
                insightElement.textContent = `Your plan is set. You are currently paying the minimums. By contributing ${formatCurrency(results.monthlySavings)} to savings, you are building a safety net. Consider adding an extra debt payment to save on interest.`;
            }
        }
        const scheduleContainer = document.getElementById('payment-schedule-container');
        scheduleContainer.innerHTML = '';
        scheduleContainer.parentElement.open = true;
        results.paymentSchedule.forEach(monthData => {
            const monthDiv = document.createElement('div');
            monthDiv.className = 'mb-4 p-3 border-b';
            let paymentList = '';
            monthData.payments.forEach(p => { paymentList += `<li class="flex justify-between"><span>${p.name}:</span> <span class="font-medium">${formatCurrency(p.amount)}</span></li>`; });
            monthDiv.innerHTML = `<h4 class="font-semibold text-md text-gray-800">Month ${monthData.month}</h4><ul class="text-sm text-gray-600 mt-2 space-y-1">${paymentList}</ul><p class="text-sm text-gray-800 mt-2 pt-2 border-t font-semibold flex justify-between"><span>Remaining Balance:</span><span>${formatCurrency(monthData.remainingBalance)}</span></p>`;
            scheduleContainer.appendChild(monthDiv);
        });
    };
    // #endregion

    // =======================================================
    // #region SAVE, LOAD, CLEAR (UNIFIED)
    // =======================================================
    const saveData = () => {
        const dataToSave = {
            budgetIncome: document.getElementById('budget-income').value,
            efCurrentSavings: document.getElementById('current-savings').value,
            masterExpenses: Array.from(document.querySelectorAll('.master-expense-item')).map(item => ({ name: item.querySelector('.expense-name').value, amount: item.querySelector('.expense-amount').value, category: item.querySelector('.expense-category').value })),
            monthlySavings: document.getElementById('monthly-savings').value,
            extraPayment: document.getElementById('extra-payment').value,
            targetMonths: document.getElementById('target-months').value,
            strategy: document.getElementById('payoff-strategy-select').value,
            calculationMode: calculationMode,
            debts: Array.from(document.querySelectorAll('#pillar3 .debt-item')).map(item => ({ name: item.querySelector('.debt-name').value, balance: item.querySelector('.debt-balance').value, interest: item.querySelector('.debt-interest').value, minPayment: item.querySelector('.debt-min-payment').value })),
        };
        localStorage.setItem('financialPlanData', JSON.stringify(dataToSave));
        alert("Your plan has been saved!");
    };

    const loadData = () => {
        const savedData = localStorage.getItem('financialPlanData');
        if (!savedData) return;
        const data = JSON.parse(savedData);
        document.getElementById('budget-income').value = data.budgetIncome || 0;
        document.getElementById('current-savings').value = data.efCurrentSavings || 0;
        
        masterExpensesContainer.innerHTML = '';
        if (data.masterExpenses && data.masterExpenses.length > 0) { data.masterExpenses.forEach(e => addMasterExpenseField(e.name, e.amount, e.category)); }
        
        document.getElementById('monthly-savings').value = data.monthlySavings || 0;
        document.getElementById('extra-payment').value = data.extraPayment || 0;
        document.getElementById('target-months').value = data.targetMonths || 0;
        document.getElementById('payoff-strategy-select').value = data.strategy || 'snowball';
        setCalculationMode(data.calculationMode || 'extra-payment');

        debtsContainer.innerHTML = '';
        debtCounter = 0;
        if (data.debts && data.debts.length > 0) { data.debts.forEach(debt => addDebtField(debt)); }
    };
    
    const clearData = () => {
        if (confirm('Are you sure you want to clear all saved data? This cannot be undone.')) {
            localStorage.removeItem('financialPlanData');
            window.location.reload();
        }
    };
    // #endregion

    // =======================================================
    // #region MASTER UPDATE & EVENT LISTENERS
    // =======================================================
    const calculateAndDisplayDebtResults = (income, masterExpenses) => {
        if (!document.getElementById('save-plan-btn')) return;
        const results = calculateDebtFreedomPlan(income, masterExpenses);
        if (results && results.totalDebt > 0) {
            displayDebtResults(results);
        } else if (results) {
            document.getElementById('results-container').classList.add('hidden');
            document.getElementById('empty-state').classList.remove('hidden');
        }
    };

    const updateAllCalculators = () => {
        const masterExpenseItems = document.querySelectorAll('.master-expense-item');
        const masterExpenses = Array.from(masterExpenseItems).map(item => ({ name: item.querySelector('.expense-name').value || 'Unnamed', amount: parseFloat(item.querySelector('.expense-amount').value) || 0, category: item.querySelector('.expense-category').value }));
        const income = parseFloat(document.getElementById('budget-income').value) || 0;
        
        document.getElementById('primary-income').value = income.toFixed(2);
        document.getElementById('total-expenses-display').value = masterExpenses.reduce((sum, e) => sum + e.amount, 0).toFixed(2);
        
        const debtResults = calculateDebtFreedomPlan(income, masterExpenses);
        
        calculateAndDisplayBudget(masterExpenses, debtResults);
        calculateEmergencyFund(masterExpenses);
        
        if (debtResults && debtResults.totalDebt > 0) { displayDebtResults(debtResults); } else if (debtResults) { document.getElementById('results-container').classList.add('hidden'); document.getElementById('empty-state').classList.remove('hidden'); }
    };

    if (document.getElementById('pillar1')) {
        addMasterExpenseBtn.addEventListener('click', () => addMasterExpenseField());
        const budgetIncomeInput = document.getElementById('budget-income');
        budgetIncomeInput.addEventListener('input', updateAllCalculators);
        attachNumberInputListeners(budgetIncomeInput);
    }

    if (document.getElementById('pillar2')) {
        const currentSavingsInput = document.getElementById('current-savings');
        currentSavingsInput.addEventListener('input', updateAllCalculators);
        attachNumberInputListeners(currentSavingsInput);
    }

    if (document.getElementById('pillar3')) {
        document.querySelectorAll('#monthly-savings, #extra-payment, #target-months').forEach(input => {
            input.addEventListener('input', updateAllCalculators);
            attachNumberInputListeners(input);
        });
        document.getElementById('payoff-strategy-select').addEventListener('change', updateAllCalculators);
        addDebtBtn.addEventListener('click', () => addDebtField());
        clearBtn.addEventListener('click', clearData);
        modeExtraPaymentBtn.addEventListener('click', () => { setCalculationMode('extra-payment'); updateAllCalculators(); });
        modeTargetDateBtn.addEventListener('click', () => { setCalculationMode('target-date'); updateAllCalculators(); });
        document.getElementById('save-plan-btn').addEventListener('click', saveData);
    }
    
    // Initial Load
    loadData();
    if(masterExpensesContainer.children.length === 0) addMasterExpenseField();
    if(debtsContainer.children.length === 0) addDebtField();
    updateAllCalculators();
    // #endregion
});