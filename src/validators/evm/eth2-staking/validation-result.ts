// validation outcome for beacon-related EVM txs (deposit, EIP-7002 withdrawal, etc.)
export type EthBeaconStaticValidationResult = {
  ok: boolean;
  reason?: string;
};
