import { UNCATEGORIZED_CODE, UNCATEGORIZED_NAME } from '../constants/accounts.js';

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
            // Use category if set, otherwise use uncategorized code
            const category = tx.category || UNCATEGORIZED_CODE;

            if (!accountBalances[category]) {
                // Ensure category is string for COA lookup
                const account = this.coa.get(String(category));
                accountBalances[category] = {
                    code: category,
                    name: category === UNCATEGORIZED_CODE ? UNCATEGORIZED_NAME : (account?.name || 'Unknown'),
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

            // GST ACCOUNTING: Add GST entry if enabled
            if (tx.gst_enabled && tx.gst_account && tx.tax_cents) {
                const gstAccount = tx.gst_account;
                const gstAmount = (tx.tax_cents || 0) / 100;

                if (!accountBalances[gstAccount]) {
                    const account = this.coa?.get(String(gstAccount)) || this.coa?.get(parseInt(gstAccount));

                    accountBalances[gstAccount] = {
                        code: gstAccount,
                        name: account?.name || `GST Account ${gstAccount}`,
                        debit: 0,
                        credit: 0,
                        balance: 0
                    };
                }

                // GST is always a credit to liability accounts (2150, 2160)
                accountBalances[gstAccount].credit += gstAmount;
            }
        });

        // Calculate initial totals
        let totalDebit = Object.values(accountBalances).reduce((sum, acc) => sum + acc.debit, 0);
        let totalCredit = Object.values(accountBalances).reduce((sum, acc) => sum + acc.credit, 0);

        // FORCE BALANCE: Add any imbalance to Uncategorized
        const imbalance = totalDebit - totalCredit;
        if (Math.abs(imbalance) > 0.01) {
            if (!accountBalances[UNCATEGORIZED_CODE]) {
                accountBalances[UNCATEGORIZED_CODE] = {
                    code: UNCATEGORIZED_CODE,
                    name: UNCATEGORIZED_NAME,
                    debit: 0,
                    credit: 0,
                    balance: 0
                };
            }

            // Add offsetting entry to balance
            if (imbalance > 0) {
                accountBalances[UNCATEGORIZED_CODE].credit += imbalance;
            } else {
                accountBalances[UNCATEGORIZED_CODE].debit += Math.abs(imbalance);
            }
        }

        // Calculate balances
        const accounts = Object.values(accountBalances).map(acc => {
            acc.balance = acc.debit - acc.credit;
            return acc;
        }).sort((a, b) => {
            // Sort: Uncategorized last, others by code
            if (a.code === UNCATEGORIZED_CODE) return 1;
            if (b.code === UNCATEGORIZED_CODE) return -1;
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

        // Calculate running balance using amount_cents + polarity (the actual transaction schema)
        let runningBalance = 0;
        const enriched = filtered.map(tx => {
            const amount = (tx.amount_cents || 0) / 100;
            if (tx.polarity === 'DEBIT') {
                runningBalance += amount;
            } else if (tx.polarity === 'CREDIT') {
                runningBalance -= amount;
            }
            return {
                ...tx,
                balance: runningBalance
            };
        });

        const totalDebit = filtered.reduce((sum, tx) => {
            return tx.polarity === 'DEBIT' ? sum + (tx.amount_cents || 0) / 100 : sum;
        }, 0);
        const totalCredit = filtered.reduce((sum, tx) => {
            return tx.polarity === 'CREDIT' ? sum + (tx.amount_cents || 0) / 100 : sum;
        }, 0);

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
     * Check if a transaction is exempt from GST/HST
     * Exemptions include: payments, payroll, equity draws, FX transactions, bank fees, insurance
     */
    isGSTExempt(tx, account) {
        // Check description keywords for exempt transaction types
        const desc = (tx.description || '').toLowerCase();
        const exemptKeywords = [
            // Credit card payments
            'amex', 'visa', 'mastercard', 'm/c', 'mc', 'american express',
            // Payroll
            'payroll', 'salary', 'wages', 'wage', 'paycheque', 'paycheck',
            // Equity/draws
            'shareholder', 'draw', 'distribution', 'dividend',
            // Banking
            'bank fee', 'service charge', 'bank charge', 'monthly fee',
            // Insurance
            'insurance', 'premium',
            // Other payments
            'online payment', 'e-transfer', 'etransfer', 'debit memo', 'credit memo',
            // Miscellaneous
            'miscellaneous', 'misc'
        ];

        // Check if description contains exempt keywords
        if (exemptKeywords.some(kw => desc.includes(kw))) {
            return true;
        }

        // Check for foreign exchange transactions
        if (tx.fx_rate && tx.fx_rate !== 1.0) {
            return true;
        }

        // Check account class for equity draws and credit card liabilities
        if (account.class === 'EQ_DRAW' ||
            account.class === 'LIABILITY_CC' ||
            account.class === 'EQ_CAPITAL') {
            return true;
        }

        // Check if account is in exempt range (e.g., equity accounts)
        const accountCode = account.code;
        if (accountCode >= '3000' && accountCode < '4000') {  // Equity
            return true;
        }

        return false;
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

            // Check gst_enabled checkbox - user controls GST inclusion per transaction
            if (!tx.gst_enabled) {
                // Skip transactions where GST checkbox is unchecked
                return;
            }

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
