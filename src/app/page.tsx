'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWeb3Auth } from '@web3auth/modal/react';
import { Connection, PublicKey, clusterApiUrl, VersionedTransaction } from '@solana/web3.js';
import { makeConnection, getBalanceLamports, transferLamports } from '@/lib/solana';
import { makeMetaplex, hasIdPass, mintIdPass } from '@/lib/metaplex';
import { detectSolanaWallets, type SolanaWallet } from '@/lib/walletDetection';

// Some environments need Buffer for base64; Next usually polyfills, but this is safe.
import { Buffer } from 'buffer';
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

export default function Page() {
  return <Home />;
}

function Home() {
  const { web3Auth, provider, isConnected } = useWeb3Auth();

  const [user, setUser] = useState<any>(null);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const [hasPass, setHasPass] = useState<boolean>(false);
  const [minting, setMinting] = useState<boolean>(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [lastSig, setLastSig] = useState<string | null>(null);
  const [solanaWallets, setSolanaWallets] = useState<SolanaWallet[]>([]);
  const [showWalletSelector, setShowWalletSelector] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<SolanaWallet | null>(null);

  // Pay-a-friend form
  const [friendAddr, setFriendAddr] = useState('');
  const [lamports, setLamports] = useState('1000');

  // Detect wallets on component mount
  useEffect(() => {
    const wallets = detectSolanaWallets();
    setSolanaWallets(wallets);
  }, []);

  // Devnet connection
  useEffect(() => {
    setConnection(makeConnection());
  }, []);

  // Load Web2 identity
  useEffect(() => {
    (async () => {
      if (!web3Auth) return;
      try {
        const info = await web3Auth.getUserInfo();
        setUser(info);
      } catch (e) {
        // ignore if not logged in
      }
    })();
  }, [web3Auth]);

  // Show wallet selector when Web3Auth connects but no Solana wallet is selected
  useEffect(() => {
    if (isConnected && !address && solanaWallets.length > 0) {
      setShowWalletSelector(true);
    }
  }, [isConnected, address, solanaWallets.length]);

  // Balance refresh when address/connection present
  useEffect(() => {
    (async () => {
      if (!connection || !address) return;
      const bal = await getBalanceLamports(connection, address);
      setBalance(bal);
    })();
  }, [connection, address]);

  // Auto-mint "ID Pass" NFT on first login
  useEffect(() => {
    let mounted = true;
   
    (async () => {
      if (!connection || !address) return;

      try {
        // For Metaplex, we need to use the Web3Auth provider
        if (!provider) {
          console.log("No provider available for Metaplex");
          return;
        }

        const mx = makeMetaplex(connection, provider);
        const ownerPk = new PublicKey(address);

        // Check if user already has an ID Pass
        const already = await hasIdPass(mx, ownerPk);
        if (mounted) setHasPass(already);

        // If no ID Pass exists, mint one
        if (!already) {
          if (mounted) {
            setMinting(true);
            setMintError(null);
          }
         
          try {
            const uri = `${window.location.origin}/idpass.json`;
            console.log("Minting ID Pass with URI:", uri);
           
            const mintResult = await mintIdPass(mx, ownerPk, uri);
            console.log("ID Pass minted successfully:", mintResult);
           
            if (mounted) setHasPass(true);
          } catch (mintError) {
            console.error("Failed to mint ID Pass:", mintError);
            if (mounted) {
              if (mintError instanceof Error) {
                setMintError(mintError.message);
              } else {
                setMintError("Failed to mint ID Pass");
              }
            }
          }
        }
      } catch (e) {
        console.error('ID Pass check/mint failed:', e);
        if (mounted) setMintError("Failed to check ID Pass status");
      } finally {
        if (mounted) setMinting(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [connection, provider, address]);

  // Connect to Solana wallet
  const connectSolanaWallet = async (wallet: SolanaWallet) => {
    try {
      setMinting(true);
      setMintError(null);
      
      console.log(`Connecting to ${wallet.name}...`);
      const walletAddress = await wallet.connect();
      
      console.log("Connected to Solana wallet:", walletAddress);
      setAddress(walletAddress);
      setSelectedWallet(wallet);
      setShowWalletSelector(false);
      
      // Refresh balance
      if (connection) {
        const bal = await getBalanceLamports(connection, walletAddress);
        setBalance(bal);
        console.log("Balance updated:", bal);
      }
    } catch (error) {
      console.error("Error connecting wallet:", error);
      // Fixed error handling
      if (error instanceof Error) {
        setMintError(`Failed to connect ${wallet.name}: ${error.message}`);
      } else {
        setMintError(`Failed to connect ${wallet.name}: Unknown error`);
      }
    } finally {
      setMinting(false);
    }
  };

  // Disconnect Solana wallet
  const disconnectSolanaWallet = async () => {
    try {
      if (selectedWallet?.disconnect) {
        await selectedWallet.disconnect();
      }
      
      setAddress(null);
      setSelectedWallet(null);
      setBalance(null);
      setHasPass(false);
      setShowWalletSelector(true);
      
      console.log("Disconnected from Solana wallet");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      setMintError("Failed to disconnect wallet");
    }
  };

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
    setSelectedWallet(null);
    setShowWalletSelector(false);
  };

  const doAirdrop = async () => {
    if (!connection || !address) return;
    const sig = await connection.requestAirdrop(new PublicKey(address), 1_000_000);
    await connection.confirmTransaction(sig, 'finalized');
    const bal = await getBalanceLamports(connection, address);
    setBalance(bal);
  };

  const doSend = async () => {
    if (!connection || !address) {
      setMintError("Please connect a Solana wallet first");
      return;
    }

    try {
      const fromPk = new PublicKey(address);
      const toPk = new PublicKey(friendAddr);

      // Use the connected wallet for signing
      const signAndSendTransaction = async (tx: VersionedTransaction) => {
        // This is a simplified version - you'll need to implement proper wallet-specific signing
        // For now, we'll use the Web3Auth provider for signing since Metaplex needs it
        const serialized = tx.serialize();
        const base64 = Buffer.from(serialized).toString('base64');

        if (!provider) {
          throw new Error("No provider available for signing");
        }

        const res = (await provider.request({
          method: 'solana_signAndSendTransaction',
          params: { message: base64 },
        })) as string;

        return res;
      };

      const signature = await transferLamports(
        connection,
        fromPk,
        toPk,
        parseInt(lamports, 10),
        signAndSendTransaction
      );

      setLastSig(signature);
      const bal = await getBalanceLamports(connection, address);
      setBalance(bal);
    } catch (error) {
      console.error("Error sending transaction:", error);
      // Fixed error handling
      if (error instanceof Error) {
        setMintError(`Transaction failed: ${error.message}`);
      } else {
        setMintError("Transaction failed: Unknown error");
      }
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-blue-900 text-white">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full filter blur-3xl opacity-20 animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[80vh]">
            <div className="text-center mb-10">
              <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                Solana Identity Gateway
              </h1>

              <p className="text-xl text-indigo-200 max-w-2xl mx-auto">
                Experience seamless Web3 authentication with Web3Auth and unlock the power of Solana payments with just your email or social accounts.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20 shadow-2xl w-full max-w-md">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold mb-2">Get Started</h2>
                <p className="text-indigo-200">Connect your wallet to begin</p>
              </div>

              <button
                onClick={handleConnect}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-bold text-lg hover:from-cyan-600 hover:to-purple-600 transition-all duration-300 shadow-lg hover:shadow-cyan-500/25 flex items-center justify-center gap-2"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"></path>
                </svg>
                Login with Email / Google
              </button>
             
              <div className="mt-6 flex items-center">
                <div className="flex-1 h-px bg-white/20"></div>
                <span className="px-3 text-sm text-indigo-200">Powered by Web3Auth</span>
                <div className="flex-1 h-px bg-white/20"></div>
              </div>
            </div>
           
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-cyan-500/20 rounded-full">
                  <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Secure Authentication</h3>
                <p className="text-indigo-200 text-sm">No seed phrases needed. Login with familiar methods.</p>
              </div>
             
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-purple-500/20 rounded-full">
                  <svg className="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Instant Transactions</h3>
                <p className="text-indigo-200 text-sm">Send SOL to anyone with just a few clicks.</p>
              </div>
             
              <div className="bg-white/5 backdrop-blur-sm rounded-xl p-5 border border-white/10">
                <div className="inline-flex items-center justify-center w-12 h-12 mb-4 bg-blue-500/20 rounded-full">
                  <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"></path>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2">Solana Powered</h3>
                <p className="text-indigo-200 text-sm">Leveraging the high-speed Solana blockchain.</p>
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400">
                Solana Identity Gateway
              </h1>
              <button
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors border border-white/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                </svg>
                Logout
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Profile Card */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                    {user?.name?.[0] || user?.email?.[0] || 'U'}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-lg truncate">{user?.email || user?.name || 'User'}</div>
                    <div className="text-cyan-300 text-sm">Connected to Solana Devnet</div>
                  </div>

                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      minting
                        ? 'bg-yellow-400/20 text-yellow-300'
                        : hasPass
                        ? 'bg-green-400/20 text-green-300'
                        : 'bg-red-400/20 text-red-300'
                    }`}
                  >
                    {minting ? 'Minting...' : hasPass ? 'ID Pass ✓' : 'No ID Pass'}
                  </span>
                </div>

                {/* Wallet Info Section */}
                <div className="mb-6">
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"></path>
                    </svg>
                    Wallet Information
                  </h3>
                 
                  <div className="mb-4">
                    <div className="text-sm text-indigo-200 mb-2">Wallet Address</div>
                    <div className="font-mono text-sm break-all p-3 bg-white/5 rounded-lg">
                      {address || 'Not connected'}
                    </div>
                  </div>
                 
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-indigo-200">Balance</div>
                      <div className="font-bold text-2xl">
                        {balance !== null ? `${(balance / 1e9).toFixed(6)} SOL` : (
                          <div className="h-8 w-32 bg-white/10 rounded animate-pulse"></div>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={doAirdrop}
                      className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      disabled={!address}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
                      </svg>
                      Get Test SOL
                    </button>
                  </div>
                </div>
              </div>

              {/* Wallet Connection Status */}
              {address && selectedWallet && (
                  <div className="pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-300">Connected with:</span>
                      <img src={selectedWallet.icon} alt={selectedWallet.name} className="w-5 h-5 rounded-full" />
                      <span className="text-white">{selectedWallet.name}</span>
                      <button
                        onClick={disconnectSolanaWallet}
                        className="ml-auto text-red-300 hover:text-red-200 text-xs"
                      >
                        Disconnect
                      </button>
                    </div>
                  </div>
                )}
              </div>

                {/* Pay a Friend Card */}
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-6 border border-white/20 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                    </svg>
                    Pay a Friend
                  </h3>
                  <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-300 rounded-full">
                    Requires ID Pass
                  </span>
                </div>
               
                {!hasPass ? (
                  <div className="text-center py-8">
                    <div className="text-indigo-200 mb-4">Waiting for your ID Pass to be minted...</div>
                    <div className="inline-flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm text-indigo-200 mb-2">
                        Friend's Solana Address
                      </label>
                      <input
                        type="text"
                        placeholder="Enter address"
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent placeholder-indigo-300"
                        value={friendAddr}
                        onChange={(e) => setFriendAddr(e.target.value)}
                      />
                    </div>
                   
                    <div>
                      <label className="block text-sm text-indigo-200 mb-2">
                        Amount (Lamports)
                      </label>
                      <input
                        type="number"
                        className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                        value={lamports}
                        onChange={(e) => setLamports(e.target.value)}
                      />
                      <div className="text-xs text-indigo-300 mt-2">
                        1 SOL = 1,000,000,000 Lamports
                      </div>
                    </div>
                   
                    <button
                      onClick={doSend}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-purple-500 text-white font-medium hover:from-cyan-600 hover:to-purple-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!friendAddr || !lamports || !address}
                    >
                      Send Payment
                    </button>
                  </div>
                )}
              </div>
           
            {mintError && (
              <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300">
                <div className="font-medium mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Minting Error
                </div>
                <div className="text-sm">{mintError}</div>
                <button
                  onClick={() => setMintError(null)}
                  className="mt-3 text-sm underline hover:text-red-200"
                >
                  Dismiss
                </button>
              </div>
            )}

            {minting && (
              <div className="mt-4 p-4 bg-blue-500/20 border border-blue-500/30 rounded-xl text-blue-300">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400"></div>
                  <span>Minting your ID Pass NFT... This may take a moment</span>
                </div>
              </div>
            )}

            {/* Transaction Status */}
            {lastSig && (
              <div className="mt-6 bg-cyan-500/10 backdrop-blur-md rounded-xl p-4 border border-cyan-500/20">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-cyan-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3 flex-1">
                    <p className="text-sm text-cyan-300">
                      Transaction sent!{' '}
                      <a
                        className="underline font-medium"
                        target="_blank"
                        rel="noopener noreferrer"
                        href={`https://explorer.solana.com/tx/${lastSig}?cluster=devnet`}
                      >
                        View on Explorer
                      </a>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Footer */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">

                <div>
                  <div className="text-2xl font-bold">{balance !== null ? (balance / 1e9).toFixed(6) : '0'}</div>
                  <div className="text-sm text-indigo-300">SOL Balance</div>
                </div>

                <div>
                  <div className="text-2xl font-bold">{hasPass ? '1' : '0'}</div>
                  <div className="text-sm text-indigo-300">ID Passes</div>
                </div>

                <div>
                  <div className="text-2xl font-bold">{lastSig ? '1' : '0'}</div>
                  <div className="text-sm text-indigo-300">Transactions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">Devnet</div>
                  <div className="text-sm text-indigo-300">Network</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}