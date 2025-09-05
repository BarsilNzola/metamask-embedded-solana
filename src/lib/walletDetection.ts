export interface SolanaWallet {
    name: string;
    icon: string;
    detect: () => boolean;
    connect: () => Promise<string>;
    disconnect?: () => Promise<void>;
}
  
// Phantom Wallet
const phantomWallet: SolanaWallet = {
    name: "Phantom",
    icon: "https://phantom.app/img/logo.png",
    detect: () => !!(window as any).phantom?.solana?.isPhantom,
    connect: async () => {
      const provider = (window as any).phantom?.solana;
      if (!provider) throw new Error("Phantom not installed");
      const response = await provider.connect();
      return response.publicKey.toString();
    },
    disconnect: async () => {
      const provider = (window as any).phantom?.solana;
      if (provider) await provider.disconnect();
    }
};
  
// Backpack Wallet
const backpackWallet: SolanaWallet = {
    name: "Backpack",
    icon: "https://backpack.app/images/logo.png",
    detect: () => !!(window as any).backpack,
    connect: async () => {
      const provider = (window as any).backpack;
      if (!provider) throw new Error("Backpack not installed");
      const response = await provider.connect();
      return response.publicKey.toString();
    }
};
  
// Solflare Wallet
const solflareWallet: SolanaWallet = {
    name: "Solflare",
    icon: "https://solflare.com/favicon.ico",
    detect: () => !!(window as any).solflare?.isSolflare,
    connect: async () => {
      const provider = (window as any).solflare;
      if (!provider) throw new Error("Solflare not installed");
      const response = await provider.connect();
      return response.publicKey.toString();
    }
};
  
// Detect all available Solana wallets
export const detectSolanaWallets = (): SolanaWallet[] => {
    const wallets: SolanaWallet[] = [];
    
    if (phantomWallet.detect()) wallets.push(phantomWallet);
    if (backpackWallet.detect()) wallets.push(backpackWallet);
    if (solflareWallet.detect()) wallets.push(solflareWallet);
    
    return wallets;
};
  
// Get the best available wallet
export const getPreferredWallet = (): SolanaWallet | null => {
    const wallets = detectSolanaWallets();
    return wallets.length > 0 ? wallets[0] : null;
};
  
// Check if any Solana wallet is installed
  export const hasSolanaWallet = (): boolean => {
    return detectSolanaWallets().length > 0;
};