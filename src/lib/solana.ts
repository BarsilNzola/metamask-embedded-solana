import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  clusterApiUrl,
} from "@solana/web3.js";
import type { IProvider } from "@web3auth/base";

export const DEVNET_ENDPOINT = clusterApiUrl("devnet");

export function makeConnection(): Connection {
  return new Connection(DEVNET_ENDPOINT, "confirmed");
}

export async function getBalanceLamports(
  connection: Connection,
  ownerBase58: string
): Promise<number> {
  const pk = new PublicKey(ownerBase58);
  return await connection.getBalance(pk, "confirmed");
}

/**
 * Build a v0 transfer transaction (unsigned)
 */
export async function buildTransferV0(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  lamports: number
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash("confirmed");

  const ix = SystemProgram.transfer({
    fromPubkey: from,
    toPubkey: to,
    lamports,
  });

  const msg = new TransactionMessage({
    payerKey: from,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message();

  return new VersionedTransaction(msg);
}

/**
 * Send a v0 transaction using Web3Auth provider
 * (provider expects base64-serialized message bytes)
 */
export async function sendWithWeb3AuthProvider(
  provider: IProvider,
  vtx: VersionedTransaction
): Promise<string> {
  const bytes = vtx.serialize(); // Uint8Array
  const base64 = Buffer.from(bytes).toString("base64");

  const sig = (await provider.request({
    method: "solana_signAndSendTransaction",
    params: { message: base64 },
  })) as string;

  return sig;
}

/**
 * Convenience: build + sign+send with Web3Auth provider
 */
export async function sendLamportsWithProvider(
  connection: Connection,
  provider: IProvider,
  from: PublicKey,
  to: PublicKey,
  lamports: number
): Promise<string> {
  const vtx = await buildTransferV0(connection, from, to, lamports);
  return await sendWithWeb3AuthProvider(provider, vtx);
}
