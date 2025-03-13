'use client'

import { getLendingProgram, getLendingProgramId } from '@project/anchor'
import {TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID} from '@solana/spl-token'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { BN, Program } from '@coral-xyz/anchor'
import { Cluster, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL  } from '@solana/web3.js'
import { useMutation, useQuery,useQueryClient } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'

interface InitBankArgs {
  signer: Keypair
  mint: PublicKey
  depositRate: BN
  borrowRate: BN
  priceFeed: string
  name: string
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
export function useRequestAirdrop({ address }: { address: PublicKey }) {
    const { connection } = useConnection()
    const transactionToast = useTransactionToast()
    const client = useQueryClient()
  
    return useMutation({
      mutationKey: ['airdrop', { endpoint: connection.rpcEndpoint, address }],
      mutationFn: async (amount: number = 1) => {
        const [latestBlockhash, signature] = await Promise.all([
          connection.getLatestBlockhash(),
          connection.requestAirdrop(address, amount * LAMPORTS_PER_SOL),
        ])
  
        await connection.confirmTransaction({ signature, ...latestBlockhash }, 'confirmed')
        return signature
      },
      onSuccess: (signature) => {
        transactionToast(signature)
        return Promise.all([
          client.invalidateQueries({
            queryKey: ['get-balance', { endpoint: connection.rpcEndpoint, address }],
          }),
          client.invalidateQueries({
            queryKey: ['get-signatures', { endpoint: connection.rpcEndpoint, address }],
          }),
        ])
      },
    })
  }
export function useLendingProgram() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getLendingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getLendingProgram(provider, programId), [provider, programId])
  const {wallet,publicKey } = useWallet()
    const client = useQueryClient()

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
          signer: signer.publicKey,
          mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([signer])
        .rpc({ commitment: 'confirmed' })
    },
    onSuccess: (signature: string) => {
      transactionToast(signature)
      bankAccounts.refetch()
    },
    onError: () => toast.error('Failed to initialize bank'),
  })
  

  return {
    program,
    programId,
    getProgramAccount,
    initUser,
    initBank,
    bankAccounts,
    userAccounts,
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