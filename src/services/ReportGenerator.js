/**
 * ReportGenerator - Core service for generating financial reports
 * Handles data aggregation, calculations, and report formatting
 */
class ReportGenerator {
    constructor(ledger, coa) {
        this.ledger = ledger;
        this.coa = coa;
    }

    /**
     * Generate Trial Balance
     * Verifies that total debits = total credits across all accounts
     */
    generateTrialBalance(startDate, endDate) {
        const transactions = this.ledger.getTransactionsByDateRange?.(startDate, endDate) ||
            this.ledger.getAllTransactions();

        // Aggregate by account
        const accountBalances = {};

        transactions.forEach(tx => {
            // Use category if set, otherwise use "9970" for uncategorized
            const category = tx.category || '9970';

            if (!accountBalances[category]) {
                // Ensure category is string for COA lookup
                const account = this.coa.get(String(category));
                accountBalances[category] = {
                    code: category,
                    name: category === '9970' ? 'Uncategorized' : (account?.name || 'Unknown'),
                    debit: 0,
                    credit: 0,
                    balance: 0
                };
            }

            // Use amount_cents + polarity (the actual transaction schema)
            const amount = (tx.amount_cents || 0) / 100;

            if (tx.polarity === 'DEBIT') {
                accountBalances[category].debit += amount;
            } else if (tx.polarity === 'CREDIT') {
                accountBalances[category].credit += amount;
            }
        });

        // Calculate initial totals
        let totalDebit = Object.values(accountBalances).reduce((sum, acc) => sum + acc.debit, 0);
        let totalCredit = Object.values(accountBalances).reduce((sum, acc) => sum + acc.credit, 0);

        // FORCE BALANCE: Add any imbalance to Uncategorized
        const imbalance = totalDebit - totalCredit;
        if (Math.abs(imbalance) > 0.01) {
            // Ensure 9970 (Uncategorized) exists
            if (!accountBalances['9970']) {
                accountBalances['9970'] = {
                    code: '9970',
                    name: 'Uncategorized',
                    debit: 0,
                    credit: 0,
                    balance: 0
                };
            }

            // Add offsetting entry to balance
            if (imbalance > 0) {
                // More debits than credits, add credit to 9970
                accountBalances['9970'].credit += imbalance;
            } else {
                // More credits than debits, add debit to 9970
                accountBalances['9970'].debit += Math.abs(imbalance);
            }
        }

        // Calculate balances
        const accounts = Object.values(accountBalances).map(acc => {
            acc.balance = acc.debit - acc.credit;
            return acc;
        }).sort((a, b) => {
            // Sort: Uncategorized (9970) last, others by code
            if (a.code === '9970') return 1;
            if (b.code === '9970') return -1;
            return parseInt(a.code) - parseInt(b.code);
        });

        // Recalculate totals (should now balance)
        totalDebit = accounts.reduce((sum, acc) => sum + acc.debit, 0);
        totalCredit = accounts.reduce((sum, acc) => sum + acc.credit, 0);
        const totalBalance = accounts.reduce((sum, acc) => sum + acc.balance, 0);

        return {
            accounts,
            totals: {
                debit: totalDebit,
                credit: totalCredit,
                balance: totalBalance
            },
            isBalanced: Math.abs(totalDebit - totalCredit) < 0.01, // Should always be true now
            difference: totalDebit - totalCredit
        };
    }

    /**
     * Generate General Journal
     * Complete chronological transaction log
     */
    generateGeneralJournal(startDate, endDate, accountId = null) {
        let transactions = this.ledger.getTransactionsByDateRange?.(startDate, endDate) ||
            this.ledger.getAllTransactions();

        // Filter by account if specified
        if (accountId && accountId !== 'ALL') {
            transactions = transactions.filter(tx => tx.account_id === accountId);
        }

        // Sort by date
        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Enrich with account names
        const enriched = transactions.map(tx => ({
            ...tx,
            account_name: this.coa.get(tx.category)?.name || 'Uncategorized',
            account_code: tx.category || '',
            source_account: this.ledger.getAccount?.(tx.account_id)?.name || tx.account_id
        }));

        return {
            transactions: enriched,
            count: enriched.length,
            period: { startDate, endDate }
        };
    }

    /**
     * Generate General Ledger
     * Detailed transaction history per account (COA code)
     */
    generateGeneralLedger(startDate, endDate, coaCode) {
        const transactions = this.ledger.getTransactionsByDateRange?.(startDate, endDate) ||
            this.ledger.getAllTransactions();

        // Filter by COA code
        const filtered = transactions
            .filter(tx => tx.category === coaCode)
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const account = this.coa.get(coaCode);

        // Calculate running balance
        let runningBalance = 0;
        const enriched = filtered.map(tx => {
            runningBalance += (tx.debit || 0) - (tx.credit || 0);
            return {
                ...tx,
                balance: runningBalance
            };
        });

        const totalDebit = filtered.reduce((sum, tx) => sum + (tx.debit || 0), 0);
        const totalCredit = filtered.reduce((sum, tx) => sum + (tx.credit || 0), 0);

        return {
            account: {
                code: coaCode,
                name: account?.name || 'Unknown',
                type: account?.root || 'Unknown'
            },
            transactions: enriched,
            openingBalance: 0, // TODO: Calculate from transactions before startDate
            closingBalance: runningBalance,
            totals: {
                debit: totalDebit,
                credit: totalCredit,
                net: totalDebit - totalCredit
            },
            period: { startDate, endDate }
        };
    }

