import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";


export const makeConnection = () => new Connection(process.env.NEXT_PUBLIC_SOLANA_RPC!, "confirmed");


export async function getBalanceLamports(connection: Connection, address: string) {
return connection.getBalance(new PublicKey(address));
}


export async function transferLamports(
    connection: Connection,
    from: PublicKey,
    to: PublicKey,
    lamports: number,
    signAndSend: (tx: VersionedTransaction) => Promise<string>
) {
    const ix = SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports });
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
    const msg = new TransactionMessage({ payerKey: from, recentBlockhash: blockhash, instructions: [ix] }).compileToV0Message();
    const tx = new VersionedTransaction(msg);
    const sig = await signAndSend(tx);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
}