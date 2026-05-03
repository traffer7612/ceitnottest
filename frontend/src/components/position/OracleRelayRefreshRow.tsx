import { useState, useEffect } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import type { Address, Hash } from 'viem';
import { Loader2, RefreshCw } from 'lucide-react';
import { oracleRelayPrimaryAbi, mockChainlinkV3FeedAbi } from '../../abi/testnetOracle';
import { gasFor, TARGET_CHAIN_ID } from '../../lib/contracts';
import { viteMockEthUsd8Dec } from '../../lib/chainEnv';
import { formatAddress } from '../../lib/utils';

type Props = {
  oracleAddress: Address;
  onRefreshed: () => void;
  /** Optional label when multiple oracles */
  label?: string;
  className?: string;
};

/**
 * One-click refresh for `DeployFullArbitrumSepolia`: pushes a new timestamp into the mock
 * Chainlink feed behind `OracleRelay`, fixing 24h staleness without `cast`.
 */
export default function OracleRelayRefreshRow({ oracleAddress, onRefreshed, label, className }: Props) {
  const { isConnected, chainId } = useAccount();
  const [hash, setHash] = useState<Hash | undefined>();
  const [localErr, setLocalErr] = useState('');

  const chainMismatch = isConnected && chainId != null && chainId !== TARGET_CHAIN_ID;

  const { data: primaryFeed, isError: notRelay, isPending: feedLoading } = useReadContract({
    address: oracleAddress,
    abi: oracleRelayPrimaryAbi,
    functionName: 'PRIMARY_FEED',
    chainId: TARGET_CHAIN_ID,
  });

  const { data: roundData, isPending: roundLoading } = useReadContract({
    address: (primaryFeed ?? '0x0000000000000000000000000000000000000000') as Address,
    abi: mockChainlinkV3FeedAbi,
    functionName: 'latestRoundData',
    chainId: TARGET_CHAIN_ID,
    query: { enabled: Boolean(primaryFeed) && !notRelay },
  });

  const { writeContractAsync, isPending: writePending } = useWriteContract();
  const { isLoading: txPending, isSuccess: confirmed } = useWaitForTransactionReceipt({ hash });

  useEffect(() => {
    if (!confirmed || !hash) return;
    onRefreshed();
    setHash(undefined);
  }, [confirmed, hash, onRefreshed]);

  const busy = feedLoading || roundLoading || writePending || txPending;

  if (notRelay) {
    return (
      <p className={`text-xs text-ceitnot-warning ${className ?? ''}`}>
        Oracle at {formatAddress(oracleAddress)} is not an OracleRelay with PRIMARY_FEED (e.g. manual MockOracle).
        Use <span className="font-mono">cast send … setPrice(uint256)</span> on that contract instead.
      </p>
    );
  }

  async function refresh() {
    setLocalErr('');
    if (!primaryFeed || chainMismatch) return;
    const rawAns = roundData?.[1];
    const nextAnswer = rawAns !== undefined && rawAns > 0n ? rawAns : viteMockEthUsd8Dec();
    const ts = BigInt(Math.floor(Date.now() / 1000));
    try {
      const h = await writeContractAsync({
        address: primaryFeed,
        abi: mockChainlinkV3FeedAbi,
        functionName: 'setAnswer',
        args: [nextAnswer, ts],
        chainId: TARGET_CHAIN_ID,
        ...gasFor(TARGET_CHAIN_ID),
      });
      setHash(h);
    } catch (e: unknown) {
      setLocalErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {label && <span className="text-xs text-ceitnot-muted">{label}</span>}
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={busy || !isConnected || chainMismatch || !primaryFeed}
          className="btn-secondary text-xs flex items-center gap-1.5 py-1.5 px-3"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Refresh mock Chainlink feed
        </button>
        {primaryFeed && (
          <span className="text-[10px] text-ceitnot-muted font-mono">
            feed {formatAddress(primaryFeed)}
          </span>
        )}
      </div>
      {chainMismatch && (
        <p className="text-xs text-ceitnot-danger">
          Switch wallet to chain {TARGET_CHAIN_ID} (Arbitrum Sepolia) to send the update.
        </p>
      )}
      {localErr && <p className="text-xs text-ceitnot-danger break-all">{localErr}</p>}
    </div>
  );
}
