import { Router } from "express";
import {
  createPublicClient,
  http,
  formatEther,
  defineChain,
  parseAbiItem,
  getAddress,
  type Chain,
  type PublicClient,
} from "viem";
import { arbitrum, base, sepolia, foundry } from "viem/chains";

/** Indexed `user` as topics[1] for each event */
const ENGINE_USER_EVENTS = [
  parseAbiItem(
    "event CollateralDeposited(address indexed user, uint256 indexed marketId, uint256 shares)",
  ),
  parseAbiItem(
    "event DepositAndBorrowed(address indexed user, uint256 indexed marketId, uint256 shares, uint256 borrowed)",
  ),
  parseAbiItem("event Borrowed(address indexed user, uint256 indexed marketId, uint256 amount)"),
  parseAbiItem("event Repaid(address indexed user, uint256 indexed marketId, uint256 amount)"),
  parseAbiItem(
    "event RepaidAndWithdrawn(address indexed user, uint256 indexed marketId, uint256 repaid, uint256 withdrawShares)",
  ),
  parseAbiItem(
    "event CollateralWithdrawn(address indexed user, uint256 indexed marketId, uint256 shares)",
  ),
  parseAbiItem(
    "event Liquidated(address indexed user, address indexed liquidator, uint256 indexed marketId, uint256 repayAmount, uint256 collateralSeized)",
  ),
] as const;

const USER_COUNT_CHUNK_BLOCKS = 4999n;
const USER_COUNT_CACHE_MS = 120_000;

type UserCountCache = { count: number; expires: number };
const userCountCache = new Map<string, UserCountCache>();

/** Canonical CeitnotProxy on Arbitrum One — creation block from deployment tx (see docs/PRODUCTION-ADDRESSES-ARBITRUM.md). */
const ARBITRUM_ONE_ENGINE_PROXY_LOWER =
  "0xf8631ea8d16f67a4ffbab691dcf55c6d0d31b928";
const ARBITRUM_ONE_ENGINE_DEPLOY_BLOCK = 452727096n;

function deployBlockOrDefault(chainId: number, engineAddress?: `0x${string}`): bigint | null {
  const raw = process.env.CEITNOT_ENGINE_DEPLOY_BLOCK?.trim();
  if (raw !== undefined && raw !== "") {
    try {
      return BigInt(raw);
    } catch {
      /* fall through */
    }
  }
  if (chainId === 31337) return 0n;
  if (
    chainId === 42161 &&
    engineAddress &&
    engineAddress.toLowerCase() === ARBITRUM_ONE_ENGINE_PROXY_LOWER
  ) {
    return ARBITRUM_ONE_ENGINE_DEPLOY_BLOCK;
  }
  return null;
}

async function countUniqueEngineUsers(
  client: PublicClient,
  engineAddress: `0x${string}`,
  fromBlock: bigint,
): Promise<number> {
  const latest = await client.getBlockNumber();
  if (fromBlock > latest) return 0;

  const users = new Set<string>();
  for (let start = fromBlock; start <= latest; start += USER_COUNT_CHUNK_BLOCKS) {
    const end =
      start + USER_COUNT_CHUNK_BLOCKS - 1n > latest ? latest : start + USER_COUNT_CHUNK_BLOCKS - 1n;
    const logsArrays = await Promise.all(
      ENGINE_USER_EVENTS.map((event) =>
        client
          .getLogs({
            address: engineAddress,
            event,
            fromBlock: start,
            toBlock: end,
          })
          .catch(() => []),
      ),
    );
    for (const logs of logsArrays) {
      for (const log of logs) {
        const t = log.topics[1];
        if (t) {
          try {
            users.add(getAddress(t as `0x${string}`));
          } catch {
            /* ignore malformed */
          }
        }
      }
    }
  }
  return users.size;
}

const arbitrumSepolia = defineChain({
  id: 421614,
  name: "Arbitrum Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia-rollup.arbitrum.io/rpc"] } },
});

