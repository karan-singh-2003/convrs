export const PLAN_COMPARE_FEATURES: {
    category: string;
    features: {
        text: string;
        check?: boolean | {
            default?: boolean;
            pro?: boolean;
            enterprise?: boolean;
        };
    }[];
}[] = [
        {
            category: "Inventory",
            features: [
                {
                    text: "Global Flights",
                },
                {
                    text: "Global Hotels",
                },
                {
                    text: "Global Sightseeings",
                },
                {
                    text: "Add Custom APIs (Your API Key - Additional Charges)",
                },
                {
                    text: "Offline Contracting & Supplier Management",
                    check: { default: false, enterprise: true },
                },
            ],
        },

        {
            category: "Engine Flows",
            features: [
                {
                    text: "Flight Booking Engine",

                },
                {
                    text: "Hotel Booking Engine",

                },
                {
                    text: "Sightseeing Booking Engine",

                },
                {
                    text: "Dynamic Package Booking Engine",
                },
            ],
        },

        {
            category: "AI Powered Dynamic Packaging & Recommendation Engine",
            features: [
                {
                    text: "AI-Based Flight Recommendation Engine",

                },
                {
                    text: "AI-Based Hotel Recommendation Engine",

                },
                {
                    text: "AI-Guided Sightseeing Recommendation Engine",

                },
                {
                    text: "Dynamic Package Scheduler",

                },
            ],
        },

        {
            category: "Dashboard & Back Office",
            features: [
                {
                    text: "General Dashboard KPIs",

                },
                {
                    text: "B2B / B2C User Management",

                },
                {
                    text: "Booking Ledger",

                },
                {
                    text: "Sales Ledger",

                },
                {
                    text: "Staff Management",
                    check: { default: false, pro: true, enterprise: true },
                },
                {
                    text: "Task Management",
                    check: { default: false, pro: true, enterprise: true },
                },
                {
                    text: "Add & Manage Other Services",
                    check: { default: false, pro: true, enterprise: true },
                },
                {
                    text: "Custom Text with Vouchers",
                    check: { default: false, pro: true, enterprise: true },
                },
            ],
        },

        {
            category: "Communication With User",
            features: [
                {
                    text: "Traveler Mobile App",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "Email & WhatsApp Quotation Sharing",

                },
                {
                    text: "Dynamic Flight Quotations",

                },
                {
                    text: "Dynamic Hotel Quotations",

                },
                {
                    text: "Dynamic Sightseeing Quotations",

                },
                {
                    text: "Dynamic Package Quotations",
                },
            ],
        },

        {
            category: "Whitelabel Management",
            features: [
                {
                    text: "1 B2B / B2C Whitelabel Website",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "1 B2B / B2C Whitelabel Back Office",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "B2C / B2B User Area",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "Whitelabel Booking Queue",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "Whitelabel Transaction Queue",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "Whitelabel Voucher Generation",
                    check: { default: false, pro: true, enterprise: true },
                },
                {
                    text: "Discount Code Management",
                    check: { default: false, pro: false, enterprise: true },
                },
            ],
        },

        {
            category: "Financial Module",
            features: [
                {
                    text: "Micro-Level Service Fee Management",

                },
                {
                    text: "Invoice Ledger",

                },
                {
                    text: "Custom Text with Invoice",
                    check: { default: false, pro: true, enterprise: true },
                },
            ],
        },

        {
            category: "Payment",
            features: [
                {
                    text: "Payment Gateway Integration",
                    check: { default: true, pro: true, enterprise: true },
                },
                {
                    text: "Custom Payment Gateway (Enterprise Only)",
                    check: { enterprise: true },
                },
            ],
        },

        {
            category: "Customer Support",
            features: [
                {
                    text: "Support Ticket Management",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "AI Chatbot Support",
                    check: { default: false, pro: false, enterprise: true },
                },
                {
                    text: "Dedicated Account Manager",
                    check: { enterprise: true },
                },
            ],
        },

        {
            category: "Technological Support",
            features: [
                {
                    text: "Secure Server Infrastructure",

                },
                {
                    text: "Unlimited Cloud Capacity Per Client",

                },
                {
                    text: "24x7 Maintenance",
                    check: { default: false, pro: true, enterprise: true },
                },
                {
                    text: "System Status Monitoring",
                    check: { default: false, pro: true, enterprise: true },
                },
                {
                    text: "New Version Updates",
                    check: { default: false, pro: true, enterprise: true },
                },
            ],
        },
    ];