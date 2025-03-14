'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { AppHero, ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useLendingProgram } from './lending-data-access'
import { BanksNum, CloseBankButton, DepositTokenButton, InitBankButton, MintBanks, UserInit ,UserNum} from './lending-ui'

export default function LendingFeature() {
  const { publicKey } = useWallet()
  const { programId } = useLendingProgram()

  return publicKey ? (
    <div>
      <AppHero
        title="Lending"
        subtitle={
          'Create a new user account by clicking the "Create" button. The state of a account is stored on-chain and can be manipulated by calling the program\'s methods .'
        }
      >
        <p className="mb-6">
          <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
        <UserInit />
        <UserNum />
        <MintBanks />
        <InitBankButton priceFeed="0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a" tokenName="USDC" mint="Asf9i5qchssRLtriYdsur9Ywg2cC9ei9hNR3trRRWxrV"/>
        <InitBankButton priceFeed="0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d" tokenName="SOL" mint="H18zXxFvbSkfLRy2tPu3136af4AqaDoz5FembjPEZp7z"/>
        <DepositTokenButton />
        
        < BanksNum />
      </AppHero>
      
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  )
}
