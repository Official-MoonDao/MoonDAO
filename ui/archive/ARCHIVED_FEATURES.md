# Archived Features

This document lists features that have been archived from the main application to simplify the codebase and focus on core functionality.

## Archive Date
November 11, 2025

## Archived Components

### Non-Core Feature Components
The following component folders have been moved to `archive/components/`:

- **betting** - Prediction market/betting functionality
- **bridge** - Cross-chain bridge interface (Arbitrum bridge)
- **baikonur** - Baikonur space-related features
- **shopify** - Shopify e-commerce integration
- **ticket-to-space** - Ticket to space sweepstakes features
- **wba** - WBA (Warrior Built Accelerator) related components
- **zero-g** - Zero gravity experience features

### Core Components (Kept)
- **coinbase** - Payment onramp (used in MissionContributeModal)
- **citizen** - Citizen/membership system
- **governance** - Proposal and voting system
- **hats** - Role management system
- **jobs** - Job board
- **launchpad** - Mission funding platform
- **marketplace** - Marketplace for experiences
- **mission** - Mission management
- **nance** - Governance integration
- **project** - Project management
- **subscription** - Subscription/citizenship features
- **tokens** - Token management (MOONEY, vMOONEY)
- **wallet** - Wallet connection

## Archived Pages

### Non-Core Feature Pages
The following pages have been moved to `archive/pages/`:

- **artrocket/** - Art Rocket initiative pages
- **bridge.tsx** - Token bridge page
- **deprize.tsx** - DePrize competition page
- **dude-perfect.tsx** - Dude Perfect collaboration page
- **events.tsx** - Events page (replaced with embedded calendar in dashboard)
- **lifeship/** - Lifeship DNA preservation program
- **sweepstakes/** - Sweepstakes pages
- **wba/** - Warrior Built Accelerator pages
- **zero-gravity/** - Zero gravity experience pages

### Core Pages (Kept)
- **index.tsx** - Home page with dashboard
- **governance.tsx** - Governance overview
- **proposals.tsx** - Proposal listing
- **proposal/** - Individual proposals
- **vote.tsx** - Voting interface
- **network.tsx** - Team network
- **projects/** - Project pages
- **mission/** - Mission pages
- **marketplace/** - Marketplace pages
- **citizen/** - Citizen pages
- **jobs.tsx** - Job board
- **lock.tsx** - Token locking
- **get-mooney.tsx** - Token acquisition

## Archived API Routes

The following API routes have been moved to `archive/api/`:

- **shopify/** - Shopify integration endpoints

## Archived Libraries

The following library folders have been moved to `archive/lib/`:

- **shopify/** - Shopify client and utilities

## Removed Dependencies

The following npm packages have been removed from `package.json`:

### Production Dependencies
- `@shopify/shopify-api` - Shopify API integration
- `shopify-buy` - Shopify Buy SDK

### Dev Dependencies
- `@types/shopify-buy` - TypeScript types for Shopify Buy

## Dashboard Changes

The `SignedInDashboard.tsx` component has been simplified:

- ❌ Removed "Events" section (archived events.tsx page)
- ❌ Removed unused `CalendarDaysIcon` import
- ✅ Kept core sections: Featured Mission, Teams, Projects, Marketplace, Global Community Map

## Restoration Instructions

If you need to restore any archived features:

1. Move the desired folder from `archive/` back to its original location
2. Restore any removed dependencies in `package.json`
3. Run `npm install` or `yarn install`
4. Update any imports if needed
5. Test the feature thoroughly

## Core Features Summary

After cleanup, the app focuses on these core features:

1. **Governance** - Proposals, voting, delegation
2. **Missions** - Fund and support space missions (Launchpad)
3. **Projects** - Active space exploration projects
4. **Network** - Teams and citizen collaboration
5. **Marketplace** - Space experiences and offerings
6. **Tokens** - MOONEY token management and locking
7. **Citizens** - Membership and NFT system
8. **Jobs** - Community job board

## Benefits of Archiving

- 🎯 Clearer focus on core features
- 📦 Smaller bundle size
- 🚀 Faster build times
- 🧹 Easier maintenance
- 📚 Better code organization
- 🔍 Easier for new developers to understand the codebase
