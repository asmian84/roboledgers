/**
 * Default category structure for RoboLedger
 * 
 * Organized by business expense types with sensible defaults
 */

export const DEFAULT_CATEGORIES = [
    {
        name: "Business Expenses",
        icon: "briefcase",
        color: "#f59e0b", // amber-500
        children: [
            { name: "Software & SaaS", icon: "code", color: "#f59e0b" },
            { name: "Travel & Entertainment", icon: "plane", color: "#3b82f6" },
            { name: "Office Supplies", icon: "package", color: "#8b5cf6" },
            { name: "Marketing & Advertising", icon: "megaphone", color: "#ec4899" },
            { name: "Professional Services", icon: "users", color: "#14b8a6" }
        ]
    },
    {
        name: "Utilities",
        icon: "zap",
        color: "#10b981", // emerald-500
        children: [
            { name: "Phone & Internet", icon: "phone", color: "#10b981" },
            { name: "Electricity & Gas", icon: "bolt", color: "#f59e0b" },
            { name: "Water & Sewer", icon: "droplet", color: "#3b82f6" }
        ]
    },
    {
        name: "Automotive",
        icon: "car",
        color: "#6366f1", // indigo-500
        children: [
            { name: "Fuel", icon: "fuel", color: "#f59e0b" },
            { name: "Maintenance & Repairs", icon: "wrench", color: "#ef4444" },
            { name: "Insurance", icon: "shield", color: "#3b82f6" },
            { name: "Parking & Tolls", icon: "parking", color: "#8b5cf6" }
        ]
    },
    {
        name: "Retail & Shopping",
        icon: "shopping-cart",
        color: "#ec4899", // pink-500
        children: [
            { name: "Groceries", icon: "apple", color: "#10b981" },
            { name: "Clothing", icon: "shirt", color: "#ec4899" },
            { name: "Electronics", icon: "laptop", color: "#6366f1" },
            { name: "Home & Garden", icon: "home", color: "#f59e0b" }
        ]
    },
    {
        name: "Food & Dining",
        icon: "utensils",
        color: "#f97316", // orange-500
        children: [
            { name: "Restaurants", icon: "restaurant", color: "#f97316" },
            { name: "Coffee & Cafes", icon: "coffee", color: "#92400e" },
            { name: "Fast Food", icon: "burger", color: "#dc2626" }
        ]
    },
    {
        name: "Entertainment",
        icon: "film",
        color: "#a855f7", // purple-500
        children: [
            { name: "Streaming Services", icon: "tv", color: "#a855f7" },
            { name: "Events & Tickets", icon: "ticket", color: "#ec4899" },
            { name: "Hobbies", icon: "palette", color: "#14b8a6" }
        ]
    },
    {
        name: "Healthcare",
        icon: "heart",
        color: "#ef4444", // red-500
        children: [
            { name: "Medical", icon: "stethoscope", color: "#ef4444" },
            { name: "Dental", icon: "tooth", color: "#3b82f6" },
            { name: "Pharmacy", icon: "pill", color: "#10b981" }
        ]
    },
    {
        name: "Financial Services",
        icon: "bank",
        color: "#14b8a6", // teal-500
        children: [
            { name: "Bank Fees", icon: "credit-card", color: "#ef4444" },
            { name: "Interest & Finance Charges", icon: "percent", color: "#f59e0b" },
            { name: "Investments", icon: "trending-up", color: "#10b981" }
        ]
    },
    {
        name: "Uncategorized",
        icon: "help-circle",
        color: "#94a3b8", // slate-400
        children: []
    }
];
