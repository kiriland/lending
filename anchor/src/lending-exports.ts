// Here we export some useful types and functions for interacting with the Anchor program.
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Cluster, PublicKey } from '@solana/web3.js'
import LendingIDL from '../target/idl/lending_dapp.json'
import type { LendingDapp } from '../target/types/lending_dapp'

// Re-export the generated IDL and type
export { LendingDapp, LendingIDL }

// The programId is imported from the program IDL.
export const LENDING_PROGRAM_ID = new PublicKey(LendingIDL.address)

// This is a helper function to get the Counter Anchor program.
export function getLendingProgram(provider: AnchorProvider, address?: PublicKey) {
  return new Program({ ...LendingIDL, address: address ? address.toBase58() : LendingIDL.address } as LendingDapp, provider)
}

// This is a helper function to get the program ID for the Counter program depending on the cluster.
export function getLendingProgramId(cluster: Cluster) {
  switch (cluster) {
    case 'devnet': return new PublicKey('C1kXjvQ96YVqyvkBF6cF9W28YmieevsA37WNZ8uKfWXF')
    case 'testnet':
      // This is the program ID for the Lending program on devnet and testnet.
      return new PublicKey('C1kXjvQ96YVqyvkBF6cF9W28YmieevsA37WNZ8uKfWXF')
    case 'mainnet-beta':
    default:
      return LENDING_PROGRAM_ID
  }
}