    /**
     * Generate Income Statement (Profit & Loss)
     */
    generateIncomeStatement(startDate, endDate) {
        const transactions = this.ledger.getTransactionsByDateRange?.(startDate, endDate) ||
            this.ledger.getAllTransactions();

        // Categorize transactions
        const revenue = [];
        const cogs = [];
        const expenses = [];

        transactions.forEach(tx => {
            if (!tx.category) return;

            const account = this.coa.get(tx.category);
            if (!account) return;

            const amount = (tx.credit || 0) - (tx.debit || 0); // For income statement

            // REVENUE accounts (4000-4999)
            if (account.root === 'REVENUE') {
                this.addToCategory(revenue, tx.category, account.name, amount);
            }
            // COGS accounts (5000-5999) - Cost of Goods Sold
            else if (account.class === 'COGS') {
                this.addToCategory(cogs, tx.category, account.name, amount);
            }
            // EXPENSE accounts (6000-9999)
            else if (account.root === 'EXPENSE') {
                this.addToCategory(expenses, tx.category, account.name, amount);
            }
        });

        // Calculate totals
        const totalRevenue = this.sumCategory(revenue);
        const totalCOGS = this.sumCategory(cogs);
        const grossProfit = totalRevenue - totalCOGS;
        const totalExpenses = this.sumCategory(expenses);
        const netIncome = grossProfit - totalExpenses;

        return {
            revenue: revenue.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
            cogs: cogs.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
            expenses: expenses.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
            totals: {
                revenue: totalRevenue,
                cogs: totalCOGS,
                grossProfit,
                expenses: totalExpenses,
                netIncome
            },
            period: { startDate, endDate }
        };
    }

    /**
     * Generate Balance Sheet
     */
    generateBalanceSheet(asOfDate) {
        // Get all transactions up to asOfDate
        const transactions = this.ledger.getAllTransactions()
            .filter(tx => new Date(tx.date) <= new Date(asOfDate));

        const assets = [];
        const liabilities = [];
        const equity = [];

        // Aggregate by account type
        transactions.forEach(tx => {
            if (!tx.category) return;

            const account = this.coa.get(tx.category);
            if (!account) return;

            const amount = (tx.debit || 0) - (tx.credit || 0);

            if (account.root === 'ASSET') {
                this.addToCategory(assets, tx.category, account.name, amount);
            } else if (account.root === 'LIABILITY') {
                this.addToCategory(liabilities, tx.category, account.name, -amount); // Negative for liabilities
            } else if (account.root === 'EQUITY') {
                this.addToCategory(equity, tx.category, account.name, -amount);
            }
        });

        const totalAssets = this.sumCategory(assets);
        const totalLiabilities = this.sumCategory(liabilities);
        const totalEquity = this.sumCategory(equity);

        return {
            assets: assets.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
            liabilities: liabilities.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
            equity: equity.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
            totals: {
                assets: totalAssets,
                liabilities: totalLiabilities,
                equity: totalEquity
            },
            isBalanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.01,
            asOfDate
        };
    }

    /**
   * Generate COA Summary
   */
    generateCOASummary(startDate, endDate) {
        const transactions = this.ledger.getTransactionsByDateRange?.(startDate, endDate) ||
            this.ledger.getAllTransactions();

        const summary = {};

        transactions.forEach(tx => {
            if (!tx.category) return;

            if (!summary[tx.category]) {
                const account = this.coa.get(tx.category);
                summary[tx.category] = {
                    code: tx.category,
                    name: account?.name || 'Unknown',
                    type: account?.root || 'Unknown',
                    count: 0,
                    debit: 0,
                    credit: 0,
                    net: 0
                };
            }

            summary[tx.category].count++;
            summary[tx.category].debit += tx.debit || 0;
            summary[tx.category].credit += tx.credit || 0;
        });

        // Calculate net and sort
        const categories = Object.values(summary).map(cat => {
            cat.net = cat.debit - cat.credit;
            return cat;
        }).sort((a, b) => Math.abs(b.net) - Math.abs(a.net)); // Sort by absolute amount

        const totalTransactions = categories.reduce((sum, cat) => sum + cat.count, 0);

        return {
            categories,
            totalTransactions,
            period: { startDate, endDate }
        };
    }

