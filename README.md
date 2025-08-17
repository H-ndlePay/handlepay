# H@ndlePay

> Map social handles to crypto wallets. Discover people by their socials and pay them across EVM chains.

**Live demo:** https://handlepay.vercel.app/

---

## Table of Contents
- [Overview](#overview)
- [Architecture](#architecture)
- [Key Flows](#key-flows)
  - [Directory / ENS Enrichment](#directory--ens-enrichment)
  - [Handle Resolution (The Graph)](#handle-resolution-the-graph)
  - [Payments (Same‑chain & Cross‑chain)](#payments-samechain--crosschain)
  - [Waitlist](#waitlist)
- [Tech Stack](#tech-stack)
- [Monorepo / Project Layout](#monorepo--project-layout)
- [Getting Started (Local Dev)](#getting-started-local-dev)
  - [1) Prerequisites](#1-prerequisites)
  - [2) Install](#2-install)
  - [3) Environment](#3-environment)
  - [4) Run](#4-run)
  - [5) Build & Preview](#5-build--preview)
- [Configuration](#configuration)
  - [Networks & Contracts](#networks--contracts)
  - [USDC Addresses](#usdc-addresses)
  - [Supported Platforms](#supported-platforms)
- [Smart Contracts & Hardhat](#smart-contracts--hardhat)
  - [HandleRegistry pay-eth Task](#handleregistry-pay-eth-task)
- [Deployment](#deployment)
- [Notes & Gotchas](#notes--gotchas)
- [Roadmap Ideas](#roadmap-ideas)
- [License](#license)
- [Acknowledgements](#acknowledgements)

---

## Overview

**HandlePay** is a dApp that lets you:
- Map **social media handles** (Twitter/X, Telegram, Discord, Instagram) to **wallet addresses**.
- Browse a **Member Directory**, enriched with **ENS** names/avatars when available.
- Click an **@handle** to open a **Payments** flow with the handle pre‑filled.
- Send **ETH or USDC** on the same chain, with **cross‑chain bridging flows stubbed** (LayerZero for ETH, Circle CCTP v2 for USDC).
- Allow new users to **join a waitlist** with multiple social handles.
- Authenticate/connect via **Dynamic** (wallet login widget).  

The app currently supports **Ethereum Mainnet** and **Base Mainnet**, and is deployed to **Vercel**.

---

## Architecture

**Frontend**
- **React + Vite** SPA with **React Router**.
- **Tailwind CSS** for styling, **Lucide** + **React Icons** for icons.

**Wallet & Auth**
- **Dynamic** (`@dynamic-labs/sdk-react-core`) to handle wallet connection and onboarding.
- **wagmi + viem** for on-chain transactions and signing.

**ENS**
- Reverse‐resolve **ENS name** and **avatar** via `viem` public client.
- Lookups degrade gracefully if records are missing.

**Data (handles & members)**
- **The Graph** subgraph is queried for:
  - `memberCreateds` → on-chain member + wallet records
  - `handleAddeds` → (platform, username) records mapped to `memberId`

**Payments**
- **Same‑chain ETH**: call `HandleRegistry.payToHandle(platform, username)` with value (preferred), or **fallback** to a native transfer if the registry isn’t configured on that chain.
- **Same‑chain USDC**: direct ERC‑20 `transfer(to, amount)`.
- **Cross‑chain ETH**: **simulated** placeholder for **LayerZero**.
- **Cross‑chain USDC**: **simulated** placeholder for **Circle CCTP v2**.

**Pages**
- `UsersPage` — browse members, search/filter by platform, and open external profile links (X/Telegram/Discord/Instagram). Only clicking **@username** navigates to Payments.
- `PaymentsPage` — resolve an @handle to a wallet (via The Graph), gate inputs until resolved, then allow sending **ETH/USDC**. Uses **Dynamic** for wallet connection.
- `WaitlistPage` — basic form (first/last/email/wallet + **multiple social handles**). Shows a centered success message on submit.

---

## Key Flows

### Directory / ENS Enrichment
- For each member wallet, attempt `getEnsName` and `getEnsAvatar`.
- **No verification badge is shown** (the UI previously had one but it’s intentionally removed).
- Cards show the **ENS name** (if present) and a list of handles with platform icons.
- External links (“View on X”, “Chat on Telegram”, “Message on Discord”, “View on Instagram”) **open in a new tab** and **do not** trigger the Payments page.

### Handle Resolution (The Graph)
- The Payments page resolves `(platform, username)` → `memberId` via:
  - GraphQL query on `handleAddeds` with **case‑insensitive** support using `username_in` candidates (e.g. `lower/upper/title` variants).
- Then fetches the `wallet` from `memberCreateds` for that `memberId`.
- Until a wallet is resolved, the **currency/amount/chain** inputs and **Send** button are **disabled**. A green ✓ appears in the input once resolved.

### Payments (Same‑chain & Cross‑chain)
- **ETH (same chain)**
  - Preferred: send data+value to **HandleRegistry** `payToHandle(platform, username)`.
  - Fallback: **native** `eth_sendTransaction` to the resolved wallet.
- **USDC (same chain)**:
  - Standard ERC‑20 `transfer(to, amount)`.
- **Cross‑chain**
  - **ETH** via LayerZero → **simulated only** in this UI.
  - **USDC** via Circle **CCTP v2** → **simulated only**.
- Status messages appear **after** a tx is submitted (wallet prompt first), not on simulation.

### Waitlist
- First name, last name, email, EVM wallet.
- **Multiple social handles** (user can add/remove rows; a platform can’t be added twice).
- On submit, show a **centered** confirmation:  
  “**Thanks! Your response was recorded. We’ll add you to the waitlist.**”

---

## Tech Stack

- **React 18**, **Vite**
- **Tailwind CSS**
- **React Router**
- **Lucide** + **React Icons**
- **wagmi** + **viem**
- **Dynamic** (wallet onboarding and management)
- **The Graph** (GraphQL subgraph)
- **ENS** (via viem public client)
- **LayerZero** (ETH bridging; simulated)
- **Circle CCTP v2** (USDC bridging; simulated)
- **Hardhat** (tasks and local contract scripting)

---

## Monorepo / Project Layout

```
src/
  components/
    Nav.jsx                # Top nav; Dynamic widget; "Join Waitlist" button
    SearchBar.jsx          # Search/filter by platform/username
  lib/
    graphClient.js         # GraphQL client
    handleRegistry.js      # HandleRegistry contract interaction
    queries.js             # MEMBERS, HANDLES_FOR_MEMBER, etc.
  pages/
    UsersPage.jsx          # ENS enrichment, platform filter/search, external links
    PaymentsPage.jsx       # Resolve handle -> wallet; ETH/USDC send; bridging stubs
    WaitlistPage.jsx       # Multi-handle waitlist form with centered success
  App.jsx
  main.jsx
tasks/
  pay-eth.js               # Hardhat task: payToHandle via HandleRegistry
```

> Your exact file names may differ slightly; the above reflects the current structure discussed in code.

---

## Getting Started (Local Dev)

### 1) Prerequisites
- **Node.js** ≥ 18
- **Yarn** ≥ 1.22
- A wallet (e.g., MetaMask)
- (Optional) RPC provider keys (Alchemy/Infura) if you wire them into viem/wagmi

### 2) Install
```bash
yarn install
```

### 3) Run
```bash
yarn dev
```
Open http://localhost:5173

### 4) Build & Preview
```bash
yarn build
yarn preview
```

---

## Configuration

### Networks & Contracts
Edit these in `src/pages/PaymentsPage.jsx`:

- **DEST_CHAINS** — chains supported by the UI (Ethereum Mainnet, Base).
- **REGISTRY_ADDRESSES** — per‑chain `HandleRegistry` addresses.  
  Example:
  ```js
  const REGISTRY_ADDRESSES = {
    // [mainnet.id]: "0xYourEthereumMainnetRegistry",
    [base.id]: "0x132727D74dF3246b64046598626415258dc648f0",
  };
  ```

> If a `REGISTRY_ADDRESSES[chainId]` is missing, same‑chain ETH falls back to a **native transfer**.

### USDC Addresses
`USDC_ADDRESSES` map in `src/pages/PaymentsPage.jsx`:
```js
const USDC_ADDRESSES = {
  [mainnet.id]: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eb48", // Ethereum
  [base.id]:    "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
};
```

### Supported Platforms
The UI currently supports **Twitter/X**, **Telegram**, **Discord**, **Instagram**.  
To add a new platform:
1. Ensure your subgraph writes a `handleAddeds` record with a distinct `platform` string.
2. Update `UsersPage.jsx` (icon + external URL) and `PaymentsPage.jsx` (resolver accepts the new platform key).
3. (Optional) Update the waitlist platform picker.

---

## Smart Contracts & Hardhat

The repo includes a convenience **Hardhat task** that calls the registry on-chain, mirroring what the UI does for same‑chain ETH.

### HandleRegistry pay-eth Task

**File:** `tasks/pay-eth.js`

```js
task('pay-eth', 'Send ETH to a @handle via HandleRegistry.payToHandle()')
  .addParam('platform', 'e.g. twitter')
  .addParam('username', 'e.g. VitalikButerin')
  .addParam('amount', 'ETH amount, e.g. 0.01')
  .addOptionalParam('registry', 'HandleRegistry address', '0x132727D74dF3246b64046598626415258dc648f0')
  .addOptionalParam('pk', 'Private key for payer (hex, no 0x)')
  .setAction(async (args, hre) => { /* … */ });
```

**Run (Base mainnet example):**
```bash
npx hardhat pay-eth \
  --network base \
  --platform twitter \
  --username Cookiestroke \
  --amount 0.01 \
  --registry 0x132727D74dF3246b64046598626415258dc648f0
```

**With a specific payer key:**
```bash
npx hardhat pay-eth \
  --network mainnet \
  --platform twitter \
  --username VitalikButerin \
  --amount 0.005 \
  --pk YOUR_PRIVATE_KEY_NO_0x
```

> The UI performs the same action using the connected wallet:
> - Encodes calldata for `payToHandle(platform, username)` and sends **value**.
> - If no registry address is configured for the chain, falls back to a **native transfer**.

---

## Deployment

The app is deployed to **Vercel**: https://handlepay.vercel.app/

To deploy your fork:
1. Push to a GitHub repo.
2. Import into Vercel.
3. Set your **Environment Variables** (see `.env.local`).
4. Configure the **Build Command**: `yarn build`
5. Output directory: `dist`
6. Redeploy.

---

## Notes & Gotchas
- **ENS resolution** may fail or be slow depending on RPC. The UI tolerates missing records.
- **Handle normalization** strips leading `@` and known URL prefixes (`x.com/`, `t.me/`, `instagram.com/`) and lowercases the username before matching.
- **Case‑insensitive** matching in The Graph is done via a `username_in` list of common variants.
- **Cross‑chain** flows in the UI are **simulated** (no real bridge txs yet).
- The **status message** after send is only shown once a **transaction is submitted** (wallet confirmation first).
- External links on user cards **never** trigger the payments route; only clicking the **@username** does.

---

## Roadmap Ideas
- Real LayerZero & CCTP integrations from the UI (mainnet).
- Optional ENS/Dentity “verified” badges with clear, accurate labeling.
- Add **ENS primary name claim** / ENS text‑record editor UX.
- Handle ownership proofs / signature‑based linking.
- Per‑platform deep links for Discord (when available).
- Notifications and activity feed.

---

## License
MIT

---

## Acknowledgements
- **ENS** (Ethereum Name Service)
- **The Graph**
- **Dynamic** (wallet onboarding, management, and authentication)
- **wagmi** & **viem**
- **LayerZero**
- **Circle CCTP**
- **Tailwind CSS**, **Lucide**, **React Icons**
- **Vercel** (hosting)
