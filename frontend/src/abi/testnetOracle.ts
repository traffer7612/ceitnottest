/** Minimal ABI: Ceitnot `OracleRelay` on testnets (primary = mock Chainlink feed). */
export const oracleRelayPrimaryAbi = [
  {
    inputs: [],
    name: 'PRIMARY_FEED',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getLatestPrice',
    outputs: [
      { name: 'value', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/** Mutable mock used by `DeployFullArbitrumSepolia` (`MockChainlinkV3Feed`). */
export const mockChainlinkV3FeedAbi = [
  {
    inputs: [{ name: 'a', type: 'int256' }, { name: 'ts', type: 'uint256' }],
    name: 'setAnswer',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'latestRoundData',
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
