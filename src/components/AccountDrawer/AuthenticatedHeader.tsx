import { Trans } from '@lingui/macro'
import { sendAnalyticsEvent, TraceEvent } from '@uniswap/analytics'
import { BrowserEvent, InterfaceElementName, InterfaceEventName, SharedEventName } from '@uniswap/analytics-events'
import { formatNumber, NumberType } from '@uniswap/conedison/format'
import { CurrencyAmount, Token } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import { ButtonEmphasis, ButtonSize, LoadingButtonSpinner, ThemeButton } from 'components/Button'
import Column from 'components/Column'
import { AutoRow } from 'components/Row'
import { LoadingBubble } from 'components/Tokens/loading'
import { formatDelta } from 'components/Tokens/TokenDetails/PriceChart'
import Tooltip from 'components/Tooltip'
import { useGetConnection } from 'connection'
import { usePortfolioBalancesQuery } from 'graphql/data/__generated__/types-and-hooks'
import { useAtomValue } from 'jotai/utils'
import {useProfilePageState, useSellAsset, useWalletBalance, useWalletCollections} from 'nft/hooks'
import { useIsNftClaimAvailable } from 'nft/hooks/useIsNftClaimAvailable'
import { ProfilePageStateType } from 'nft/types'
import { useCallback, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Copy, CreditCard, IconProps, Info, LogOut, Settings } from 'react-feather'
import { useNavigate } from 'react-router-dom'
import { shouldDisableNFTRoutesAtom } from 'state/application/atoms'
import { useAppDispatch } from 'state/hooks'
import { updateSelectedWallet } from 'state/user/reducer'
import styled, { useTheme } from 'styled-components/macro'
import { CopyHelper, ExternalLink, ThemedText } from 'theme'

import { shortenAddress } from '../../nft/utils/address'
import { useCloseModal, useFiatOnrampAvailability, useOpenModal, useToggleModal } from '../../state/application/hooks'
import { ApplicationModal } from '../../state/application/reducer'
import { useUserHasAvailableClaim, useUserUnclaimedAmount } from '../../state/claim/hooks'
import StatusIcon from '../Identicon/StatusIcon'
import { useToggleAccountDrawer } from '.'
import IconButton, { IconHoverText, IconWithConfirmTextButton } from './IconButton'
import MiniPortfolio from './MiniPortfolio'
import { portfolioFadeInAnimation } from './MiniPortfolio/PortfolioRow'
import {useNativeCurrencyBalances} from "../../lib/hooks/useCurrencyBalance";

const AuthenticatedHeaderWrapper = styled.div`
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
`

const HeaderButton = styled(ThemeButton)`
  border-color: transparent;
  border-radius: 12px;
  border-style: solid;
  border-width: 1px;
  height: 40px;
  margin-top: 8px;
`

const WalletButton = styled(ThemeButton)`
  border-radius: 12px;
  padding-top: 10px;
  padding-bottom: 10px;
  margin-top: 4px;
  color: white;
  border: none;
`

const UNIButton = styled(WalletButton)`
  border-radius: 12px;
  padding-top: 10px;
  padding-bottom: 10px;
  margin-top: 4px;
  color: white;
  border: none;
  background: linear-gradient(to right, #9139b0 0%, #4261d6 100%);
`

const IconContainer = styled.div`
  display: flex;
  align-items: center;
  & > a,
  & > button {
    margin-right: 8px;
  }

  & > button:last-child {
    margin-right: 0px;
    ${IconHoverText}:last-child {
      left: 0px;
    }
  }
`
const FiatOnrampNotAvailableText = styled(ThemedText.Caption)`
  align-items: center;
  color: ${({ theme }) => theme.textSecondary};
  display: flex;
  justify-content: center;
`
const FiatOnrampAvailabilityExternalLink = styled(ExternalLink)`
  align-items: center;
  display: flex;
  height: 14px;
  justify-content: center;
  margin-left: 6px;
  width: 14px;
`

const StatusWrapper = styled.div`
  display: inline-block;
  width: 70%;
  max-width: 70%;
  overflow: hidden;
  padding-right: 14px;
  display: inline-flex;
`

const AccountNamesWrapper = styled.div`
  overflow: hidden;
  white-space: nowrap;
  display: flex;
  width: 100%;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
`

