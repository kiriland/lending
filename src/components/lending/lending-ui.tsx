'use client'

import { Keypair, Connection, LAMPORTS_PER_SOL, PublicKey } from '@solana/web3.js'
import { useMemo, useState } from 'react'
import { AppModal,ellipsify } from '../ui/ui-layout'
import { BN, Program } from '@coral-xyz/anchor'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useGetTokenAccounts, useLendingProgram, useLendingProgramAccount } from './lending-data-access'
import { useWallet,useConnection } from '@solana/wallet-adapter-react'
import exp from 'constants'
import { getLendingProgram, getLendingProgramId } from '@project/anchor'
import { TOKEN_PROGRAM_ID, createMint, getAssociatedTokenAddress, mintTo } from '@solana/spl-token'
import { useGetBalance } from '../lending/lending-data-access'


type Mode = 'deposit' | 'withdraw';
export function UserInit() {
  const { initUser } = useLendingProgram()
    const { publicKey } = useWallet()
    
  return (
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={() => initUser.mutateAsync(publicKey!)}
      disabled={initUser.isPending}
    >
      Register {initUser.isPending && '...'}
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
                <p>
            <strong>Last Updated Deposit:</strong> {balance.lastUpdatedDeposit.toString()}
          </p>
          <p>
            <strong>Last Updated Borrow:</strong> {balance.lastUpdatedBorrow.toString()}
          </p>
              </div>
            ))}
          </div>
          
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
            <div className="flex space-x-2 justify-between">
              <div className="flex space-x-2">
              <BorrowButton borrowMint={bank.account.tokenMintAddress.toString()} tickerSymbol={bank.account.config.tickerSymbol.toString()} priceFeedId={bank.account.config.oracleFeedId.toString()} />
              <RepayButton mint={bank.account.tokenMintAddress.toString()} />
              <DepositTokenButton mint={bank.account.tokenMintAddress.toString()} />
              </div>
              <CloseBankButton mint={bank.account.tokenMintAddress.toString()} />
            </div>
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
            <strong>Last Updated Borrow:</strong> {bank.account.lastUpdatedBorrow.toString()}
          </p>
          <p>
            <strong>Interest Rate:</strong> {bank.account.interestRate.toString()}
          </p>
          <p>
            <strong>Config:</strong> {JSON.stringify(bank.account.config.tickerSymbol)}
          </p>
        </div>
      ))}
    </div>
  );
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
        liquidationThreshold: new BN(1),
        maxLtv: new BN(0.7),
        oracleKey: priceFeed,
        tickerSymbol: tokenName,
        interestRate: new BN(0.1),
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

