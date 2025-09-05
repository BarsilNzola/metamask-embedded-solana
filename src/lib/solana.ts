import { Connection, PublicKey, SystemProgram, TransactionMessage, VersionedTransaction, clusterApiUrl } from "@solana/web3.js";

// Create connection to Solana Devnet
export const makeConnection = () => {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl('devnet');
  console.log("Connecting to Solana RPC:", rpcUrl);
  return new Connection(rpcUrl, "confirmed");
};

// Get balance in lamports
export async function getBalanceLamports(connection: Connection, address: string) {
  try {
    console.log("Getting balance for address:", address);
    const publicKey = new PublicKey(address);
    const balance = await connection.getBalance(publicKey);
    console.log("Balance retrieved:", balance, "lamports");
    return balance;
  } catch (error) {
    console.error("Error getting balance:", error);
    throw error;
  }
}

// Transfer lamports between accounts
export async function transferLamports(
  connection: Connection,
  from: PublicKey,
  to: PublicKey,
  lamports: number,
  signAndSend: (tx: VersionedTransaction) => Promise<string>
) {
  try {
    console.log(`Transferring ${lamports} lamports from ${from.toString()} to ${to.toString()}`);
    
    const ix = SystemProgram.transfer({ 
      fromPubkey: from, 
      toPubkey: to, 
      lamports 
    });
    
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("finalized");
    
    const msg = new TransactionMessage({ 
      payerKey: from, 
      recentBlockhash: blockhash, 
      instructions: [ix] 
    }).compileToV0Message();
    
    const tx = new VersionedTransaction(msg);
    const sig = await signAndSend(tx);
    
    console.log("Transaction sent, confirming...");
    await connection.confirmTransaction({ 
      signature: sig, 
      blockhash, 
      lastValidBlockHeight 
    }, "confirmed");
    
    console.log("Transaction confirmed:", sig);
    return sig;
  } catch (error) {
    console.error("Error transferring lamports:", error);
    throw error;
  }
}

// Get transaction history
export async function getRecentTransactions(connection: Connection, address: string, limit: number = 5) {
  try {
    const publicKey = new PublicKey(address);
    const signatures = await connection.getSignaturesForAddress(publicKey, { limit });
    return signatures;
  } catch (error) {
    console.error("Error getting transactions:", error);
    throw error;
  }
}

// Airdrop SOL for testing (devnet only)
export async function requestAirdrop(connection: Connection, address: string, lamports: number = 1000000000) {
  try {
    const publicKey = new PublicKey(address);
    const signature = await connection.requestAirdrop(publicKey, lamports);
    await connection.confirmTransaction(signature, "confirmed");
    return signature;
  } catch (error) {
    console.error("Error requesting airdrop:", error);
    throw error;
  }
}

// Check if address is valid
export function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}