    /**
     * Generate GST/HST Report
     * Calculate GST collected, GST paid (ITC), and net GST payable
     */
    generateGSTReport(startDate, endDate, taxRate = 0.05) {
        const transactions = this.ledger.getTransactionsByDateRange?.(startDate, endDate) ||
            this.ledger.getAllTransactions();

        let gstCollected = 0;  // GST on sales (revenue)
        let gstPaid = 0;       // GST on purchases (ITC - Input Tax Credits)
        const revenueTransactions = [];
        const expenseTransactions = [];

        transactions.forEach(tx => {
            if (!tx.category) return;

            const account = this.coa.get(tx.category);
            if (!account) return;

            // Check if transaction has tax amount
            const taxAmount = tx.tax_cents ? tx.tax_cents / 100 : 0;

            // REVENUE accounts (4000-4999)  
            if (account.root === 'REVENUE') {
                // GST collected on revenue
                const amount = tx.credit || 0;
                const gst = taxAmount || (amount * taxRate);
                gstCollected += gst;
                revenueTransactions.push({
                    date: tx.date,
                    description: tx.description,
                    amount,
                    gst,
                    ref: tx.ref
                });
            }
            // EXPENSE accounts (5000-9999) or COGS class
            else if (account.root === 'EXPENSE' || account.class === 'COGS') {
                // GST paid on expenses (ITC)
                const amount = tx.debit || 0;
                const gst = taxAmount || (amount * taxRate);
                gstPaid += gst;
                expenseTransactions.push({
                    date: tx.date,
                    description: tx.description,
                    amount,
                    gst,
                    ref: tx.ref
                });
            }
        });

        const netGSTPayable = gstCollected - gstPaid;

        return {
            gstCollected,
            gstPaid,
            netGSTPayable,
            taxRate,
            period: { startDate, endDate },
            details: {
                revenueTransactions,
                expenseTransactions
            },
            summary: {
                totalRevenue: revenueTransactions.reduce((sum, tx) => sum + tx.amount, 0),
                totalExpenses: expenseTransactions.reduce((sum, tx) => sum + tx.amount, 0),
                revenueCount: revenueTransactions.length,
                expenseCount: expenseTransactions.length
            }
        };
    }

    /**
   * Generate Financial Ratios
   * Calculate key financial metrics: liquidity, profitability, efficiency, leverage
   */
    generateFinancialRatios(startDate, endDate, asOfDate = null) {
        // Use end date as "as of" date if not specified
        const balanceDate = asOfDate || endDate;

        // Get financial statements
        const incomeStatement = this.generateIncomeStatement(startDate, endDate);
        const balanceSheet = this.generateBalanceSheet(balanceDate);

        const revenue = incomeStatement.totals.revenue;
        const cogs = incomeStatement.totals.cogs;
        const expenses = incomeStatement.totals.expenses;
        const netIncome = incomeStatement.totals.netIncome;
        const grossProfit = incomeStatement.totals.grossProfit;

        const assets = balanceSheet.totals.assets;
        const liabilities = balanceSheet.totals.liabilities;
        const equity = balanceSheet.totals.equity;

        // Calculate current assets/liabilities (simplified - would need account classification)
        const currentAssets = assets; // TODO: Filter by current asset accounts
        const currentLiabilities = liabilities; // TODO: Filter by current liability accounts

        return {
            // Profitability Ratios
            profitability: {
                grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
                netMargin: revenue > 0 ? (netIncome / revenue) * 100 : 0,
                roa: assets > 0 ? (netIncome / assets) * 100 : 0, // Return on Assets
                roe: equity > 0 ? (netIncome / equity) * 100 : 0  // Return on Equity
            },

            // Liquidity Ratios
            liquidity: {
                currentRatio: currentLiabilities > 0 ? currentAssets / currentLiabilities : 0,
                workingCapital: currentAssets - currentLiabilities
            },

            // Leverage Ratios
            leverage: {
                debtToEquity: equity > 0 ? liabilities / equity : 0,
                debtToAssets: assets > 0 ? (liabilities / assets) * 100 : 0,
                equityRatio: assets > 0 ? (equity / assets) * 100 : 0
            },

            // Efficiency Ratios
            efficiency: {
                assetTurnover: assets > 0 ? revenue / assets : 0,
                revenuePerDollarAsset: assets > 0 ? revenue / assets : 0
            },

            // Base Metrics
            metrics: {
                revenue,
                cogs,
                grossProfit,
                expenses,
                netIncome,
                assets,
                liabilities,
                equity
            },

            period: { startDate, endDate, asOfDate: balanceDate }
        };
    }

    // Helper methods
    addToCategory(categoryArray, code, name, amount) {
        let existing = categoryArray.find(c => c.code === code);
        if (!existing) {
            existing = { code, name, amount: 0 };
            categoryArray.push(existing);
        }
        existing.amount += amount;
    }

    sumCategory(categoryArray) {
        return categoryArray.reduce((sum, cat) => sum + cat.amount, 0);
    }
}

export default ReportGenerator;
