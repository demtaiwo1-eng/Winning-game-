export type WalletReplayInput = {
  userId: string;
  currency: string;
  amountMinor: bigint;
  type: string;
  refType: string | null;
  refId: string | null;
};

export type ExistingWalletLedgerEntry = {
  amountMinor: bigint;
  type: string;
  refType: string | null;
  refId: string | null;
};

export type ExistingWallet = {
  userId: string;
  currency: string;
};

/** A replay is safe only when every money and ownership dimension matches. */
export function isCompatibleWalletReplay(
  wallet: ExistingWallet,
  entry: ExistingWalletLedgerEntry,
  input: WalletReplayInput,
): boolean {
  return wallet.userId === input.userId
    && wallet.currency === input.currency
    && entry.amountMinor === input.amountMinor
    && entry.type === input.type
    && entry.refType === input.refType
    && entry.refId === input.refId;
}
