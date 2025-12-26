# Budgit

A desktop budgeting app built with Electron, React, and TypeScript. Budgit uses zero-based budgeting principles to help you give every dollar a job.

## Features

- **Zero-Based Budgeting** - Allocate your entire income to categories so every dollar has a purpose
- **Category Groups** - Organize spending into Giving, Savings, Essentials, Lifestyle, and Debt
- **Multiple Income Sources** - Track income from different sources
- **Transaction Tracking** - Log expenses and see real-time budget updates
- **Rollover Support** - Carry unused category funds to the next month
- **Visual Dashboard** - Charts and insights to understand your spending patterns
- **Dark/Light/System Themes** - Choose your preferred appearance
- **Offline First** - All data stored locally on your machine

## Tech Stack

- **Electron** - Cross-platform desktop app
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Recharts** - Data visualization
- **electron-store** - Local data persistence

## Development

### Prerequisites

- Node.js 18+
- npm or yarn

### Setup

```bash
# Clone the repository
git clone https://github.com/JoeBuydemDips/budgit.git
cd budgit

# Install dependencies
npm install

# Start development server
npm run dev
```

### Build

```bash
# Build for production
npm run build

# Package for macOS
npm run build:mac

# Package for Windows
npm run build:win

# Package for Linux
npm run build:linux
```

## Project Structure

```
src/
├── main/           # Electron main process
│   ├── index.ts    # Main entry point
│   ├── ipc.ts      # IPC handlers
│   └── store.ts    # Data persistence
├── preload/        # Preload scripts
├── renderer/       # React frontend
│   └── src/
│       ├── components/   # UI components
│       ├── hooks/        # React hooks
│       ├── views/        # Page views
│       └── lib/          # Utilities
└── shared/         # Shared types
```

## License

MIT

## Roadmap

- [ ] Import/export budgets and transactions via CSV
- [ ] Bank sync integration (Plaid, etc.)
- [ ] AI-powered insights and budget suggestions
