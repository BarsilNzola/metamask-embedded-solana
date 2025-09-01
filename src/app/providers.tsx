"use client";

import { ReactNode } from "react";
import { Web3AuthProvider } from "@web3auth/modal/react";
import { WEB3AUTH_NETWORK } from "@web3auth/modal";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <Web3AuthProvider
      config={{
        web3AuthOptions: {
          clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "",
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
        },
      }}
    >
      {children}
    </Web3AuthProvider>
  );
}