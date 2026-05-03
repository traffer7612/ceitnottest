import { useMemo } from 'react';
import { useReadContract } from 'wagmi';
import type { Address } from 'viem';
import { oracleRelayPrimaryAbi } from '../../abi/testnetOracle';
import { TARGET_CHAIN_ID } from '../../lib/contracts';
import type { Market } from '../../hooks/useMarkets';
import type { UserPosition } from '../../hooks/usePosition';
import { formatAddress } from '../../lib/utils';
import OracleRelayRefreshRow from './OracleRelayRefreshRow';

const ARBITRUM_SEPOLIA = 421614;

type Props = {
  markets: Market[];
  positions: UserPosition[];
  onRefreshed: () => void;
};

/**
 * Surfaces when mock Chainlink data behind OracleRelay is stale (24h) or `getLatestPrice` reverts,
 * so testnet users can fix collateral value / borrow without CLI.
 */
export default function TestnetOracleRefreshBar({ markets, positions, onRefreshed }: Props) {
  const probeOracle = markets[0]?.config.oracle as Address | undefined;

  const staleFromPos = useMemo(() => {
    const s = new Set<string>();
    for (const p of positions) {
      if (p.shares > 0n && p.value === 0n) {
        const o = markets.find(m => m.id === p.marketId)?.config.oracle;
        if (o) s.add(o.toLowerCase());
      }
    }
    return s;
  }, [positions, markets]);

  const { isError: probeFailed } = useReadContract({
    address: probeOracle,
    abi: oracleRelayPrimaryAbi,
    functionName: 'getLatestPrice',
    chainId: TARGET_CHAIN_ID,
    query: {
      enabled:
        TARGET_CHAIN_ID === ARBITRUM_SEPOLIA && !!probeOracle && markets.length > 0,
    },
  });

  if (TARGET_CHAIN_ID !== ARBITRUM_SEPOLIA) return null;

  const targets = new Set<string>(staleFromPos);
  if (probeFailed && probeOracle) targets.add(probeOracle.toLowerCase());

  if (targets.size === 0) return null;

  const list = [...targets] as Address[];

  return (
    <div className="card p-4 mb-6 border-ceitnot-warning/40 bg-ceitnot-warning/5">
      <p className="text-sm font-medium text-ceitnot-ink mb-1">Arbitrum Sepolia: oracle data stale</p>
      <p className="text-xs text-ceitnot-muted mb-3">
        Mock Chainlink feeds used with OracleRelay can exceed the 24h freshness window. Push a fresh timestamp
        (any wallet with test ETH). New deploys from the updated script use <span className="font-mono">block.timestamp</span>{' '}
        and avoid this.
      </p>
      <div className="space-y-3">
        {list.map(o => (
          <OracleRelayRefreshRow
            key={o}
            oracleAddress={o}
            onRefreshed={onRefreshed}
            label={`Oracle ${formatAddress(o)}`}
          />
        ))}
      </div>
    </div>
  );
}