const HeaderWrapper = styled.div`
  margin-bottom: 20px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
`

const CopyText = styled(CopyHelper).attrs({
  InitialIcon: Copy,
  CopiedIcon: Copy,
  gap: 4,
  iconSize: 14,
  iconPosition: 'right',
})``

const FadeInColumn = styled(Column)`
  ${portfolioFadeInAnimation}
`

const PortfolioDrawerContainer = styled(Column)`
  flex: 1;
`

export function PortfolioArrow({ change, ...rest }: { change: number } & IconProps) {
  const theme = useTheme()
  return change < 0 ? (
    <ArrowDownRight color={theme.accentCritical} size={20} {...rest} />
  ) : (
    <ArrowUpRight color={theme.accentSuccess} size={20} {...rest} />
  )
}

const LogOutCentered = styled(LogOut)`
  transform: translateX(2px);
`

export default function AuthenticatedHeader({ account, openSettings }: { account: string; openSettings: () => void }) {
  const { connector, ENSName } = useWeb3React()
  const dispatch = useAppDispatch()
  const getConnection = useGetConnection()
  const balance = useWalletBalance()
  const connection = getConnection(connector)
  const disconnect = useCallback(() => {
    if (connector && connector.deactivate) {
      connector.deactivate()
    }
    connector.resetState()
    dispatch(updateSelectedWallet({ wallet: undefined }))
  }, [connector, dispatch])

  const { data: portfolioBalances } = usePortfolioBalancesQuery({
    variables: { ownerAddress: account ?? '' },
    fetchPolicy: 'cache-only', // PrefetchBalancesWrapper handles balance fetching/staleness; this component only reads from cache
  })
  const portfolio = portfolioBalances?.portfolios?.[0]
  const totalBalance = portfolio?.tokensTotalDenominatedValue?.value
  const absoluteChange = portfolio?.tokensTotalDenominatedValueChange?.absolute?.value
  const percentChange = portfolio?.tokensTotalDenominatedValueChange?.percentage?.value
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false)

  return (
    <AuthenticatedHeaderWrapper>
      <HeaderWrapper>
        <StatusWrapper>
          <StatusIcon connection={connection} size={40} />
          {account && (
            <AccountNamesWrapper>
              <ThemedText.SubHeader>
                <CopyText toCopy={ENSName ?? account}>{ENSName ?? shortenAddress(account, 4, 4)}</CopyText>
              </ThemedText.SubHeader>
              {/* Displays smaller view of account if ENS name was rendered above */}
              {ENSName && (
                <ThemedText.BodySmall color="textTertiary">
                  <CopyText toCopy={account}>{shortenAddress(account, 4, 4)}</CopyText>
                </ThemedText.BodySmall>
              )}
            </AccountNamesWrapper>
          )}
        </StatusWrapper>
        <IconContainer>
          {!showDisconnectConfirm && (
            <IconButton data-testid="wallet-settings" onClick={openSettings} Icon={Settings} />
          )}
          <TraceEvent
            events={[BrowserEvent.onClick]}
            name={SharedEventName.ELEMENT_CLICKED}
            element={InterfaceElementName.DISCONNECT_WALLET_BUTTON}
          >
            <IconWithConfirmTextButton
              data-testid="wallet-disconnect"
              onConfirm={disconnect}
              onShowConfirm={setShowDisconnectConfirm}
              Icon={LogOutCentered}
              text="Disconnect"
            />
          </TraceEvent>
        </IconContainer>
      </HeaderWrapper>
      <PortfolioDrawerContainer>
        {balance !== undefined ? (
          <FadeInColumn gap="xs">
            <ThemedText.HeadlineLarge fontWeight={500} data-testid="portfolio-total-balance">
              {formatNumber(Number(balance.balance), NumberType.TokenTx)} BCTS
            </ThemedText.HeadlineLarge>
          </FadeInColumn>
        ) : (
          <Column gap="xs">
            <LoadingBubble height="44px" width="170px" />
            <LoadingBubble height="16px" width="100px" margin="4px 0 20px 0" />
          </Column>
        )}
        <MiniPortfolio account={account} />
      </PortfolioDrawerContainer>
    </AuthenticatedHeaderWrapper>
  )
}
