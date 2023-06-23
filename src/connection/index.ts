import { CoinbaseWallet } from '@web3-react/coinbase-wallet'
import { initializeConnector } from '@web3-react/core'
import { GnosisSafe } from '@web3-react/gnosis-safe'
import { MetaMask } from '@web3-react/metamask'
import { Network } from '@web3-react/network'
import { Connector } from '@web3-react/types'
import METAMASK_ICON from 'assets/images/metamask.svg'
import WALLET_CONNECT_ICON from 'assets/images/walletConnectIcon.svg'
import INJECTED_DARK_ICON from 'assets/svg/browser-wallet-dark.svg'
import INJECTED_LIGHT_ICON from 'assets/svg/browser-wallet-light.svg'
import { useCallback } from 'react'
import { isMobile } from 'utils/userAgent'

import { RPC_PROVIDERS } from '../constants/providers'
import { Connection, ConnectionType } from './types'
import { getIsCoinbaseWallet, getIsInjected, getIsMetaMaskWallet } from './utils'
import { WalletConnectPopup } from './WalletConnect'
import { WalletConnectV2Popup } from './WalletConnectV2'

function onError(error: Error) {
  console.debug(`web3-react error: ${error}`)
}

const [web3Network, web3NetworkHooks] = initializeConnector<Network>(
  (actions) => new Network({ actions, urlMap: RPC_PROVIDERS, defaultChainId: 94 })
)
export const networkConnection: Connection = {
  getName: () => 'Network',
  connector: web3Network,
  hooks: web3NetworkHooks,
  type: ConnectionType.NETWORK,
  shouldDisplay: () => false,
}

const getIsCoinbaseWalletBrowser = () => isMobile && getIsCoinbaseWallet()
const getIsMetaMaskBrowser = () => isMobile && getIsMetaMaskWallet()
const getIsInjectedMobileBrowser = () => getIsCoinbaseWalletBrowser() || getIsMetaMaskBrowser()

const getShouldAdvertiseMetaMask = () =>
  !getIsMetaMaskWallet() && !isMobile && (!getIsInjected() || getIsCoinbaseWallet())
const getIsGenericInjector = () => getIsInjected() && !getIsMetaMaskWallet() && !getIsCoinbaseWallet()

const [web3Injected, web3InjectedHooks] = initializeConnector<MetaMask>((actions) => new MetaMask({ actions, onError }))

const injectedConnection: Connection = {
  // TODO(WEB-3131) re-add "Install MetaMask" string when no injector is present
  getName: () => (getIsGenericInjector() ? 'Browser Wallet' : 'MetaMask'),
  connector: web3Injected,
  hooks: web3InjectedHooks,
  type: ConnectionType.INJECTED,
  getIcon: (isDarkMode: boolean) =>
    getIsGenericInjector() ? (isDarkMode ? INJECTED_DARK_ICON : INJECTED_LIGHT_ICON) : METAMASK_ICON,
  shouldDisplay: () => getIsMetaMaskWallet() || getShouldAdvertiseMetaMask() || getIsGenericInjector(),
  // If on non-injected, non-mobile browser, prompt user to install Metamask
  overrideActivate: () => {
    if (getShouldAdvertiseMetaMask()) {
      window.open('https://metamask.io/', 'inst_metamask')
      return true
    }
    return false
  },
}

const [web3WalletConnect, web3WalletConnectHooks] = initializeConnector<WalletConnectPopup>(
  (actions) => new WalletConnectPopup({ actions, onError })
)
export const walletConnectConnection: Connection = {
  getName: () => 'WalletConnect',
  connector: web3WalletConnect,
  hooks: web3WalletConnectHooks,
  type: ConnectionType.WALLET_CONNECT,
  getIcon: () => WALLET_CONNECT_ICON,
  shouldDisplay: () => !getIsInjectedMobileBrowser(),
}

const [web3WalletConnectV2, web3WalletConnectV2Hooks] = initializeConnector<WalletConnectV2Popup>(
  (actions) => new WalletConnectV2Popup({ actions, onError })
)
export const walletConnectV2Connection: Connection = {
  getName: () => 'WalletConnectV2',
  connector: web3WalletConnectV2,
  hooks: web3WalletConnectV2Hooks,
  type: ConnectionType.WALLET_CONNECT_V2,
  getIcon: () => WALLET_CONNECT_ICON,
  shouldDisplay: () => false,
}

export function getConnections() {
  return [injectedConnection, networkConnection]
}

export function useGetConnection() {
  return useCallback((c: Connector | ConnectionType) => {
    if (c instanceof Connector) {
      const connection = getConnections().find((connection) => connection.connector === c)
      if (!connection) {
        throw Error('unsupported connector')
      }
      return connection
    } else {
      switch (c) {
        case ConnectionType.INJECTED:
          return injectedConnection
        case ConnectionType.WALLET_CONNECT:
          return walletConnectConnection
        case ConnectionType.WALLET_CONNECT_V2:
          return walletConnectV2Connection
        case ConnectionType.NETWORK:
          return networkConnection
      }
    }
  }, [])
}
