export interface SolanaWalletLite {
  name: string;
  icon: string;
  detect: () => boolean;
  connect: () => Promise<string>;
  disconnect?: () => Promise<void>;
}

// Phantom
const phantom: SolanaWalletLite = {
  name: "Phantom",
  icon: "https://phantom.app/img/logo.png",
  detect: () => !!(window as any).phantom?.solana?.isPhantom,
  connect: async () => {
    const p = (window as any).phantom?.solana;
    if (!p) throw new Error("Phantom not installed");
    const res = await p.connect();
    return res.publicKey.toString();
  },
  disconnect: async () => {
    const p = (window as any).phantom?.solana;
    if (p?.disconnect) await p.disconnect();
  },
};

// Backpack
const backpack: SolanaWalletLite = {
  name: "Backpack",
  icon: "https://backpack.app/images/logo.png",
  detect: () => !!(window as any).backpack,
  connect: async () => {
    const p = (window as any).backpack;
    if (!p) throw new Error("Backpack not installed");
    const res = await p.connect();
    return res.publicKey.toString();
  },
};

// Solflare
const solflare: SolanaWalletLite = {
  name: "Solflare",
  icon: "https://solflare.com/favicon.ico",
  detect: () => !!(window as any).solflare?.isSolflare,
  connect: async () => {
    const p = (window as any).solflare;
    if (!p) throw new Error("Solflare not installed");
    const res = await p.connect();
    return res.publicKey.toString();
  },
};

export const detectSolanaWallets = (): SolanaWalletLite[] => {
  const arr: SolanaWalletLite[] = [];
  if (phantom.detect()) arr.push(phantom);
  if (backpack.detect()) arr.push(backpack);
  if (solflare.detect()) arr.push(solflare);
  return arr;
};
