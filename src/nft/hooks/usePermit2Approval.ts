import { sendAnalyticsEvent } from '@uniswap/analytics'
import { InterfaceEventName } from '@uniswap/analytics-events'
import { CurrencyAmount, SupportedChainId, Token } from '@uniswap/sdk-core'
import { useWeb3React } from '@web3-react/core'
import usePermit2Allowance, { AllowanceState } from 'hooks/usePermit2Allowance'
import { useCallback, useMemo, useState } from 'react'
import invariant from 'tiny-invariant'

function getURAddress(chainId?: number, nftURAddress?: string) {
  if (!chainId) return

  // if mainnet and on NFT flow, use the contract address returned by GQL
  if (chainId === SupportedChainId.MAINNET) {
    return nftURAddress ?? '0x6af1D4D6719B6B58e10363Ff859ADf0337E46A13'
  }

  return '0x6af1D4D6719B6B58e10363Ff859ADf0337E46A13'
}

export default function usePermit2Approval(
  amount: CurrencyAmount<Token> | undefined,
  maximumAmount: CurrencyAmount<Token> | undefined,
  nftUniversalRouterContractAddress?: string
) {
  const { chainId } = useWeb3React()

  const universalRouterAddress = getURAddress(chainId, nftUniversalRouterContractAddress)
  const allowanceAmount = maximumAmount ?? (amount?.currency.isToken ? (amount as CurrencyAmount<Token>) : undefined)
  const allowance = usePermit2Allowance(allowanceAmount, universalRouterAddress)
  const isApprovalLoading = allowance.state === AllowanceState.REQUIRED && allowance.isApprovalLoading
  const [isAllowancePending, setIsAllowancePending] = useState(false)
  const updateAllowance = useCallback(async () => {
    invariant(allowance.state === AllowanceState.REQUIRED)
    setIsAllowancePending(true)
    try {
      await allowance.approveAndPermit()
      sendAnalyticsEvent(InterfaceEventName.APPROVE_TOKEN_TXN_SUBMITTED, {
        chain_id: chainId,
        token_symbol: maximumAmount?.currency.symbol,
        token_address: maximumAmount?.currency.address,
      })
    } catch (e) {
      console.error(e)
    } finally {
      setIsAllowancePending(false)
    }
  }, [allowance, chainId, maximumAmount?.currency.address, maximumAmount?.currency.symbol])

  return useMemo(() => {
    return {
      allowance,
      isApprovalLoading,
      isAllowancePending,
      updateAllowance,
    }
  }, [allowance, isAllowancePending, isApprovalLoading, updateAllowance])
}
