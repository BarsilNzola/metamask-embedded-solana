import { Metaplex, walletAdapterIdentity } from "@metaplex-foundation/js";
import { Connection, PublicKey } from "@solana/web3.js";

export const IDPASS_SYMBOL = "IDPASS";
export const DEFAULT_METADATA_URI = "/idpass.json"; // served by Next.js public folder

export function makeMetaplex(connection: Connection, walletAdapter: any) {
  return Metaplex.make(connection).use(walletAdapterIdentity(walletAdapter));
}

export async function hasIdPass(mx: Metaplex, owner: PublicKey) {
  const nfts = await mx.nfts().findAllByOwner({ owner });
  return nfts.some((n: any) => (n.symbol || "").toUpperCase() === IDPASS_SYMBOL);
}

export async function mintIdPass(mx: Metaplex, owner: PublicKey, metadataUri?: string) {
  const { nft } = await mx.nfts().create({
    uri: metadataUri || DEFAULT_METADATA_URI,
    name: "Keyless ID Pass",
    symbol: IDPASS_SYMBOL,
    sellerFeeBasisPoints: 0,
    isMutable: false,
    creators: [{ address: owner, share: 100 }],
  });
  return nft.address.toBase58();
}
