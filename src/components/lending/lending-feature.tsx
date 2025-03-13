'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { AppHero, ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useLendingProgram } from './lending-data-access'
import { UserInit ,UserNum} from './lending-ui'

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
