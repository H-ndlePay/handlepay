# H\@ndlePay

H\@ndlePay is a decentralized application (dApp) that links **social media handles** (Twitter, Telegram, Discord, Instagram) with **wallet addresses**. It lets users easily discover one another through their socials and send payments across EVM-compatible chains.

---

## ✨ Features

* **Member Directory**

  * Browse members by supported platforms.
  * Search by username or filter by platform.
  * ENS reverse resolution (ENS names & avatars shown if available).
  * Wallet address displayed under each profile.

* **Payments**

  * Each handle links to the Payments page with pre-filled details.
  * Supports same-chain ETH transfers (future extension: cross-chain via LayerZero).
  * Powered by smart contract `HandleRegistry` on Base/Ethereum.

* **Waitlist**

  * Join waitlist by providing:

    * First name, last name
    * Email
    * EVM wallet address
    * Multiple social media handles (no duplicate platform selection)
  * After submission, users see a success message confirming their entry.

* **ENS Integration**

  * Fetches ENS names for Ethereum addresses.
  * Fetches ENS avatars where available.
  * Graceful fallback if ENS data not found.

* **Dynamic Wallet Login**

  * Integrated with [Dynamic Labs](https://www.dynamic.xyz) for secure, seamless wallet auth.

---

## 🛠 Tech Stack

* **Frontend**: React (Vite bundler)
* **Routing**: React Router
* **Styling**: Tailwind CSS + Lucide Icons + React Icons
* **Blockchain Utils**: [viem](https://viem.sh/) client
* **GraphQL**: The Graph (to query members + handles)
* **Wallet & Auth**: Dynamic Labs SDK

---

## 📦 Installation

Clone and install dependencies:

```bash
git clone https://github.com/handlepay/handlepay.git
cd handlepay
yarn install
```

---

## 🚀 Running Locally

Start dev server:

```bash
yarn dev
```

Then open [http://localhost:5173](http://localhost:5173).

---

## 📂 Project Structure

```
src/
  ├── components/      # Shared UI (Nav, buttons, etc.)
  ├── lib/
  │   ├── graphClient.js # GraphQL client setup
  │   └── queries.js     # MEMBERS, HANDLES_FOR_MEMBER queries
  ├── pages/
  │   ├── UsersPage.jsx   # Member directory (ENS + handles)
  │   ├── PaymentsPage.jsx # ETH payment flow
  │   └── WaitlistPage.jsx # Waitlist form
  ├── App.jsx           # Routes
  └── main.jsx          # React entry
```

---

## 🔑 How It Works

1. **Fetching Members**

   * Members + handles are indexed via **The Graph**.
   * `MEMBERS` query → returns wallets + member IDs.
   * `HANDLES_FOR_MEMBER` query → fetches social handles.

2. **ENS Resolution**

   * Each wallet is reverse-resolved using `ethClient.getEnsName()`.
   * If ENS found, `getEnsAvatar()` fetches the profile picture.
   * Fallback to a generated icon if no ENS.

3. **Payments**

   * Clicking a handle (`@username`) routes to:

     ```
     /payments?toType=<platform>&toValue=<username>
     ```
   * Pre-fills payment form with target social + wallet.

4. **Waitlist**

   * User can select multiple social platforms (Twitter, Discord, etc.).
   * Once a platform is chosen, it is removed from the dropdown to prevent duplicates.
   * Displays: `Thanks! Your response was recorded. We’ll add you to the waitlist.`

---

## 🤝 Contribution Notes

* Follow the existing file structure and naming conventions.
* Ensure ENS + The Graph queries fail gracefully.
* Payments page is ETH mainnet by default (extendable to other chains).
* Styling follows Tailwind + utility-first conventions.
* PRs should include screenshots for UI changes.

---

## 📄 License

MIT
