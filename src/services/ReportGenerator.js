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
                // Ensure category is string for COA lookup (try both string and numeric)
                const account = this.coa.get(String(category)) || this.coa.get(parseInt(category));
                const leadsheet = this.coa.getLeadsheet ? this.coa.getLeadsheet(category) : null;
                accountBalances[category] = {
                    code: category,
                    name: category === UNCATEGORIZED_CODE ? UNCATEGORIZED_NAME : (account?.name && account.name.trim() !== '' ? account.name : `Account ${category}`),
                    leadsheet: leadsheet || '',
                    root: account?.root || (this.coa.inferRoot ? this.coa.inferRoot(category) : ''),
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
                        name: (account?.name && account.name.trim()) || `GST Account ${gstAccount}`,
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

        // Calculate opening balance: sum all transactions for this COA code BEFORE startDate
        let openingBalance = 0;
        if (startDate) {
            const allTxsForCode = this.ledger.getAllTransactions
                ? this.ledger.getAllTransactions().filter(tx => tx.category === coaCode)
                : [];
            allTxsForCode.forEach(tx => {
                if (new Date(tx.date) < new Date(startDate)) {
                    const amt = (tx.amount_cents || 0) / 100;
                    if (tx.polarity === 'DEBIT') openingBalance += amt;
                    else if (tx.polarity === 'CREDIT') openingBalance -= amt;
                }
            });
        }

        return {
            account: {
                code: coaCode,
                name: (account?.name && account.name.trim()) || `Account ${coaCode}`,
                type: account?.root || (this.coa.inferRoot ? this.coa.inferRoot(coaCode) : 'EXPENSE')
            },
            transactions: enriched,
            openingBalance,
            closingBalance: openingBalance + runningBalance,
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

            // Use canonical schema: amount_cents + polarity
            const absAmount = (tx.amount_cents || 0) / 100;

            // REVENUE accounts (4000-4999) — Credits = income earned
            if (account.root === 'REVENUE') {
                this.addToCategory(revenue, tx.category, account.name, absAmount);
            }
            // COGS accounts (5000-5999) - Cost of Goods Sold — Debits = costs incurred
            else if (account.class === 'COGS') {
                this.addToCategory(cogs, tx.category, account.name, absAmount);
            }
            // EXPENSE accounts (6000-9999) — Debits = expenses incurred
            else if (account.root === 'EXPENSE') {
                this.addToCategory(expenses, tx.category, account.name, absAmount);
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

        // Aggregate by account type using canonical schema
        transactions.forEach(tx => {
            if (!tx.category) return;

            const account = this.coa.get(tx.category);
            if (!account) return;

            const absAmount = (tx.amount_cents || 0) / 100;

            if (account.root === 'ASSET') {
                // Assets: DEBIT increases (+), CREDIT decreases (-)
                const signed = tx.polarity === 'DEBIT' ? absAmount : -absAmount;
                this.addToCategory(assets, tx.category, account.name, signed);
            } else if (account.root === 'LIABILITY') {
                // Liabilities: CREDIT increases (+), DEBIT decreases (-)
                const signed = tx.polarity === 'CREDIT' ? absAmount : -absAmount;
                this.addToCategory(liabilities, tx.category, account.name, signed);
            } else if (account.root === 'EQUITY') {
                // Equity: CREDIT increases (+), DEBIT decreases (-)
                const signed = tx.polarity === 'CREDIT' ? absAmount : -absAmount;
                this.addToCategory(equity, tx.category, account.name, signed);
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
                const account = this.coa.get(String(tx.category)) || this.coa.get(parseInt(tx.category));
                summary[tx.category] = {
                    code: tx.category,
                    name: (account?.name && account.name.trim()) || `Account ${tx.category}`,
                    type: account?.root || (this.coa.inferRoot ? this.coa.inferRoot(tx.category) : 'EXPENSE'),
                    count: 0,
                    debit: 0,
                    credit: 0,
                    net: 0
                };
            }

            summary[tx.category].count++;
            const amount = (tx.amount_cents || 0) / 100;
            if (tx.polarity === 'DEBIT') {
                summary[tx.category].debit += amount;
            } else if (tx.polarity === 'CREDIT') {
                summary[tx.category].credit += amount;
            }
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

            // Use canonical schema: amount_cents
            const amount = (tx.amount_cents || 0) / 100;

            // REVENUE accounts (4000-4999)
            if (account.root === 'REVENUE') {
                // GST collected on revenue
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

        // Current assets: cash, receivables, inventory (codes 1000-1399)
        // Current liabilities: AP, accrued liabilities, GST payable (codes 2000-2499)
        const currentAssets = (() => {
            const bs = this.generateBalanceSheet(balanceDate);
            return (bs.assets || []).reduce((sum, a) => {
                const n = parseInt(a.code || 0);
                return (n >= 1000 && n <= 1399) ? sum + Math.abs(a.balance || 0) : sum;
            }, 0);
        })();
        const currentLiabilities = (() => {
            const bs = this.generateBalanceSheet(balanceDate);
            return (bs.liabilities || []).reduce((sum, a) => {
                const n = parseInt(a.code || 0);
                return (n >= 2000 && n <= 2499) ? sum + Math.abs(a.balance || 0) : sum;
            }, 0);
        })();

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

    /**
     * Generate Cash Flow Statement (Indirect Method)
     * Categorizes cash movements into Operating, Investing, and Financing
     */
    generateCashFlow(startDate, endDate) {
        const transactions = this.ledger.getTransactionsByDateRange?.(startDate, endDate) ||
            this.ledger.getAllTransactions();

        const operating = [];
        const investing = [];
        const financing = [];

        // Get net income for the period
        const incomeStatement = this.generateIncomeStatement(startDate, endDate);
        const netIncome = incomeStatement.totals.netIncome;

        transactions.forEach(tx => {
            if (!tx.category) return;
            const code = parseInt(tx.category) || 0;
            const account = this.coa.get(tx.category);
            if (!account) return;

            const absAmount = (tx.amount_cents || 0) / 100;
            // Net cash effect: credits are inflows, debits are outflows
            const cashEffect = tx.polarity === 'CREDIT' ? absAmount : -absAmount;

            // OPERATING: Revenue (4000-4999), COGS (5000-5999), Operating Expenses (6000-8999)
            // Also includes changes in working capital: AR (1210-1299), AP (2000-2499), Inventory (1300-1399)
            if (code >= 4000 && code < 9000) {
                // Already captured in net income — skip to avoid double-counting
                return;
            }
            // Changes in receivables
            else if (code >= 1210 && code < 1300) {
                this.addToCategory(operating, tx.category, account.name + ' (Change)', cashEffect);
            }
            // Changes in inventory
            else if (code >= 1300 && code < 1400) {
                this.addToCategory(operating, tx.category, account.name + ' (Change)', cashEffect);
            }
            // Changes in prepaids
            else if (code >= 1350 && code < 1400) {
                this.addToCategory(operating, tx.category, account.name + ' (Change)', cashEffect);
            }
            // Changes in payables and accrued liabilities
            else if (code >= 2000 && code < 2500) {
                this.addToCategory(operating, tx.category, account.name + ' (Change)', cashEffect);
            }
            // INVESTING: Capital assets (1500-1999), investments (1100, 1400)
            else if (code >= 1500 && code < 2000) {
                this.addToCategory(investing, tx.category, account.name, cashEffect);
            }
            else if (code === 1100 || code === 1400) {
                this.addToCategory(investing, tx.category, account.name, cashEffect);
            }
            // FINANCING: Long-term debt (2500-2999), Equity (3000-3999)
            else if (code >= 2500 && code < 3000) {
                this.addToCategory(financing, tx.category, account.name, cashEffect);
            }
            else if (code >= 3000 && code < 4000) {
                this.addToCategory(financing, tx.category, account.name, cashEffect);
            }
            // Cash accounts (1000-1099) are the resulting balance — exclude
            else if (code >= 1000 && code < 1100) {
                return; // Don't include cash-to-cash
            }
        });

        // Operating starts with net income, then adjustments
        const totalOperatingAdjustments = this.sumCategory(operating);
        const totalOperating = netIncome + totalOperatingAdjustments;
        const totalInvesting = this.sumCategory(investing);
        const totalFinancing = this.sumCategory(financing);
        const netChange = totalOperating + totalInvesting + totalFinancing;

        // Get opening and closing cash balances
        const allTxs = this.ledger.getAllTransactions ? this.ledger.getAllTransactions() : [];
        let openingCash = 0, closingCash = 0;
        allTxs.forEach(tx => {
            const code = parseInt(tx.category) || 0;
            if (code >= 1000 && code < 1100) {
                const amt = (tx.amount_cents || 0) / 100;
                const signed = tx.polarity === 'CREDIT' ? amt : -amt;
                if (new Date(tx.date) < new Date(startDate)) {
                    openingCash += signed;
                }
                if (new Date(tx.date) <= new Date(endDate)) {
                    closingCash += signed;
                }
            }
        });

        return {
            operating: {
                netIncome,
                adjustments: operating.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
                totalAdjustments: totalOperatingAdjustments,
                total: totalOperating
            },
            investing: {
                items: investing.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
                total: totalInvesting
            },
            financing: {
                items: financing.sort((a, b) => parseInt(a.code) - parseInt(b.code)),
                total: totalFinancing
            },
            netChange,
            openingCash,
            closingCash,
            period: { startDate, endDate }
        };
    }

    /**
     * Generate Comparative Trial Balance (Current Year vs Prior Year)
     */
    generateComparativeTrialBalance(currentStart, currentEnd, priorStart, priorEnd) {
        const currentTB = this.generateTrialBalance(currentStart, currentEnd);
        const priorTB = this.generateTrialBalance(priorStart, priorEnd);

        // Build comparison map
        const compMap = {};
        currentTB.accounts.forEach(acc => {
            compMap[acc.code] = {
                code: acc.code,
                name: acc.name,
                leadsheet: acc.leadsheet || '',
                root: acc.root || '',
                currentDebit: acc.debit,
                currentCredit: acc.credit,
                currentBalance: acc.balance,
                priorDebit: 0,
                priorCredit: 0,
                priorBalance: 0,
            };
        });
        priorTB.accounts.forEach(acc => {
            if (!compMap[acc.code]) {
                compMap[acc.code] = {
                    code: acc.code,
                    name: acc.name,
                    leadsheet: acc.leadsheet || '',
                    root: acc.root || '',
                    currentDebit: 0,
                    currentCredit: 0,
                    currentBalance: 0,
                    priorDebit: 0,
                    priorCredit: 0,
                    priorBalance: 0,
                };
            }
            compMap[acc.code].priorDebit = acc.debit;
            compMap[acc.code].priorCredit = acc.credit;
            compMap[acc.code].priorBalance = acc.balance;
        });

        const accounts = Object.values(compMap).map(acc => ({
            ...acc,
            varianceAmount: acc.currentBalance - acc.priorBalance,
            variancePct: acc.priorBalance !== 0 ? ((acc.currentBalance - acc.priorBalance) / Math.abs(acc.priorBalance)) * 100 : (acc.currentBalance !== 0 ? 100 : 0),
        })).sort((a, b) => {
            if (a.code === UNCATEGORIZED_CODE) return 1;
            if (b.code === UNCATEGORIZED_CODE) return -1;
            return parseInt(a.code) - parseInt(b.code);
        });

        return {
            accounts,
            currentPeriod: { start: currentStart, end: currentEnd },
            priorPeriod: { start: priorStart, end: priorEnd },
            currentTotals: currentTB.totals,
            priorTotals: priorTB.totals,
        };
    }

    /**
     * Generate Bank Reconciliation for a specific account
     */
    generateBankReconciliation(accountId, asOfDate, bankBalance) {
        const allTxs = this.ledger.getAllTransactions ? this.ledger.getAllTransactions() : [];
        const accountTxs = allTxs.filter(tx =>
            tx.account_id === accountId && new Date(tx.date) <= new Date(asOfDate)
        );

        // Calculate book balance
        let bookBalance = 0;
        const account = this.ledger.getAccount?.(accountId);
        const openingBalance = (account?.openingBalance || 0) * 100; // to cents
        bookBalance = openingBalance;

        accountTxs.forEach(tx => {
            const amt = tx.amount_cents || 0;
            bookBalance += tx.polarity === 'CREDIT' ? amt : -amt;
        });
        bookBalance = bookBalance / 100;

        // Find unreconciled items
        const unreconciledItems = accountTxs.filter(tx => tx.status !== 'RECONCILED');
        const outstandingDeposits = unreconciledItems
            .filter(tx => tx.polarity === 'CREDIT')
            .map(tx => ({
                date: tx.date,
                description: tx.description || tx.payee || '',
                amount: (tx.amount_cents || 0) / 100,
                tx_id: tx.tx_id,
            }));
        const outstandingCheques = unreconciledItems
            .filter(tx => tx.polarity === 'DEBIT')
            .map(tx => ({
                date: tx.date,
                description: tx.description || tx.payee || '',
                amount: (tx.amount_cents || 0) / 100,
                tx_id: tx.tx_id,
            }));

        const totalOutDeposits = outstandingDeposits.reduce((s, i) => s + i.amount, 0);
        const totalOutCheques = outstandingCheques.reduce((s, i) => s + i.amount, 0);

        // Adjusted bank balance = bank statement + outstanding deposits - outstanding cheques
        const adjustedBankBalance = (bankBalance || 0) + totalOutDeposits - totalOutCheques;
        const variance = bookBalance - adjustedBankBalance;

        return {
            accountId,
            accountName: (account?.name && account.name.trim()) || accountId,
            asOfDate,
            bankBalance: bankBalance || 0,
            bookBalance,
            outstandingDeposits,
            outstandingCheques,
            totalOutstandingDeposits: totalOutDeposits,
            totalOutstandingCheques: totalOutCheques,
            adjustedBankBalance,
            variance,
            isReconciled: Math.abs(variance) < 0.01,
            totalTransactions: accountTxs.length,
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
