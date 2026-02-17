import React from 'react';

const HomePage = () => {
    return (
        <div className="min-h-screen bg-white">
            {/* Hero Section */}
            <div className="relative overflow-hidden bg-gradient-to-b from-slate-50 to-white">
                <div className="relative max-w-7xl mx-auto px-6 pt-20 pb-32">
                    {/* Header  */}
                    <div className="text-center mb-16">
                        <div className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-6 py-2 mb-8">
                            <i className="ph ph-sparkle text-blue-600"></i>
                            <span className="text-sm font-semibold text-blue-700">Powered by Advanced ML + Hybrid Intelligence</span>
                        </div>

                        <h1 className="text-6xl font-bold text-slate-900 mb-6">
                            RoboLedger<span className="text-blue-600">.AI</span>
                        </h1>

                        <p className="text-xl text-slate-600 mb-12 max-w-4xl mx-auto leading-relaxed">
                            Intelligent accounting automation with <span className="text-blue-600 font-semibold">100k+ vendor training</span>,
                            <span className="text-blue-600 font-semibold"> adaptive learning</span>, and
                            <span className="text-blue-600 font-semibold"> client-side privacy</span>
                        </p>

                        <div className="flex items-center justify-center gap-4">
                            <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                <i className="ph ph-upload mr-2"></i>
                                Start Categorizing
                            </button>
                            <button className="px-8 py-3 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:border-slate-400 transition-colors">
                                <i className="ph ph-play-circle mr-2"></i>
                                See How It Works
                            </button>
                        </div>
                    </div>

                    {/* Lifecycle Diagram */}
                    <div className="bg-white border-2 border-slate-200 rounded-2xl p-12 shadow-sm mb-20">
                        <h2 className="text-3xl font-bold text-slate-900 mb-8 text-center">
                            <i className="ph ph-flow-arrow text-blue-600 mr-3"></i>
                            RoboLedger Lifecycle
                        </h2>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
                            {/* Step 1 */}
                            <div className="relative">
                                <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        <i className="ph ph-file-arrow-up"></i>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Import</h3>
                                    <p className="text-sm text-slate-600">CSV, PDF, 20+ bank formats</p>
                                </div>
                                <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-slate-400 text-2xl">→</div>
                            </div>

                            {/* Step 2 */}
                            <div className="relative">
                                <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        <i className="ph ph-brain"></i>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">ML Match</h3>
                                    <p className="text-sm text-slate-600">3-tier: Rules → Dictionary → Fuzzy</p>
                                </div>
                                <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-slate-400 text-2xl">→</div>
                            </div>

                            {/* Step 3 */}
                            <div className="relative">
                                <div className="bg-pink-50 border-2 border-pink-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-pink-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        <i className="ph ph-arrows-clockwise"></i>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Learn</h3>
                                    <p className="text-sm text-slate-600">User corrections boost confidence</p>
                                </div>
                                <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-slate-400 text-2xl">→</div>
                            </div>

                            {/* Step 4 */}
                            <div className="relative">
                                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        <i className="ph ph-check-circle"></i>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Validate</h3>
                                    <p className="text-sm text-slate-600">Double-entry + GST reconciliation</p>
                                </div>
                                <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 text-slate-400 text-2xl">→</div>
                            </div>

                            {/* Step 5 */}
                            <div className="relative">
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-6 text-center hover:shadow-md transition-shadow">
                                    <div className="w-16 h-16 mx-auto mb-4 bg-amber-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                                        <i className="ph ph-chart-line"></i>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900 mb-2">Report</h3>
                                    <p className="text-sm text-slate-600">Trial balance, P&L, GST</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Features Grid */}
            <div className="max-w-7xl mx-auto px-6 pb-32 bg-gray-50">
                <div className="text-center mb-16 pt-20">
                    <h2 className="text-4xl font-bold text-slate-900 mb-4">
                        Features
                    </h2>
                    <p className="text-lg text-slate-600">Production-grade ML + enterprise accounting in your browser</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {/* ML Features */}
                    <FeatureCard
                        icon="brain"
                        iconColor="text-purple-400"
                        title="33MB Training Dataset"
                        description="100k+ vendor-to-COA mappings with confidence scores and alternative suggestions"
                        tags={["ML", "Core"]}
                    />

                    <FeatureCard
                        icon="arrows-clockwise"
                        iconColor="text-blue-400"
                        title="Adaptive Learning"
                        description="User corrections boost confidence logarithmically. Your model improves with every transaction."
                        tags={["ML", "Learning"]}
                    />

                    <FeatureCard
                        icon="lightbulb"
                        iconColor="text-yellow-400"
                        title="Explainable AI"
                        description="See exactly why each category was suggested with confidence scores and match reasoning"
                        tags={["ML", "UX"]}
                    />

                    <FeatureCard
                        icon="tree-structure"
                        iconColor="text-green-400"
                        title="3-Tier Matching"
                        description="Rules (1.0) → Dictionary (0.6-1.0) → Fuzzy ML (0.7+). Graceful degradation built-in."
                        tags={["Architecture"]}
                    />

                    <FeatureCard
                        icon="shield-check"
                        iconColor="text-emerald-400"
                        title="Client-Side Privacy"
                        description="All data stays in your browser. Zero server uploads. IndexedDB + optional encryption."
                        tags={["Security", "Core"]}
                    />

                    <FeatureCard
                        icon="book-open"
                        iconColor="text-orange-400"
                        title="Double-Entry Accounting"
                        description="GAAP-compliant ledger with automatic debit/credit balancing and audit trails"
                        tags={["Accounting"]}
                    />

                    {/* Backend Capabilities */}
                    <FeatureCard
                        icon="database"
                        iconColor="text-cyan-400"
                        title="Event Sourcing (Roadmap)"
                        description="Immutable event log, time-travel debugging, and complete audit trail of all changes"
                        tags={["Backend", "Future"]}
                    />

                    <FeatureCard
                        icon="git-branch"
                        iconColor="text-pink-400"
                        title="Model Versioning"
                        description="Snapshot, rollback, and A/B test ML models with golden dataset regression testing"
                        tags={["ML", "DevOps"]}
                    />

                    <FeatureCard
                        icon="chart-pie"
                        iconColor="text-violet-400"
                        title="ML Observability"
                        description="Match rates by tier, confidence distributions, correction frequency analytics"
                        tags={["ML", "Analytics"]}
                    />

                    <FeatureCard
                        icon="lock"
                        iconColor="text-red-400"
                        title="Transparent Encryption"
                        description="AES-256 client-side encryption with password-protected exports and secure backups"
                        tags={["Security", "Future"]}
                    />

                    <FeatureCard
                        icon="cloud-arrow-up"
                        iconColor="text-sky-400"
                        title="Cloud Backup (Roadmap)"
                        description="Encrypted sync to Google Drive/Dropbox with point-in-time recovery"
                        tags={["Backend", "Future"]}
                    />

                    <FeatureCard
                        icon="users-three"
                        iconColor="text-indigo-400"
                        title="Multi-User (Future)"
                        description="Real-time collaboration, approval workflows, and team learning with conflict resolution"
                        tags={["Collaboration", "Future"]}
                    />
                </div>

                {/* Stats Section */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-20">
                    <StatCard number="100k+" label="Vendor Mappings" />
                    <StatCard number="33MB" label="Training Data" />
                    <StatCard number="20+" label="Bank Parsers" />
                    <StatCard number="3-Tier" label="ML Architecture" />
                </div>

                {/* CTA */}
                <div className="mt-32 text-center">
                    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-6">
                            Ready to Automate Your Accounting?
                        </h2>
                        <p className="text-lg text-slate-600 mb-8 max-w-2xl mx-auto">
                            Join the future of intelligent bookkeeping. No credit card required.
                        </p>
                        <div className="flex items-center justify-center gap-4">
                            <button className="px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                                Get Started Free
                            </button>
                            <button className="px-8 py-3 bg-white border-2 border-slate-300 text-slate-700 font-semibold rounded-lg hover:border-slate-400 transition-colors">
                                View Documentation
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const FeatureCard = ({ icon, iconColor, title, description, tags }) => (
    <div className="group bg-white border-2 border-slate-200 rounded-xl p-6 hover:border-blue-300 hover:shadow-md transition-all">
        <div className={`w-14 h-14 mb-4 bg-slate-100 rounded-xl flex items-center justify-center ${iconColor} text-3xl`}>
            <i className={`ph ph-${icon}`}></i>
        </div>
        <h3 className="text-lg font-bold text-slate-900 mb-2">{title}</h3>
        <p className="text-sm text-slate-600 mb-4 leading-relaxed">{description}</p>
        <div className="flex gap-2 flex-wrap">
            {tags.map((tag, idx) => (
                <span key={idx} className="px-3 py-1 bg-blue-100 border border-blue-300 text-blue-700 text-xs font-semibold rounded-full">
                    {tag}
                </span>
            ))}
        </div>
    </div>
);

const StatCard = ({ number, label }) => (
    <div className="bg-white border-2 border-slate-200 rounded-xl p-8 text-center hover:border-blue-300 transition-all">
        <div className="text-4xl font-bold text-blue-600 mb-2">
            {number}
        </div>
        <div className="text-sm text-slate-600 font-semibold uppercase tracking-wider">{label}</div>
    </div>
);

export default HomePage;
