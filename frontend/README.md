# CrossDome Frontend

A modern, beautiful interface for the CrossDome peptide cross-reactivity analysis tool.

## Design Philosophy

This interface features a **Glassmorphism Biomédico** design aesthetic:
- Translucent layered elements with blur effects
- Blue-purple gradient palette inspired by microscopy
- Smooth, fluid interactions
- AI-generated scientific visualizations

## Quick Start

### Prerequisites
- Node.js 18+ 
- pnpm (or npm/yarn)
- CrossDome backend running on http://localhost:5000

### Installation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev
```

The app will be available at http://localhost:3000

## Features

- **Analyze Mode**: Analyze peptides against specific HLA alleles
- **Compare Mode**: Compare two sets of peptides
- **Elegant Results Display**: Glassmorphic table with all analysis metrics
- **CSV Export**: Download results for further analysis
- **Responsive Design**: Works on desktop and mobile devices

## Documentation

See [INSTRUCTIONS.md](./INSTRUCTIONS.md) for detailed setup and usage instructions.

## Author

**Martiela V Freitas**

## Technology Stack

- React 19 + TypeScript
- Vite 7
- Tailwind CSS 4
- shadcn/ui components
- Wouter (routing)

---

© 2026 CrossDome - Python reimplementation of the CrossDome R package
