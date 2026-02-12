import React, { useState, useEffect } from 'react';

export function HomePage({ onNavigate }) {
    const [stats, setStats] = useState({
        totalAccounts: 0,
        totalTransactions: 0,
        reconciledPercent: 0,
        uncategorized: 0,
        recentFiles: []
    });

    useEffect(() => {
        // Load real data from RoboLedger
        if (window.RoboLedger?.Ledger) {
            const allTransactions = window.RoboLedger.Ledger.getAll();
            const accounts = window.RoboLedger.AccountManager?.getAll() || [];

            // Calculate stats
            const reconciled = allTransactions.filter(t => t.reconciled).length;
            const uncategorized = allTransactions.filter(t => !t.account_code || t.account_code === '9970').length;

            // Get unique source files from last 7 days
            const recentFiles = [...new Set(
                allTransactions
                    .filter(t => t.source_pdf?.filename)
                    .map(t => ({
                        name: t.source_pdf.filename,
                        date: t.date
                    }))
            )].slice(0, 5);

            setStats({
                totalAccounts: accounts.length,
                totalTransactions: allTransactions.length,
                reconciledPercent: allTransactions.length > 0
                    ? Math.round((reconciled / allTransactions.length) * 100)
                    : 0,
                uncategorized,
                recentFiles
            });
        }
    }, []);

    const quickActions = [
        {
            icon: 'ph-upload',
            title: 'Import Transactions',
            description: 'Upload bank statements and process transactions',
            gradient: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
            route: 'import'
        },
        {
            icon: 'ph-folders',
            title: 'All Accounts',
            description: 'View and manage all accounts',
            gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            route: 'accounts'
        },
        {
            icon: 'ph-list-bullets',
            title: 'Chart of Accounts',
            description: 'Configure your account structure',
            gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
            route: 'coa'
        },
        {
            icon: 'ph-chart-line',
            title: 'Reports & Analytics',
            description: 'View financial reports and insights',
            gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            route: 'reports'
        }
    ];

    return (
        <div className="homepage-container">
            {/* Hero Section */}
            <div className="homepage-hero">
                <div className="hero-content">
                    <div className="hero-logo">
                        <i className="ph-fill ph-robot" style={{ fontSize: '64px', color: '#3b82f6' }}></i>
                    </div>
                    <h1 className="hero-title">RoboLedger</h1>
                    <p className="hero-tagline">Automated Ledger Intelligence</p>

                    {/* Stats Dashboard */}
                    <div className="hero-stats">
                        <div className="stat-card">
                            <i className="ph ph-folders stat-icon"></i>
                            <div className="stat-value">{stats.totalAccounts}</div>
                            <div className="stat-label">Accounts</div>
                        </div>
                        <div className="stat-card">
                            <i className="ph ph-swap stat-icon"></i>
                            <div className="stat-value">{stats.totalTransactions.toLocaleString()}</div>
                            <div className="stat-label">Transactions</div>
                        </div>
                        <div className="stat-card">
                            <i className="ph ph-check-circle stat-icon"></i>
                            <div className="stat-value">{stats.reconciledPercent}%</div>
                            <div className="stat-label">Reconciled</div>
                        </div>
                        <div className="stat-card warning">
                            <i className="ph ph-warning stat-icon"></i>
                            <div className="stat-value">{stats.uncategorized}</div>
                            <div className="stat-label">Uncategorized</div>
                        </div>
                    </div>

                    <button
                        className="hero-cta"
                        onClick={() => onNavigate('import')}
                    >
                        <i className="ph ph-upload" style={{ marginRight: '8px' }}></i>
                        Import Transactions
                    </button>
                </div>
            </div>

            {/* Quick Actions Grid */}
            <div className="homepage-section">
                <h2 className="section-title">Quick Actions</h2>
                <div className="action-cards-grid">
                    {quickActions.map((action, index) => (
                        <div
                            key={index}
                            className="action-card"
                            onClick={() => onNavigate(action.route)}
                            style={{ '--card-gradient': action.gradient }}
                        >
                            <div className="action-card-header">
                                <div className="action-icon-wrapper">
                                    <i className={`ph ${action.icon}`}></i>
                                </div>
                            </div>
                            <h3 className="action-card-title">{action.title}</h3>
                            <p className="action-card-description">{action.description}</p>
                            <div className="action-card-arrow">
                                <i className="ph ph-arrow-right"></i>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recent Activity */}
            {stats.recentFiles.length > 0 && (
                <div className="homepage-section">
                    <h2 className="section-title">Recent Activity</h2>
                    <div className="recent-activity-list">
                        {stats.recentFiles.map((file, index) => (
                            <div key={index} className="activity-item">
                                <i className="ph ph-file-pdf activity-icon"></i>
                                <div className="activity-details">
                                    <div className="activity-title">{file.name}</div>
                                    <div className="activity-meta">Imported • {file.date}</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Getting Started (if no data) */}
            {stats.totalTransactions === 0 && (
                <div className="homepage-section">
                    <div className="getting-started-card">
                        <i className="ph ph-rocket-launch" style={{ fontSize: '48px', color: '#3b82f6', marginBottom: '16px' }}></i>
                        <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>
                            Get Started with RoboLedger
                        </h2>
                        <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>
                            Import your first bank statement to begin automated ledger processing
                        </p>
                        <button
                            className="hero-cta"
                            onClick={() => onNavigate('import')}
                        >
                            <i className="ph ph-upload" style={{ marginRight: '8px' }}></i>
                            Import Your First Statement
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
