import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";

export const IDPASS_SYMBOL = "IDPASS";
export const DEFAULT_METADATA_URI = "/idpass.json";

export function makeMetaplex(connection: Connection, walletAdapter: any) {
  return Metaplex.make(connection).use(walletAdapterIdentity(walletAdapter));
}

export async function hasIdPass(mx: Metaplex, owner: PublicKey): Promise<boolean> {
  try {
    console.log(`Checking for ID Pass for owner: ${owner.toString()}`);
    const nfts = await mx.nfts().findAllByOwner({ owner });
    const hasPass = nfts.some((n: any) => (n.symbol || "").toUpperCase() === IDPASS_SYMBOL);
    console.log(`ID Pass check result: ${hasPass}`);
    return hasPass;
  } catch (error) {
    console.error("Error checking for ID Pass:", error);
    return false;
  }
}

export async function mintIdPass(mx: Metaplex, owner: PublicKey, metadataUri?: string): Promise<string> {
  try {
    console.log(`Starting ID Pass mint for owner: ${owner.toString()}`);
    
    const { nft } = await mx.nfts().create({
      uri: metadataUri || DEFAULT_METADATA_URI,
      name: "Keyless ID Pass",
      symbol: IDPASS_SYMBOL,
      sellerFeeBasisPoints: 0,
      isMutable: false,
      creators: [{ address: owner, share: 100 }],
    });
    
    console.log(`ID Pass minted successfully: ${nft.address.toString()}`);
    return nft.address.toString();
  } catch (error) {
    console.error("Error minting ID Pass:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to mint ID Pass: ${error.message}`);
    } else {
      throw new Error("Failed to mint ID Pass: Unknown error occurred");
    }
  }
}