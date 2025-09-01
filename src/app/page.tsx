'use client';

import { useEffect, useMemo, useState } from 'react';
import { useWeb3Auth } from '@web3auth/modal/react';
import { Connection, PublicKey, clusterApiUrl } from '@solana/web3.js';
import { makeConnection, getBalanceLamports, transferLamports } from '@/lib/solana';
import { makeMetaplex, hasIdPass, mintIdPass } from '@/lib/metaplex';

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
  const [lastSig, setLastSig] = useState<string | null>(null);

  // Pay-a-friend form
  const [friendAddr, setFriendAddr] = useState('');
  const [lamports, setLamports] = useState('1000');

  // Devnet connection
  useEffect(() => {
    // If you have makeConnection() already, use it:
    setConnection(makeConnection());
    // Or inline:
    // setConnection(new Connection(clusterApiUrl('devnet')));
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

  // Fetch Solana address after provider is ready
  useEffect(() => {
    (async () => {
      if (!provider) return;
      const accounts = (await provider.request({
        method: 'solana_requestAccounts',
      })) as string[];
      if (accounts?.[0]) setAddress(accounts[0]);
    })();
  }, [provider]);

  // Balance refresh when address/connection present
  useEffect(() => {
    (async () => {
      if (!connection || !address) return;
      const bal = await getBalanceLamports(connection, address);
      setBalance(bal);
    })();
  }, [connection, address]);

  // Auto-mint “ID Pass” NFT on first login
  useEffect(() => {
    (async () => {
      if (!connection || !provider || !address) return;

      try {
        const mx = makeMetaplex(connection, provider);
        const ownerPk = new PublicKey(address);

        const already = await hasIdPass(mx, ownerPk);
        setHasPass(already);

        if (!already) {
          setMinting(true);
          const uri = `${window.location.origin}/idpass.json`; // ensure this file exists in /public
          await mintIdPass(mx, ownerPk, uri);                   // your metaplex.ts should create a non-transferable NFT
          setHasPass(true);
        }
      } catch (e) {
        console.error('ID Pass check/mint failed:', e);
      } finally {
        setMinting(false);
        // Optional: balances can change slightly on mint; refresh
        if (connection && address) {
          const bal = await getBalanceLamports(connection, address);
          setBalance(bal);
        }
      }
    })();
  }, [connection, provider, address]);

  // Actions
  const handleConnect = async () => {
    if (!web3Auth) return;
    await web3Auth.connect(); // opens modal; on success, provider becomes available via hook
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
    const sig = await connection.requestAirdrop(new PublicKey(address), 1_000_000); // 0.001 SOL
    await connection.confirmTransaction(sig, 'finalized');
    const bal = await getBalanceLamports(connection, address);
    setBalance(bal);
  };

  const doSend = async () => {
    if (!connection || !provider || !address) return;

    const fromPk = new PublicKey(address);
    const toPk = new PublicKey(friendAddr);

    const sig = await transferLamports(
      connection,
      fromPk,
      toPk,
      parseInt(lamports, 10),
      async (tx) => {
        // Serialize and send via Web3Auth provider
        const serialized = tx.serialize();
        const base64 = Buffer.from(serialized).toString('base64');

        const res = (await provider.request({
          method: 'solana_signAndSendTransaction',
          params: { message: base64 },
        })) as string; // signature string

        return res;
      }
    );

    setLastSig(sig);
    // refresh balance
    const bal = await getBalanceLamports(connection, address);
    setBalance(bal);
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      {!isConnected ? (
        <button
          onClick={handleConnect}
          className="px-6 py-3 rounded-2xl shadow bg-blue-600 text-white"
        >
          Login with Email / Google
        </button>
      ) : (
        <>
          {/* Identity pill */}
          <div className="flex items-center gap-2 p-3 rounded-2xl shadow bg-white">
            <span className="text-sm text-gray-600">Signed in as</span>
            <span className="font-mono">{user?.email || user?.name || '—'}</span>
            <span
              className={`ml-auto text-xs px-2 py-1 rounded-full ${
                minting
                  ? 'bg-yellow-100 text-yellow-700'
                  : hasPass
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}
            >
              {minting ? 'Minting ID Pass…' : hasPass ? 'ID Pass ✓' : 'No ID Pass'}
            </span>
            <button onClick={handleLogout} className="ml-2 text-sm underline">
              Logout
            </button>
          </div>

          {/* Wallet Info */}
          <div className="rounded-2xl p-4 shadow bg-white space-y-2">
            <div className="text-sm">Wallet Address</div>
            <div className="font-mono break-all">{address || '—'}</div>
            <div className="mt-2">
              Balance:{' '}
              {balance !== null ? <b>{(balance / 1e9).toFixed(6)} SOL</b> : '…'}
            </div>
            <div className="flex gap-2 mt-2">
              <button
                onClick={doAirdrop}
                className="px-3 py-2 rounded-xl bg-green-500 text-white"
              >
                Devnet Airdrop (0.001 SOL)
              </button>
            </div>
          </div>

          {/* Pay a Friend (gated) */}
          <div className="rounded-2xl p-4 shadow bg-white space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Pay a Friend</h2>
              <span className="text-xs">Requires ID Pass</span>
            </div>
            {!hasPass ? (
              <div className="text-sm text-gray-600">
                We’ll unlock this once your ID Pass is ready.
              </div>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Friend's Solana Address"
                  className="w-full border rounded p-2"
                  value={friendAddr}
                  onChange={(e) => setFriendAddr(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Lamports (1 SOL = 1,000,000,000)"
                  className="w-full border rounded p-2"
                  value={lamports}
                  onChange={(e) => setLamports(e.target.value)}
                />
                <button
                  onClick={doSend}
                  className="px-4 py-2 rounded-2xl shadow bg-blue-600 text-white"
                >
                  Send
                </button>
              </>
            )}
          </div>

          {/* Last Tx */}
          {lastSig && (
            <div className="text-xs">
              Tx:{' '}
              <a
                className="underline text-blue-600"
                target="_blank"
                href={`https://explorer.solana.com/tx/${lastSig}?cluster=devnet`}
              >
                {lastSig}
              </a>
            </div>
          )}
        </>
      )}
    </main>
  );
}
