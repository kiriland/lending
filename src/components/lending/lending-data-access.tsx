
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
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { BN, Program } from '@coral-xyz/anchor'
import { Cluster, Keypair, PublicKey, SystemProgram,Transaction,  LAMPORTS_PER_SOL  } from '@solana/web3.js'
import { useMutation, useQuery,useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'

interface InitBankArgs {
  signer: PublicKey
  mint: PublicKey
  depositRate: BN
  borrowRate: BN
  priceFeed: string
  name: string
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

export function useLendingProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getLendingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getLendingProgram(provider, programId), [provider, programId])
  const {wallet,publicKey , sendTransaction} = useWallet()
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