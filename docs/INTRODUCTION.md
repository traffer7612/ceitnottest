# Introduction to Ceitnot

## Our ecosystem

Ceitnot is a **yield-backed credit engine** on EVM chains: deposit **ERC-4626** vault shares as collateral, **borrow** the protocol stablecoin **ceitUSD**, capture yield toward debt, and keep the peg via a **PSM** (Peg Stability Module). **Governance** (CEITNOT, vote-escrow, Governor, Timelock) controls upgrades and critical parameters with time-delayed execution.

The ecosystem is built around three core layers:

### [Engine — Multi-market credit](ARCHITECTURE.md)

Collateral markets with oracles, LTV and liquidation rules, interest (kink model), liquidations, and optional flash loans. Positions are cross-collateral unless a market is isolated. The **yield siphon** applies harvested collateral yield to reduce debt via a global scale (stream-settlement).

### [ceitUSD & PSM — Stablecoin and peg](SMART-CONTRACTS.md)

**ceitUSD** (`CeitnotUSD`) is minted in CDP mode by the Engine when users borrow and burned on repay/liquidation. The **PSM** allows 1:1-style swaps between ceitUSD and a pegged stable (e.g. USDC) with configurable `tin` / `tout` fees. Mint permissions are strictly gated; production admin should be **Timelock**.

### [Governance & long-term incentives](INVESTOR-GOVERNANCE-PITCH.md)

**CEITNOT** is the governance token. **VeCEITNOT** locks CEITNOT for voting power and revenue share. **CeitnotGovernor** runs proposals; **TimelockController** enforces a delay before on-chain execution into core contracts—reducing unilateral control risk and giving the community time to react.

---

## Documentation overview

This documentation guides you through:

- **Product overview and use cases** — [BEGINNER-GUIDE.md](BEGINNER-GUIDE.md) (RU), [ARCHITECTURE.md](ARCHITECTURE.md), [ARCHITECTURE-AND-DEATH-SPIRAL.md](ARCHITECTURE-AND-DEATH-SPIRAL.md)
- **Technical specifications** — [CONTRACTS.md](CONTRACTS.md), [INTEREST-RATES.md](INTEREST-RATES.md), [LIQUIDATION.md](LIQUIDATION.md), [EIP-7201-STORAGE-MAP.md](EIP-7201-STORAGE-MAP.md)
- **Integration and addresses** — [SMART-CONTRACTS.md](SMART-CONTRACTS.md), [PRODUCTION-ADDRESSES-ARBITRUM.md](PRODUCTION-ADDRESSES-ARBITRUM.md), [CREATE-NEW-MARKET.md](CREATE-NEW-MARKET.md)
- **Getting started** — [QUICKSTART.md](QUICKSTART.md), [NOVICE-SEPOLIA.md](NOVICE-SEPOLIA.md), [DEPLOY.md](DEPLOY.md)

**Tokenomics, fees, and go-live** — [CEITNOT-TOKENOMICS-AND-FEES.md](CEITNOT-TOKENOMICS-AND-FEES.md), [TOKENOMICS-PROD-CHECKLIST.md](TOKENOMICS-PROD-CHECKLIST.md)

**Security** — [SECURITY-AUDIT.md](SECURITY-AUDIT.md), [BUG-BOUNTY.md](BUG-BOUNTY.md)

---

## Links

- **App:** deploy your frontend per [VERCEL.md](VERCEL.md) and `frontend/.env.example`
- **Brand vs on-chain names:** [BRANDING-AND-NAMING.md](BRANDING-AND-NAMING.md)