const ENGINE_REGISTRY_ABI = [
  {
    inputs: [],
    name: "marketRegistry",
    outputs: [{ type: "address", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const REGISTRY_MARKET_COUNT_ABI = [
  {
    inputs: [],
    name: "marketCount",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const ENGINE_PER_MARKET_ABI = [
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "totalDebt",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "marketId", type: "uint256" }],
    name: "totalCollateralAssets",
    outputs: [{ type: "uint256", name: "" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

async function aggregateEngineTotals(
  client: PublicClient,
  engineAddress: `0x${string}`,
): Promise<{ totalDebt: bigint; totalCollateralAssets: bigint }> {
  const registry = await client.readContract({
    address: engineAddress,
    abi: ENGINE_REGISTRY_ABI,
    functionName: "marketRegistry",
  });
  const count = await client.readContract({
    address: registry,
    abi: REGISTRY_MARKET_COUNT_ABI,
    functionName: "marketCount",
  });
  const n = Number(count);
  let td = 0n;
  let tc = 0n;
  for (let i = 0; i < n; i++) {
    const mid = BigInt(i);
    const [d, c] = await Promise.all([
      client.readContract({
        address: engineAddress,
        abi: ENGINE_PER_MARKET_ABI,
        functionName: "totalDebt",
        args: [mid],
      }),
      client.readContract({
        address: engineAddress,
        abi: ENGINE_PER_MARKET_ABI,
        functionName: "totalCollateralAssets",
        args: [mid],
      }),
    ]);
    td += d;
    tc += c;
  }
  return { totalDebt: td, totalCollateralAssets: tc };
}

export const statsRouter = Router();

function getRpc(chainId: number): string {
  if (chainId === 31337) {
    return process.env.FAUCET_RPC_URL ?? process.env.RPC_URL ?? "http://127.0.0.1:8545";
  }
  if (process.env.RPC_URL) return process.env.RPC_URL;
  const arbitrumRpc = process.env.ARBITRUM_RPC_URL?.trim();
  if (chainId === 42161 && arbitrumRpc) return arbitrumRpc;
  const arbSepRpc = process.env.ARBITRUM_SEPOLIA_RPC_URL?.trim();
  if (chainId === 421614 && arbSepRpc) return arbSepRpc;
  const rpcs: Record<number, string> = {
    11155111: "https://ethereum-sepolia.publicnode.com",
    42161: arbitrum.rpcUrls.default.http[0],
    421614: arbitrumSepolia.rpcUrls.default.http[0],
    8453: base.rpcUrls.default.http[0],
  };
  return rpcs[chainId] ?? "";
}

const chains: Record<number, Chain> = {
  31337: foundry,
  11155111: sepolia,
  42161: arbitrum,
  421614: arbitrumSepolia,
  8453: base,
};

statsRouter.get("/:chainId", async (req, res) => {
  const chainId = Number(req.params.chainId);
  const engineAddress = process.env.CEITNOT_ENGINE_ADDRESS as `0x${string}` | undefined;
  if (!engineAddress) {
    return res.json({ totalDebt: "0", totalCollateralAssets: "0", uniqueUsers: null });
  }
  const chain = chains[chainId];
  if (!chain) {
    return res.json({ totalDebt: "0", totalCollateralAssets: "0", uniqueUsers: null });
  }
  try {
    const client = createPublicClient({
      chain,
      transport: http(getRpc(chainId)),
    });

    const fromBlock = deployBlockOrDefault(chainId, engineAddress);
    let uniqueUsers: number | null = null;
    if (fromBlock !== null) {
      const cacheKey = `${chainId}-${engineAddress}-${fromBlock}`;
      const now = Date.now();
      const hit = userCountCache.get(cacheKey);
      if (hit && hit.expires > now) {
        uniqueUsers = hit.count;
      } else {
        uniqueUsers = await countUniqueEngineUsers(client, engineAddress, fromBlock);
        userCountCache.set(cacheKey, { count: uniqueUsers, expires: now + USER_COUNT_CACHE_MS });
      }
    }

    let totalDebtStr = "0";
    let totalCollateralStr = "0";
    try {
      const { totalDebt, totalCollateralAssets } = await aggregateEngineTotals(client, engineAddress);
      totalDebtStr = formatEther(totalDebt);
      totalCollateralStr = formatEther(totalCollateralAssets);
    } catch {
      /* wrong registry / RPC edge — keep zeros */
    }

    return res.json({
      totalDebt: totalDebtStr,
      totalCollateralAssets: totalCollateralStr,
      uniqueUsers,
    });
  } catch (_e) {
    return res.json({ totalDebt: "0", totalCollateralAssets: "0", uniqueUsers: null });
  }
});
