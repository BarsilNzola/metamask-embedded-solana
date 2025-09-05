"use client";

import { useEffect, useState } from "react";
import { useWeb3Auth } from "@web3auth/modal/react";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  makeConnection,
  getBalanceLamports,
  sendLamportsWithProvider,
} from "@/lib/solana";
import { makeMetaplex, hasIdPass, mintIdPass } from "@/lib/metaplex";
import { IdentitySigner } from "@metaplex-foundation/js";
import { SolanaWallet } from "@web3auth/solana-provider";

import { Buffer } from "buffer";

declare global {
  interface Window {
    Buffer?: typeof Buffer;
  }
}

if (typeof window !== "undefined" && !window.Buffer) {
  window.Buffer = Buffer;
}

export default function Page() {
  return <Home />;
}

function Home() {
  const { web3Auth, provider, isConnected } = useWeb3Auth();

  const [user, setUser] = useState<Record<string, unknown> | null>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [hasPass, setHasPass] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);

  const [friendAddr, setFriendAddr] = useState("");
  const [lamports, setLamports] = useState("1000");

  // Create Solana connection
  useEffect(() => {
    setConnection(makeConnection());
  }, []);

  // Get Web3Auth user info
  useEffect(() => {
    (async () => {
      if (!web3Auth) return;
      try {
        const info = await web3Auth.getUserInfo();
        setUser(info as Record<string, unknown>);
      } catch {
        // ignore when not logged in yet
      }
    })();
  }, [web3Auth]);

  // Fetch connected address properly via SolanaWallet wrapper
  useEffect(() => {
    (async () => {
      if (!provider) return;
      try {
        const solanaWallet = new SolanaWallet(provider);
        const pubkey = await solanaWallet.requestAccounts();
        if (pubkey?.[0]) {
          setAddress(pubkey[0]);
        }
      } catch (err) {
        console.error("Failed to get Solana accounts from provider:", err);
      }
    })();
  }, [provider]);

  // Refresh balance
  useEffect(() => {
    (async () => {
      if (!connection || !address) return;
      const bal = await getBalanceLamports(connection, address);
      setBalance(bal);
    })();
  }, [connection, address]);

  // Auto-mint ID Pass after login
  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!connection || !address || !provider) return;

      try {
        const ownerPk = new PublicKey(address);

        const identity: IdentitySigner = {
          publicKey: ownerPk,
          signTransaction: async (tx: Transaction) => tx,
          signAllTransactions: async (txs: Transaction[]) => txs,
          signMessage: async (message: Uint8Array) => message,
        };

        const mx = makeMetaplex(connection, identity);

        const already = await hasIdPass(mx, ownerPk);
        if (mounted) setHasPass(already);

        if (!already) {
          if (mounted) {
            setMinting(true);
            setMintError(null);
          }

          try {
            const uri = `${window.location.origin}/idpass.json`;
            await mintIdPass(mx, ownerPk, uri);
            if (mounted) setHasPass(true);
          } catch (err) {
            if (mounted) {
              setMintError(
                err instanceof Error ? err.message : "Failed to mint ID Pass"
              );
            }
          }
        }
      } catch {
        if (mounted) setMintError("Failed to check/mint ID Pass");
      } finally {
        if (mounted) setMinting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [connection, provider, address]);

  // Actions
  const handleConnect = async () => {
    if (!web3Auth) return;
    await web3Auth.connect();
  };

  const handleLogout = async () => {
    if (!web3Auth) return;
    await web3Auth.logout();
    setUser(null);
    setAddress(null);
    setBalance(null);
    setHasPass(false);
    setLastSig(null);
  };

  const doAirdrop = async () => {
    if (!connection || !address) return;
    const sig = await connection.requestAirdrop(
      new PublicKey(address),
      1_000_000
    ); // 0.001 SOL
    await connection.confirmTransaction(sig, "finalized");
    const bal = await getBalanceLamports(connection, address);
    setBalance(bal);
  };

  const doSend = async () => {
    if (!connection || !address || !provider) {
      setMintError("Please sign in with Web3Auth first.");
      return;
    }
    try {
      const fromPk = new PublicKey(address);
      const toPk = new PublicKey(friendAddr);
      const lamportsNum = parseInt(lamports, 10);
      if (Number.isNaN(lamportsNum) || lamportsNum <= 0) {
        setMintError("Enter a valid lamports amount.");
        return;
      }

      const sig = await sendLamportsWithProvider(
        connection,
        provider,
        fromPk,
        toPk,
        lamportsNum
      );
      setLastSig(sig);

      const bal = await getBalanceLamports(connection, address);
      setBalance(bal);
    } catch (err) {
      setMintError(
        err instanceof Error
          ? `Transaction failed: ${err.message}`
          : "Transaction failed"
      );
    }
  };

  // UI
  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">Web3Auth Solana Gateway</h1>

      {!isConnected ? (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-green-500 rounded hover:bg-green-400"
        >
          Connect with Web3Auth
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-white/10 border border-white/20 p-4">
            <div className="text-sm text-indigo-200">Signed in as</div>
            <div className="font-mono break-all">
              {(user?.email as string) || (user?.name as string) || "—"}
            </div>
          </div>

          <div className="rounded-xl bg-white/10 border border-white/20 p-4">
            <div className="text-sm text-indigo-200">Wallet Address</div>
            <div className="font-mono break-all">{address ?? "—"}</div>
            <div className="mt-2">
              Balance:{" "}
              {balance !== null ? <b>{(balance / 1e9).toFixed(6)} SOL</b> : "…"}
            </div>
            <div className="mt-3">
              <button
                onClick={doAirdrop}
                className="px-3 py-1 bg-blue-500 rounded hover:bg-blue-400"
              >
                Devnet Airdrop (0.001 SOL)
              </button>
            </div>
          </div>

          {/* Pay a Friend */}
          <div className="rounded-xl bg-white/10 border border-white/20 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Pay a Friend</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  minting
                    ? "bg-yellow-500/20"
                    : hasPass
                    ? "bg-green-500/20"
                    : "bg-red-500/20"
                }`}
              >
                {minting
                  ? "Minting ID Pass…"
                  : hasPass
                  ? "ID Pass ✓"
                  : "No ID Pass"}
              </span>
            </div>

            {!hasPass ? (
              <div className="text-sm text-indigo-200">
                We’ll unlock this once your ID Pass is ready.
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Friend's Solana address"
                  value={friendAddr}
                  onChange={(e) => setFriendAddr(e.target.value)}
                  className="w-full px-2 py-2 text-black rounded"
                />
                <input
                  type="number"
                  placeholder="Lamports (1 SOL = 1,000,000,000)"
                  value={lamports}
                  onChange={(e) => setLamports(e.target.value)}
                  className="w-full px-2 py-2 text-black rounded"
                />
                <button
                  onClick={doSend}
                  className="px-3 py-2 bg-yellow-500 rounded hover:bg-yellow-400 disabled:opacity-50"
                  disabled={!friendAddr || !lamports}
                >
                  Send
                </button>
              </>
            )}
          </div>

          {lastSig && (
            <p className="text-xs">
              Last Tx:{" "}
              <a
                href={`https://explorer.solana.com/tx/${lastSig}?cluster=devnet`}
                target="_blank"
                rel="noreferrer"
                className="underline text-blue-300"
              >
                View on Explorer
              </a>
            </p>
          )}

          {minting && <p>Minting your ID Pass…</p>}
          {hasPass && <p className="text-green-400">✅ You own an ID Pass!</p>}
          {mintError && <p className="text-red-400">Error: {mintError}</p>}

          <button
            onClick={handleLogout}
            className="px-3 py-2 bg-red-500 rounded hover:bg-red-400"
          >
            Logout
          </button>
        </div>
      )}
    </main>
  );
}
