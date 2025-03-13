'use client'

import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useMemo } from 'react'
import { ellipsify } from '../ui/ui-layout'
import { BN, Program } from '@coral-xyz/anchor'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useLendingProgram, useLendingProgramAccount } from './lending-data-access'
import { useWallet } from '@solana/wallet-adapter-react'
import exp from 'constants'
import { getLendingProgram, getLendingProgramId } from '@project/anchor'



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
export function InitBankButton() {
  const { initBank } = useLendingProgram();
  const { publicKey } = useWallet();

  const handleInitBank = async () => {

    const Signer = publicKey;


    const depositRate = new BN(100);
    const borrowRate = new BN(50);
    const priceFeed = "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a"; 
    const TokenName = "USDC";

    // Replace with your actual mint public key (for example, one returned from your createMints mutation)
    const dummyMint = new PublicKey("GRb4xNPZqkUSCGwawz2NTjgPo5ugTWmWXgJXwNH3AKTu");

    try {
      await initBank.mutateAsync({
        signer: Signer!,
        mint: dummyMint,
        depositRate,
        borrowRate,
        priceFeed,
        name: TokenName,
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
      Init Bank {initBank.isPending && '...'}
    </button>
  );
}

export function DepositTokenButton() {
  const { depositToken } = useLendingProgram();
  const { publicKey } = useWallet();

  // Replace this dummy mint with your actual token mint address.
  const dummyMint = new PublicKey("GRb4xNPZqkUSCGwawz2NTjgPo5ugTWmWXgJXwNH3AKTu");
  // Define the deposit amount (in smallest units). Adjust as needed.
  const depositAmount = new BN(1000000);

  const handleDeposit = async () => {
    

    try {
      await depositToken.mutateAsync({
        mint: dummyMint,
        amount: depositAmount,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={handleDeposit}
      disabled={depositToken.isPending}
    >
      Deposit Tokens {depositToken.isPending && '...'}
    </button>
  );
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
