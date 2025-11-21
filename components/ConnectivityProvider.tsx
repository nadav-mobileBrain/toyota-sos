'use client';

import React from 'react';

type ConnectivityState = {
  isOnline: boolean;
  lastOnlineAt: number | null;
};

const ConnectivityContext = React.createContext<ConnectivityState>({
  isOnline: true,
  lastOnlineAt: null,
});

export function useConnectivity() {
  return React.useContext(ConnectivityContext);
}

export function ConnectivityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ConnectivityContext.Provider
      value={{ isOnline: true, lastOnlineAt: null }}
    >
      {children}
    </ConnectivityContext.Provider>
  );
}
