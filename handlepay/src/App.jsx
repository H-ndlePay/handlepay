// src/App.jsx
import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import {
  DynamicContextProvider,
  DynamicWidget,
} from "@dynamic-labs/sdk-react-core";
import { EthereumWalletConnectors } from "@dynamic-labs/ethereum";
import { DynamicWagmiConnector } from "@dynamic-labs/wagmi-connector";

import { createConfig, WagmiProvider } from "wagmi";
import { http } from "viem";
import { mainnet } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import Nav from "./components/Nav.jsx";
import UsersPage from "./pages/UsersPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";

const wagmiConfig = createConfig({
  chains: [mainnet],
  multiInjectedProviderDiscovery: false,
  transports: { [mainnet.id]: http() },
});

const queryClient = new QueryClient();

export default function App() {
  return (
    <DynamicContextProvider
      settings={{
        environmentId: "b540b722-a15d-4702-bdc6-500cc7c5e851",
        walletConnectors: [EthereumWalletConnectors],
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <DynamicWagmiConnector>
            <Router>
              <Nav />
              <Routes>
                <Route path="/" element={<UsersPage />} />
                <Route path="/payments" element={<PaymentsPage />} />
              </Routes>
            </Router>
          </DynamicWagmiConnector>
        </QueryClientProvider>
      </WagmiProvider>
    </DynamicContextProvider>
  );
}
