'use client'

import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useMemo, useState } from 'react'
import { AppModal,ellipsify } from '../ui/ui-layout'
import { BN, Program } from '@coral-xyz/anchor'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useLendingProgram, useLendingProgramAccount } from './lending-data-access'
import { useWallet } from '@solana/wallet-adapter-react'
import exp from 'constants'
import { getLendingProgram, getLendingProgramId } from '@project/anchor'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'


type Mode = 'deposit' | 'withdraw';
export function UserInit() {
  const { initUser } = useLendingProgram()
    const { publicKey } = useWallet()
    
  return (
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={() => initUser.mutateAsync()}
      disabled={initUser.isPending}
    >
      UserInit {initUser.isPending && '...'}
    </button>
    
  )
}
export function UserNum () {
  const { initUser } = useLendingProgram()
    const { publicKey } = useWallet()
    const { userAccounts} = useLendingProgram()
    return (<div>
      {userAccounts.data?.map((account, index) => (
        <div key={index} className="border p-2 my-2">
          <p><strong>User Account:</strong> {account.publicKey.toString()}</p>
          <p>
            <strong>Owner:</strong> {account.account.owner.toString()}
          </p>
          <div>
            <strong >Balances:</strong>
            {account.account.balances.map((balance, idx) => (
              <div key={idx}>
                <span>Bank: {balance.bankAddress.toString()}</span> |{' '}
                <span >Deposited: {balance.deposited.toString()}</span> |{' '}
                <span>Deposited Shares: {balance.depositedShares.toString()}</span> |{' '}
                <span>Borrowed: {balance.borrowed.toString()}</span> |{' '}
                <span>Borrowed Shares: {balance.borrowedShares.toString()}</span>
              </div>
            ))}
          </div>
          <p>
            <strong>Last Updated Deposit:</strong> {account.account.lastUpdatedDeposit.toString()}
          </p>
          <p>
            <strong>Last Updated Borrow:</strong> {account.account.lastUpdatedBorrow.toString()}
          </p>
        </div>
      ))}
    </div>)
}
export function BanksNum () {
  const {bankAccounts} = useLendingProgram()
  return (
    <div className="space-y-4 p-4">
      {bankAccounts.data?.map((bank, index) => (
        <div key={index} className="border rounded p-4 shadow-sm">
          <CloseBankButton mint={bank.account.tokenMintAddress.toString()}/>
          <p>
            <strong>Bank Account:</strong> {bank.publicKey.toString()}
          </p>
          <p>
            <strong>Authority:</strong> {bank.account.authority.toString()}
          </p>
          <p>
            <strong>Token Mint Address:</strong>{' '}
            {bank.account.tokenMintAddress.toString()}
          </p>
          <p>
            <strong>Total Deposits:</strong> {bank.account.totalDeposits.toString()}
          </p>
          <p>
            <strong>Total Deposit Shares:</strong>{' '}
            {bank.account.totalDepositsShares.toString()}
          </p>
          <p>
            <strong>Total Borrowed:</strong> {bank.account.totalBorrowed.toString()}
          </p>
          <p>
            <strong>Total Borrowed Shares:</strong>{' '}
            {bank.account.totalBorrowedShares.toString()}
          </p>
          <p>
            <strong>Liquidation Threshold:</strong>{' '}
            {bank.account.liquidationThreshold.toString()}
          </p>
          <p>
            <strong>Liquidation Bonus:</strong>{' '}
            {bank.account.liquidationBonus.toString()}
          </p>
          <p>
            <strong>Close Factor:</strong> {bank.account.closeFactor.toString()}
          </p>
          <p>
            <strong>Max LTV:</strong> {bank.account.maxLtv.toString()}
          </p>
          <p>
            <strong>Last Updated:</strong> {bank.account.lastUpdated.toString()}
          </p>
          <p>
            <strong>Interest Rate:</strong> {bank.account.interestRate.toString()}
          </p>
          <p>
            <strong>Config:</strong> {JSON.stringify(bank.account.config)}
          </p>
        </div>
      ))}
    </div>
  );
}
export function MintBanks () {
  const { createMints } = useLendingProgram()
  return (<button
    className="btn btn-xs lg:btn-md btn-primary"
    onClick={() => createMints.mutateAsync()}
    disabled={createMints.isPending}
  >
    Create Tokens {createMints.isPending && '...'}
  </button>)
}
export function InitBankButton({priceFeed,tokenName,mint}:{priceFeed: string, tokenName: string, mint: string}) {
  const { initBank } = useLendingProgram();
  const { publicKey } = useWallet();

  const handleInitBank = async () => {

    const Signer = publicKey;


    const depositRate = new BN(100);
    const borrowRate = new BN(50);

    try {
      await initBank.mutateAsync({
        signer: Signer!,
        mint: new PublicKey(mint),
        depositRate,
        borrowRate,
        priceFeed,
        name: tokenName,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={handleInitBank}
      disabled={initBank.isPending}
    >
      Init Bank {tokenName}{initBank.isPending && '...'}
    </button>
  );
}

export function DepositTokenButton() {
  const { depositToken, withdrawToken } = useLendingProgram();
  const { publicKey } = useWallet();
  const [showSendModal, setShowSendModal] = useState(false)
  return (
    <div><ModalSend show={showSendModal} hide={() => setShowSendModal(false)} />
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={() => setShowSendModal(true)}
      disabled={depositToken.isPending}
    >
      Deposit or Withdraw Tokens {(depositToken.isPending && '...') || (withdrawToken.isPending && '...') }
    </button>
    </div>
  );
}

function ModalSend({ hide, show }: { hide: () => void; show: boolean }) {
  const wallet = useWallet()
  const { depositToken, withdrawToken } = useLendingProgram();
  const [mint, setMint] = useState('')
  const [amount, setAmount] = useState('1')
  const [mode, setMode] = useState<Mode>('deposit');
  if ( !wallet.sendTransaction) {
    return <div>Wallet not connected</div>
  }
  const handleSubmit = async () => {
    try {
      if (mode === 'deposit') {
        await depositToken.mutateAsync({
          mint: new PublicKey(mint),
          amount: new BN(amount),
        });
      } else {
        await withdrawToken.mutateAsync({
          mint: new PublicKey(mint),
          amount: new BN(amount),
        });
      }
      hide();
    } catch (error) {
      console.error(error);
    }
  };
  return (
    <AppModal
      hide={hide}
      show={show}
      title={mode === 'deposit' ? 'Deposit to Bank' : 'Withdraw from Bank'}
      submitDisabled={!mint || !amount || (mode === 'deposit' ? depositToken.isPending : withdrawToken.isPending)}
      submitLabel={mode === 'deposit' ? 'Deposit' : 'Withdraw'}
      submit={handleSubmit}
    > <div className="flex items-center justify-center my-4">
    <div className="relative inline-flex items-center rounded overflow-hidden ">
      <button
        onClick={() => setMode('deposit')}
        className={`px-4 py-2 btn  transition-colors duration-200 ${
          mode === 'deposit' ? 'btn-primary' : 'btn-outline'
        }`}
      >
        Deposit
      </button>
      <button
        onClick={() => setMode('withdraw')}
        className={`px-4 py-2btn btn transition-colors duration-200 ${
          mode === 'withdraw' ? 'btn-primary' : 'btn-outline'
        }`}
      >
        Withdraw
      </button>
    </div>
  </div>
      <input
        disabled={depositToken.isPending}
        type="text"
        placeholder="Bank Address Mint"
        className="input input-bordered w-full"
        value={mint}
        onChange={(e) => setMint(e.target.value)}
      />
      <input
        disabled={depositToken.isPending}
        type="number"
        step="any"
        min="1"
        placeholder="Amount"
        className="input input-bordered w-full"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
    </AppModal>
  )
}


export function CloseBankButton({ mint }: { mint: String }) {
  const { closeBank } = useLendingProgram();
  const { publicKey } = useWallet();
  const [showCloseBankModal, setShowCloseBankModal] = useState(false)
 if (mint) {
  const handleCloseBank = async () => {


    try {
      await closeBank.mutateAsync({
        
        mint: new PublicKey(mint),
      });
    } catch (error) {
      console.error(error);
    }
  };
  return (<button
    className="btn btn-xs lg:btn-md btn-primary"
    onClick={handleCloseBank}
    disabled={closeBank.isPending}
  >
    Close Bank {closeBank.isPending && '...'}
  </button>)
 }else{
  return (
    <div><ModalCloseBank show={showCloseBankModal} hide={() => setShowCloseBankModal(false)} />
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={() => setShowCloseBankModal(true)}
      disabled={closeBank.isPending}
    >
      Close Bank {closeBank.isPending && '...'}
    </button>
    </div>
  );
 }
}
function ModalCloseBank({ hide, show }: { hide: () => void; show: boolean }) {
  const wallet = useWallet()
  const { closeBank } = useLendingProgram();
  const [mint, setMint] = useState('')

  if ( !wallet.sendTransaction) {
    return <div>Wallet not connected</div>
  }

  return (
    <AppModal
      hide={hide}
      show={show}
      title="Close Bank"
      submitDisabled={!mint  || closeBank.isPending}
      submitLabel="Close Bank"
      submit={() => {
        closeBank
          .mutateAsync({
            mint: new PublicKey(mint),
          })
          .then(() => hide())
      }}
    >
      <input
        disabled={closeBank.isPending}
        type="text"
        placeholder="Bank Address Mint"
        className="input input-bordered w-full"
        value={mint}
        onChange={(e) => setMint(e.target.value)}
      />
      
    </AppModal>
  )
}
// export function CounterList() {
//   const { accounts, getProgramAccount } = useLendingProgram()

//   if (getProgramAccount.isLoading) {
//     return <span className="loading loading-spinner loading-lg"></span>
//   }
//   if (!getProgramAccount.data?.value) {
//     return (
//       <div className="alert alert-info flex justify-center">
//         <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
//       </div>
//     )
//   }
//   return (
//     <div className={'space-y-6'}>
//       {accounts.isLoading ? (
//         <span className="loading loading-spinner loading-lg"></span>
//       ) : accounts.data?.length ? (
//         <div className="grid md:grid-cols-2 gap-4">
//           {accounts.data?.map((account) => (
//             <CounterCard key={account.publicKey.toString()} account={account.publicKey} />
//           ))}
//         </div>
//       ) : (
//         <div className="text-center">
//           <h2 className={'text-2xl'}>No accounts</h2>
//           No accounts found. Create one above to get started.
//         </div>
//       )}
//     </div>
//   )
// }

// function CounterCard({ account }: { account: PublicKey }) {
//   const { accountQuery, incrementMutation, setMutation, decrementMutation, closeMutation } = useLendingProgramAccount({
//     account,
//   })

//   const count = useMemo(() => accountQuery.data?.count ?? 0, [accountQuery.data?.count])

//   return accountQuery.isLoading ? (
//     <span className="loading loading-spinner loading-lg"></span>
//   ) : (
//     <div className="card card-bordered border-base-300 border-4 text-neutral-content">
//       <div className="card-body items-center text-center">
//         <div className="space-y-6">
//           <h2 className="card-title justify-center text-3xl cursor-pointer" onClick={() => accountQuery.refetch()}>
//             {count}
//           </h2>
//           <div className="card-actions justify-around">
//             <button
//               className="btn btn-xs lg:btn-md btn-outline"
//               onClick={() => incrementMutation.mutateAsync()}
//               disabled={incrementMutation.isPending}
//             >
//               Increment
//             </button>
//             <button
//               className="btn btn-xs lg:btn-md btn-outline"
//               onClick={() => {
//                 const value = window.prompt('Set value to:', count.toString() ?? '0')
//                 if (!value || parseInt(value) === count || isNaN(parseInt(value))) {
//                   return
//                 }
//                 return setMutation.mutateAsync(parseInt(value))
//               }}
//               disabled={setMutation.isPending}
//             >
//               Set
//             </button>
//             <button
//               className="btn btn-xs lg:btn-md btn-outline"
//               onClick={() => decrementMutation.mutateAsync()}
//               disabled={decrementMutation.isPending}
//             >
//               Decrement
//             </button>
//           </div>
//           <div className="text-center space-y-4">
//             <p>
//               <ExplorerLink path={`account/${account}`} label={ellipsify(account.toString())} />
//             </p>
//             <button
//               className="btn btn-xs btn-secondary btn-outline"
//               onClick={() => {
//                 if (!window.confirm('Are you sure you want to close this account?')) {
//                   return
//                 }
//                 return closeMutation.mutateAsync()
//               }}
//               disabled={closeMutation.isPending}
//             >
//               Close
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   )
// }