export function DepositTokenButton({ mint }: { mint: String }) {
  const { depositToken, withdrawToken } = useLendingProgram();
  const { publicKey } = useWallet();
  const [showSendModal, setShowSendModal] = useState(false)
  return (
    <div><ModalSend show={showSendModal} hide={() => setShowSendModal(false)} mint={new PublicKey(mint)}/>
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

function ModalSend({ hide, show, mint}: { hide: () => void; show: boolean,mint: PublicKey }) {
  const {wallet,publicKey,sendTransaction} = useWallet()
  const { depositToken, withdrawToken } = useLendingProgram();
  
  const [amount, setAmount] = useState('1')
  const [mode, setMode] = useState<Mode>('deposit');
  if ( !sendTransaction) {
    return <div>Wallet not connected</div>
  }
  const handleSubmit = async () => {
    const decimals = 6; // Replace with the actual decimals for the token
    const scaledAmount = new BN(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
    
    try {
      if (mode === 'deposit') {
        await depositToken.mutateAsync({
          signer: publicKey!,
          mint: new PublicKey(mint),
          amount: scaledAmount,
        });
      } else {
        await withdrawToken.mutateAsync({
          mint: new PublicKey(mint),
          amount: scaledAmount,
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
        type="number"
        step="any"
        min="0.000000001"
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
export function BorrowButton({ borrowMint,tickerSymbol,priceFeedId }: { borrowMint: String,tickerSymbol: String, priceFeedId: String }) {
  const { borrowToken } = useLendingProgram();
  const { publicKey } = useWallet();
  const [showBorrowTokenModal, setShowBorrowTokenModal] = useState(false)
 
  return (
    <div><BorrowTokenModal show={showBorrowTokenModal} hide={() => setShowBorrowTokenModal(false)} borrowMint={borrowMint} />
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={() => setShowBorrowTokenModal(true)}
      disabled={borrowToken.isPending}
    >
      Borrow {tickerSymbol} {borrowToken.isPending && '...'}
    </button>
    </div>
  );
 }

 function BorrowTokenModal({ hide, show, borrowMint}: { hide: () => void; show: boolean,borrowMint: String, }) {
  const wallet = useWallet()
  const { borrowToken } = useLendingProgram();
  const [amount, setAmount] = useState('')
  const [collateralMint, setCollateralMint] = useState('')

  if ( !wallet.sendTransaction) {
    return <div>Wallet not connected</div>
  }

  return (
    <AppModal
      hide={hide}
      show={show}
      title="Borrow Token"
      submitDisabled={!borrowMint || !collateralMint  || borrowToken.isPending}
      submitLabel="Borrow Token"
      submit={() => {
        const decimals = 6; // Replace with the actual decimals for the token
        const scaledAmount = new BN(Math.floor(parseFloat(amount) * Math.pow(10, decimals)));
        borrowToken
          .mutateAsync({
            collateralMint: new PublicKey(collateralMint),
            borrowMint: new PublicKey(borrowMint),
            amount: new BN(scaledAmount)
          })
          .then(() => hide())
      }}
    >
      
      <input
        disabled={borrowToken.isPending}
        type="text"
        placeholder="Collateral Mint"
        className="input input-bordered w-full"
        value={collateralMint}
        onChange={(e) => setCollateralMint(e.target.value)}
      />
      <input
        disabled={borrowToken.isPending}
        type="text"
        placeholder="Amount to Borrow"
        className="input input-bordered w-full"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
    </AppModal>
  )
}

export function RepayButton({ mint }: { mint: String }) {
  const { repayToken } = useLendingProgram();
  const { publicKey } = useWallet();
  const [showCloseBankModal, setShowCloseBankModal] = useState(false)
 
  const handleCloseBank = async () => {


    try {
      await repayToken.mutateAsync({
        amount: new BN(1),
        mint: new PublicKey(mint),
      });
    } catch (error) {
      console.error(error);
    }
  };
  return (<button
    className="btn btn-xs lg:btn-md btn-primary"
    onClick={handleCloseBank}
    disabled={repayToken.isPending}
  >
    Repay {repayToken.isPending && '...'}
  </button>)
 }
export function FaucetButton() {
  const { publicKey } = useWallet();
  const [showFaucetModal, setShowFaucetModal] = useState(false);
  const { createMint , initBank ,depositToken, bankAccounts, initUser} = useLendingProgram()
  const fakeUser = Keypair.generate()
  const assets = [
    { name: 'USDT', priceFeed: '0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b', mint: '' },
    { name: 'SOL', priceFeed: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',mint: '' },
    { name: 'USDC', priceFeed: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',mint: '' },
  ];

  const handleFaucet = async (name:string, priceFeed: string) => {
    try {
      const newKeypair = Keypair.generate()
     
      const decimals = 6
      const scaledAmount = new BN(Math.floor(100 * Math.pow(10, decimals)));
      const mintAddress = await createMint.mutateAsync({ keypair: newKeypair,fakeUser: fakeUser.publicKey });
      const createdAsset = assets.find(asset => asset.name === name);
      if (createdAsset) {
        createdAsset.mint = mintAddress.toString();
        console.log(`Created mint for ${name}: ${mintAddress.toString()}`);
      }
      await initBank.mutateAsync({
        signer: publicKey!,
        mint: newKeypair.publicKey,
        liquidationThreshold: new BN(1),
        maxLtv: new BN(1),
        oracleKey: createdAsset!.priceFeed,
        tickerSymbol: createdAsset!.name,
        interestRate: new BN(0.1),
      });
      
     
      await depositToken.mutateAsync({
        signer: publicKey!,
        mint: newKeypair.publicKey,
        amount: scaledAmount
      });

      
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div>
      <AppModal
        hide={() => setShowFaucetModal(false)}
        show={showFaucetModal}
        title="Faucet"
        submitDisabled={true}
        submitLabel=""
      >
        <table className="table-auto w-full">
          <thead>
            <tr>
              <th className="px-4 py-2">Asset</th>
              <th className="px-4 py-2">Bank Balance</th>
              
              <th className="px-4 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((asset, index) => (
              <tr key={index}>
                <td className="border-transparent px-4 py-2">{asset.name}</td>
                <td className="border-transparent px-4 py-2">
                  {(() => {
                    const bank = bankAccounts.data?.find(
                      (bank) => bank.account.config.tickerSymbol === asset.name
                    );
                    return bank ? (bank.account.totalDeposits.div(new BN(Math.pow(10, 6)))).toString() : 'Not Created';
                  })()}
                
                </td>
                
                
                
                <td className="border-transparent px-4 py-2">
                  <button
                    className="btn btn-xs lg:btn-md btn-primary"
                    onClick={() => handleFaucet(asset.name, asset.priceFeed)}
                  >
                    Faucet
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </AppModal>
      <button
        className="btn btn-xs lg:btn-md btn-primary"
        onClick={() => setShowFaucetModal(true)}
      >
        Faucet
      </button>
    </div>
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
