import {
  Metaplex,
  walletAdapterIdentity,
  WalletAdapter,
  Nft,
  Sft,
  Metadata,
} from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";

export const IDPASS_SYMBOL = "IDPASS";
export const DEFAULT_METADATA_URI = "/idpass.json";

/**
 * Create a Metaplex client bound to a wallet adapter
 */
export function makeMetaplex(connection: Connection, walletAdapter: WalletAdapter): Metaplex {
  return Metaplex.make(connection).use(walletAdapterIdentity(walletAdapter));
}

/**
 * Check if a given owner already holds the ID Pass NFT
 */
export async function hasIdPass(mx: Metaplex, owner: PublicKey): Promise<boolean> {
  try {
    const nfts = await mx.nfts().findAllByOwner({ owner });

    const hasPass = nfts.some(
      (n: Nft | Sft | Metadata) =>
        (n.symbol ?? "").toUpperCase() === IDPASS_SYMBOL
    );

    return hasPass;
  } catch (error) {
    console.error("Error checking for ID Pass:", error);
    return false;
  }
}

/**
 * Mint a new ID Pass NFT for the given owner
 */
export async function mintIdPass(
  mx: Metaplex,
  owner: PublicKey,
  metadataUri: string = DEFAULT_METADATA_URI
): Promise<string> {
  try {
    const { nft } = await mx.nfts().create({
      uri: metadataUri,
      name: "Keyless ID Pass",
      symbol: IDPASS_SYMBOL,
      sellerFeeBasisPoints: 0,
      isMutable: false,
      creators: [{ address: owner, share: 100 }],
    });

    return nft.address.toString();
  } catch (error) {
    console.error("Error minting ID Pass:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to mint ID Pass: ${error.message}`);
    }
    throw new Error("Failed to mint ID Pass: Unknown error occurred");
  }
}
