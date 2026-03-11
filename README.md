# Kanoz Daily Report System

A mobile-first PWA for biomass pellet manufacturing plants to manage daily operations — shift reports, vehicle dispatches, raw material purchases, and supplier tracking.

Built with **React 19 + Vite + Supabase**.

## Features

- **Shift Reports** — Multi-step wizard to log production data, machine hours, raw material usage, diesel consumption, dispatches, pellet stock, and operational issues
- **Vehicle Dispatches** — Record truck dispatches with customer, destination, pellet types, quantities, and invoice details
- **Raw Material Purchases** — Track purchases from suppliers with quantities, rates, and payment status
- **Supplier Management** — Maintain supplier directory with contact details and purchase history
- **Admin Panel** — Manage plant configuration (machines, pellet types, raw materials, customers, equipment), team members, and switch between plants
- **Multi-plant Support** — Admins can manage and switch between multiple plants within an organization
- **Offline-ready** — PWA with service worker support for use in low-connectivity environments

## Tech Stack

- **Frontend:** React 19, React Router 7, Lucide icons
- **Backend:** Supabase (Auth, Database, Storage)
- **Data Fetching:** TanStack React Query
- **Build:** Vite with PWA plugin
- **Deployment:** Vercel (with Supabase proxy for ISP compatibility in India)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/raaghavk/kanoz-daily-report.git
   cd kanoz-daily-report
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file from the example:
   ```bash
   cp .env.example .env
   ```

4. Add your Supabase credentials to `.env`:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

5. Start the dev server:
   ```bash
   npm run dev
   ```

## Project Structure

```
src/
├── components/       # Shared UI components (Layout, BottomNav, PageHeader, Toast)
├── context/          # AuthContext (auth, plant, employee state)
├── lib/              # Supabase client config
└── pages/
    ├── Home.jsx              # Dashboard with shift status and quick actions
    ├── Login.jsx             # Authentication
    ├── ReportList.jsx        # Shift report history
    ├── ReportView.jsx        # Shift report detail view
    ├── AdminPanel.jsx        # Plant settings and configuration
    ├── UserManagement.jsx    # Team member management
    ├── shift/                # Multi-step shift report wizard (9 steps)
    ├── dispatch/             # Vehicle dispatch form
    ├── purchase/             # Purchase list, form, and detail views
    └── suppliers/            # Supplier list and detail views
```

## Deployment

The app is configured for Vercel deployment. The `vercel.json` includes rewrites to proxy Supabase API calls, which helps bypass ISP blocks in certain regions.

```bash
npm run build
```

## License

Private — Kanoz Bio Energy Pvt. Ltd.
