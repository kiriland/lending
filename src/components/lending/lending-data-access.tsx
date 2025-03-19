
import { getLendingProgram, getLendingProgramId } from '@project/anchor'
import {
    MINT_SIZE,
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    createInitializeMintInstruction,
    createMintToInstruction,
    mintTo,
  } from '@solana/spl-token';
import { useConnection, useWallet, AnchorWallet, useAnchorWallet } from '@solana/wallet-adapter-react'
import { BN, Program,Wallet} from '@coral-xyz/anchor'
import { Cluster, Keypair, PublicKey, SystemProgram,Transaction,  LAMPORTS_PER_SOL  } from '@solana/web3.js'
import { useMutation, useQuery,useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { getLogs } from '@solana-developers/helpers'
import { useTransactionToast } from '../ui/ui-layout'
import { PythSolanaReceiver, InstructionWithEphemeralSigners } from '@pythnetwork/pyth-solana-receiver';
import { HermesClient } from "@pythnetwork/hermes-client";
import { sendTransactions } from "@pythnetwork/solana-utils";
interface InitBankArgs {
  signer: PublicKey
  mint: PublicKey
  depositRate: BN
  borrowRate: BN
  priceFeed: string
  name: string
  interestRate: BN,
}

interface DepositArgs {
    mint: PublicKey
    amount: BN
  }
  interface WithdrawArgs {
    mint: PublicKey
    amount: BN
  }
  interface CloseBankArgs {
    mint: PublicKey
    
  }
  interface RepayArgs {
    mint: PublicKey
    amount: BN
  }
  interface BorrowTokenArgs {
    borrowMint: PublicKey
  
    collateralMint: PublicKey
    amount: BN
  }
export async function findUserAccount(
  userPubkey: PublicKey,
  programId: PublicKey
): Promise<PublicKey> {
  const [userAccount] = await PublicKey.findProgramAddress(
    [userPubkey.toBuffer()],
    programId
  )
  return userAccount
}
export async function findBankAccount(
    mint: PublicKey,
    programId: PublicKey
  ): Promise<PublicKey> {
    const [bankAccount] = await PublicKey.findProgramAddress(
      [mint.toBuffer()],
      programId
    )
    return bankAccount
  }

  function toHexString(byteArray:number[]) {
    return "0x" + Array.from(byteArray, function(byte) {
      return ('0' + (byte & 0xFF).toString(16)).slice(-2);
    }).join('')
  }
  const SOL_PRICE_FEED_ID =
      '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d';
     const USDC_PRICE_FEED_ID =
    "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
const USDT_PRICE_FEED_ID =
    "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b";
export function useLendingProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getLendingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getLendingProgram(provider, programId), [provider, programId])
  
  const {wallet,publicKey , sendTransaction} = useWallet()
  const anchorWallet = useAnchorWallet();
  

    const client = useQueryClient()

  
    const createMints = useMutation({
        mutationKey: ['lending', 'create-mints', { cluster }],
        mutationFn: async () => {
        const payer = publicKey!;
        const decimals = 6;
        const lamportsForMint = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
        const mintAKeypair = Keypair.generate();
        const mintBKeypair = Keypair.generate();
        let tx = new Transaction();
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = publicKey!
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mintAKeypair.publicKey,
        lamports: lamportsForMint,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintAKeypair.publicKey,
        decimals,
        payer,
        payer,
        TOKEN_PROGRAM_ID
      )
    );
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mintBKeypair.publicKey,
        lamports: lamportsForMint,
        space: MINT_SIZE,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        mintBKeypair.publicKey,
        decimals,
        payer,
        payer,
        TOKEN_PROGRAM_ID
      )
    );
    tx.partialSign(mintAKeypair, mintBKeypair);
    const createMintTxSignature = await sendTransaction(tx, connection);
    await connection.confirmTransaction( { signature: createMintTxSignature, blockhash, lastValidBlockHeight }, 'confirmed');


    const tokenAccountA = await getAssociatedTokenAddress(mintAKeypair.publicKey, publicKey!);
    const tokenAccountB = await getAssociatedTokenAddress(mintBKeypair.publicKey, publicKey!);

    const createTokenA = createAssociatedTokenAccountInstruction(
        publicKey!,
        tokenAccountA,
        publicKey!,    
        mintAKeypair.publicKey 
      );
      const mintTokenA = createMintToInstruction(
        mintAKeypair.publicKey,
        tokenAccountA, 
        publicKey!,
        300000000000,
        [],
        TOKEN_PROGRAM_ID
      )
      const createTokenB = createAssociatedTokenAccountInstruction(
        publicKey!,
        tokenAccountB,
        publicKey!,    
        mintBKeypair.publicKey 
      );
      const mintTokenB = createMintToInstruction(
        mintBKeypair.publicKey,
        tokenAccountB,
        publicKey!,
        200000000000,
        [],
        TOKEN_PROGRAM_ID
      )
      let txToken = new Transaction().add(createTokenA).add(mintTokenA).add(createTokenB).add(mintTokenB);
      txToken.recentBlockhash = blockhash;
      txToken.feePayer = publicKey!
      const createTxTokenSignature = await sendTransaction(txToken, connection);
      await connection.confirmTransaction(
        { signature:createTxTokenSignature, blockhash, lastValidBlockHeight },
        'confirmed'
      );

       return createMintTxSignature   
        },
        onSuccess: (signature: string) => {
          transactionToast(signature)
          userAccounts.refetch()
        },
        onError: (error: any) =>
          toast.error(`Failed to initialize Banks account: ${error.message}`),
      })
  const bankAccounts = useQuery({
    queryKey: ['lending', 'banks', { cluster }],
    queryFn: async () => {
      return await program.account.bank.all()
    },
  })
  const userAccounts = useQuery({
    queryKey: ['lending', 'users', { cluster }],
    queryFn: async () => {
      return await program.account.user.all()
    },
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initUser = useMutation({
    mutationKey: ['lending', 'init-user', { cluster }],
    mutationFn: async () => {
      return program.methods
        .initUser()
        .accounts({
          signer: publicKey!,
        })
        
        .rpc()
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      userAccounts.refetch()
    },
    onError: (error: any) =>
      toast.error(`Failed to initialize user account: ${error.message}`),
  })
  const closeBank = useMutation({
    mutationKey: ['lending', 'close-bank', { cluster }],
    mutationFn: async ({ mint }: CloseBankArgs) => {
      return program.methods
        .closeBank()
        .accounts({
          signer: publicKey!,
          mint: mint,
          tokenProgram: TOKEN_PROGRAM_ID
        })
        
        .rpc()
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      bankAccounts.refetch(),
      userAccounts.refetch()
    },
    onError: (error: any) =>
      toast.error(`Failed to initialize user account: ${error.message}`),
  })
  const borrowToken = useMutation({
    mutationKey: ['lending', 'borrow', { cluster }],
    mutationFn: async ({ borrowMint, collateralMint, amount, }: BorrowTokenArgs) => {
      const banks = await program.account.bank.all();

      // Filter client‑side for the bank that matches the collateral mint.
      const collateralBank = banks.find(
        (bankAccount) =>
          bankAccount.account.tokenMintAddress.toString() === collateralMint.toString()
      );
      let priceFeedId = collateralBank?.account.config.oracleFeedId;
      
      const pythSolanaReceiver =  new PythSolanaReceiver({
        connection,
        wallet: anchorWallet as Wallet,
      });
      console.log(toHexString(priceFeedId!).toString());
    const solUsdPriceFeedAccount = pythSolanaReceiver
  .getPriceFeedAccountAddress(0, toHexString(priceFeedId!).toString())
  .toBase58();
  const solUsdPriceFeedAccountPubkey = new PublicKey(solUsdPriceFeedAccount);


const feedAccountInfo = await connection.getAccountInfo(
  solUsdPriceFeedAccountPubkey
);
    
console.log('solUsdPriceFeedAccountPubkey:',solUsdPriceFeedAccountPubkey.toBase58())
console.log('feedAccountInfo:', feedAccountInfo)
     
return program.methods
.borrow(new BN(amount))
.accounts({
  signer: anchorWallet?.publicKey,
  borrowMint: borrowMint,
  collateralMint: collateralMint,
  priceUpdate: solUsdPriceFeedAccount,
  tokenProgram: TOKEN_PROGRAM_ID
})
.rpc()

      
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      bankAccounts.refetch(),
      userAccounts.refetch()
    },
    onError: (error: any) => {
      toast.error(`Failed to borrow: ${error.message}`);},
  })
  const initBank = useMutation({
    mutationKey: ['lending', 'init-bank', { cluster }],
    mutationFn: async ({
      signer,
      mint,
      depositRate,
      borrowRate,
      priceFeed,
      name,
    }: InitBankArgs) => {
      return program.methods
        .initBank(depositRate, borrowRate, priceFeed, name)
        .accounts({
          signer: signer,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc({ commitment: 'confirmed' })
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      bankAccounts.refetch()
    },
    onError: () => toast.error('Failed to initialize bank'),
  })
  const depositToken = useMutation({
    mutationKey: ['lending', 'deposit', { cluster }],    mutationFn: async ({ mint, amount }: DepositArgs) => {
        return program.methods
          .deposit(amount)
          .accounts({
            signer: publicKey!,
                    mint: mint,
                    tokenProgram: TOKEN_PROGRAM_ID,
          })
          
          .rpc()
      },
      onSuccess: (signature: string) => {
        transactionToast(signature)
        bankAccounts.refetch()
        userAccounts.refetch()
      },
      onError: () => toast.error('Failed to deposit'),
  })
  const withdrawToken = useMutation({
    mutationKey: ['lending', 'withdraw', { cluster }],    mutationFn: async ({ mint, amount }: WithdrawArgs) => {
        return program.methods
          .withdraw(amount)
          .accounts({
            signer: publicKey!,
                    mint: mint,
                    tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc()
      },
      onSuccess: (signature: string) => {
        transactionToast(signature)
        bankAccounts.refetch()
        userAccounts.refetch()
      },
      onError: () => toast.error('Failed to withdraw'),
  })
  const repayToken = useMutation({
    mutationKey: ['lending', 'repay', { cluster }],    mutationFn: async ({ mint, amount }: RepayArgs) => {
        return program.methods
          .repay(amount)
          .accounts({
            signer: publicKey!,
                    mint: mint,
                    tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc()
      },
      onSuccess: (signature: string) => {
        transactionToast(signature)
        bankAccounts.refetch()
        userAccounts.refetch()
      },
      onError: () => toast.error('Failed to repay'),
  })

  return {
    program,
    programId,
    getProgramAccount,
    initUser,
    initBank,
    bankAccounts,
    depositToken,
    createMints,
    userAccounts,
    closeBank,
    withdrawToken,
    borrowToken,
    repayToken,
  }
}

export function useLendingProgramAccount({ account }: { account: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program } = useLendingProgram()

const accountQuery = useQuery({
    queryKey: ['lending', 'account', { cluster, account }],
    queryFn: () => program.account.user.fetch(account),
  })

  return {
    accountQuery,
  }
}