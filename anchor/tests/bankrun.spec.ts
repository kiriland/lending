import { describe, it } from 'node:test';
import { BN, Program } from '@coral-xyz/anchor';
import { BankrunProvider } from 'anchor-bankrun';
import { AccountLayout } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { createAccount, createMint, mintTo } from 'spl-token-bankrun';
import type { RawAccount } from "@solana/spl-token";
import { PythSolanaReceiver } from '@pythnetwork/pyth-solana-receiver';
import { assert } from "chai";
import { startAnchor, BanksClient, ProgramTestContext } from 'solana-bankrun';

import { PublicKey, Keypair, Connection } from '@solana/web3.js';

// @ts-ignore
import IDL from '../target/idl/lending_dapp.json';
import { LendingDapp } from '../target/types/lending_dapp';
import { BankrunContextWrapper } from '../bankrun-utils/bankrunConnection';
const getTokenBalance = async (
  provider:  BankrunProvider,
  account: PublicKey
) => {
  const accountInfo = await provider.connection.getAccountInfo(account);
  if (!accountInfo) {
    console.error("Tried to balance of acc that doesn't exist");
    return 0;
  }
  const data: RawAccount = AccountLayout.decode(accountInfo.data);
  if (data === undefined || data.amount === undefined) {
    return 0;
  }
  const amount: BigInt = data.amount;
  return Number(amount);
};
describe('Lending Smart Contract Tests', async () => {
  let signer: Keypair;
  let usdcBankAccount: PublicKey;
  let solBankAccount: PublicKey;

  let solTokenAccount: PublicKey;
  let provider: BankrunProvider;
  let program: Program<LendingDapp>;
  let banksClient: BanksClient;
  let context: ProgramTestContext;
  let bankrunContextWrapper: BankrunContextWrapper;

  const pyth = new PublicKey('7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE');

  const devnetConnection = new Connection('https://api.devnet.solana.com');
  const accountInfo = await devnetConnection.getAccountInfo(pyth);

  context = await startAnchor(
    '',
    [{ name: 'lending_dapp', programId: new PublicKey(IDL.address) }],
    [
      {
        address: pyth,
        info: accountInfo,
      },
    ]
  );
  provider = new BankrunProvider(context);

  bankrunContextWrapper = new BankrunContextWrapper(context);

  const connection = bankrunContextWrapper.connection.toConnection();

  const pythSolanaReceiver = new PythSolanaReceiver({
    connection,
    wallet: provider.wallet,
  });

  const SOL_PRICE_FEED_ID =
    '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';
    const USDC_PRICE_FEED_ID =
    '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a';

  const solUsdPriceFeedAccount = pythSolanaReceiver
    .getPriceFeedAccountAddress(0, SOL_PRICE_FEED_ID)
    .toBase58();
  const usdcUsdPriceFeedAccount = pythSolanaReceiver
    .getPriceFeedAccountAddress(0, USDC_PRICE_FEED_ID)
    .toBase58();
    let solFeedAccountInfoKey = new PublicKey(solUsdPriceFeedAccount);
    let usdcfFeedAccountInfoKey = new PublicKey(usdcUsdPriceFeedAccount);
  const solfFeedAccountInfo = await devnetConnection.getAccountInfo(
    solFeedAccountInfoKey
  );
  const usdcfFeedAccountInfo = await devnetConnection.getAccountInfo(
    usdcfFeedAccountInfoKey
  );
  
  context.setAccount(solFeedAccountInfoKey, solfFeedAccountInfo);
  context.setAccount(usdcfFeedAccountInfoKey, usdcfFeedAccountInfo);
  console.log('pricefeed:', solUsdPriceFeedAccount);

  console.log('Pyth Account Info:', accountInfo);
  program = new Program<LendingDapp>(IDL as LendingDapp, provider);

  banksClient = context.banksClient;

  signer = provider.wallet.payer;

  const mintUSDC = await createMint(
    // @ts-ignore
    banksClient,
    signer,
    signer.publicKey,
    null,
    2
  );

  const mintSOL = await createMint(
    // @ts-ignore
    banksClient,
    signer,
    signer.publicKey,
    null,
    2
  );

  [usdcBankAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), mintUSDC.toBuffer()],
    program.programId
  );

  [solBankAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), mintSOL.toBuffer()],
    program.programId
  );

  [solTokenAccount] = PublicKey.findProgramAddressSync(
    [Buffer.from('treasury'), mintSOL.toBuffer()],
    program.programId
  );

  console.log('USDC Bank Account', usdcBankAccount.toBase58());

  console.log('SOL Bank Account', solBankAccount.toBase58());
  it('Test Init User', async () => {
    const initUserTx = await program.methods
      .initUser()
      .accounts({
        signer: signer.publicKey,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Create User Account', initUserTx);
    const [userPda] = PublicKey.findProgramAddressSync(
      [signer.publicKey.toBuffer()],
      program.programId
    );
    
    // Fetch the account using the PDA.
    const userAccount = await program.account.user.fetch(userPda);
    console.log('Fetched User Account:', userAccount);
  
    // Assert that the user account exists (and optionally verify fields).
    assert.exists(userAccount, "User account should exist");
    assert.strictEqual(
      userAccount.owner.toBase58(),
      signer.publicKey.toBase58(),
      "User account owner should match the signer"
    );
    const defaultPubkey = new PublicKey("11111111111111111111111111111111");
    userAccount.balances.forEach((balance: any, index: number) => {
      assert.strictEqual(
        balance.bankAddress.toBase58(),
        defaultPubkey.toBase58(),
        `Balance ${index} should be empty (default bank address)`
      );
      assert.strictEqual(
        balance.lastUpdatedDeposit.toNumber(),
        0,
        "User account lastUpdatedDeposit should be 0 initially"
      );
    });
    
  });

  it('Test Init and Fund USDC Bank', async () => {
    const initUSDCBankTx = await program.methods
      .initBank(1.2,0.8,USDC_PRICE_FEED_ID,"USDC")
      .accounts({
        signer: signer.publicKey,
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Create USDC Bank Account', initUSDCBankTx);
    const bankAccountInfo = await provider.connection.getAccountInfo(usdcBankAccount);
    assert.exists(bankAccountInfo, "USDC bank account should exist");
  
    // Verify that the account is a parsed token account with correct data.
    const data: RawAccount = AccountLayout.decode(bankAccountInfo.data)
    assert.exists(data, " account data should exist");
  
  
    // Assert the bank account is associated with the correct mint.
    assert.strictEqual(
      data.mint.toBase58(),
      mintUSDC.toBase58(),
      "Bank account should be associated with the correct mint"
    );
  
    const amount = 10_000 * 10 ** 9;
    const mintTx = await mintTo(
      // @ts-ignores
      banksClient,
      signer,
      mintUSDC,
      usdcBankAccount,
      signer,
      amount
    );

    console.log('Mint to USDC Bank Signature:', mintTx);
    const usdcTokenAccountBalance = await getTokenBalance(
      provider,usdcBankAccount
    );
    // The balance is returned as a string; compare with the expected amount.
    assert.strictEqual(
      usdcTokenAccountBalance!,
      amount,
      "USDC bank treasury account should have the minted amount"
    );
  
  });

  it('Test Init amd Fund SOL Bank', async () => {
    const initSOLBankTx = await program.methods
      .initBank(1.2, 0.8,SOL_PRICE_FEED_ID,"SOL")
      .accounts({
        signer: signer.publicKey,
        mint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Create SOL Bank Account', initSOLBankTx);

    const amount = 10_000 * 10 ** 9;
    const mintSOLTx = await mintTo(
      // @ts-ignores
      banksClient,
      signer,
      mintSOL,
      solBankAccount,
      signer,
      amount
    );

    console.log('Mint to SOL Bank Signature:', mintSOLTx);
  });

  it('Create and Fund Token Account', async () => {
    const USDCTokenAccount = await createAccount(
      // @ts-ignores
      banksClient,
      signer,
      mintUSDC,
      signer.publicKey
    );

    console.log('USDC Token Account Created:', USDCTokenAccount);
    const usdcTokenAccountInfo = await provider.connection.getAccountInfo(USDCTokenAccount);
    assert.exists(usdcTokenAccountInfo, "USDC token account should exist");
    
  
    const amount = 10_000 * 10 ** 9;
    const mintUSDCTx = await mintTo(
      // @ts-ignores
      banksClient,
      signer,
      mintUSDC,
      USDCTokenAccount,
      signer,
      amount
    );

    console.log('Mint to USDC Bank Signature:', mintUSDCTx);
    const usdcTokenAccountBalance = await getTokenBalance(provider, USDCTokenAccount);
  console.log('USDC Token Account Balance:', usdcTokenAccountBalance);
  assert.strictEqual(
    usdcTokenAccountBalance,
    amount,
    "Token account balance should equal minted amount"
  );
  });

  it('Test Deposit', async () => {
    const usdcDepositAmount = new BN(1000);
    const depositUSDC = await program.methods
      .deposit(usdcDepositAmount)
      .accounts({
        signer: signer.publicKey,
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Deposit USDC', depositUSDC);
  
    const [usdcBankPda] = PublicKey.findProgramAddressSync(
      [mintUSDC.toBuffer()],
      program.programId
    );
    const [usdcUserPda] = PublicKey.findProgramAddressSync(
      [signer.publicKey.toBuffer()],
      program.programId
    );
    
    let usdcBankAccountInfo = await program.account.bank.fetch(usdcBankPda);
    console.log('Fetched Bank Account:', usdcBankAccountInfo);
    // Verify that the account is a parsed token account with correct data.
    
    assert.strictEqual(
      usdcBankAccountInfo.totalDeposits.toNumber(),
      usdcDepositAmount.toNumber(),
      "Bank total deposits should equal the deposit amount"
    );
    assert.strictEqual(
      usdcBankAccountInfo.totalDeposits.toNumber(),
      usdcDepositAmount.toNumber(),
      "Bank total deposit shares should equal the deposit amount"
    );
     
     const depositUSDCTwo = await program.methods
      .deposit(usdcDepositAmount)
      .accounts({
        signer: signer.publicKey,
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });
      console.log('Deposit USDC 2', depositUSDCTwo);
       usdcBankAccountInfo = await program.account.bank.fetch(usdcBankPda);
       let userAccountInfo = await program.account.user.fetch(usdcUserPda);
      console.log('Fetched Bank Account:', usdcBankAccountInfo);
      console.log('Fetched User Account:', userAccountInfo);
      const matchingBalances = userAccountInfo.balances.filter(
        (balance: any) =>
          balance.bankAddress.toBase58() === usdcBankPda.toBase58()
      );
      assert.strictEqual(
        matchingBalances.length,
        1,
        "There should be exactly one balance with the matching bank address"
      );
      const userUsdcBalance = matchingBalances[0];
      // Verify that the account is a parsed token account with correct data.
      const expectedDeposited = usdcDepositAmount.toNumber() * 2;

      assert.strictEqual(
        usdcBankAccountInfo.totalDeposits.toNumber(),
        usdcDepositAmount.toNumber()*2,
        "Bank total deposits should equal the deposit amount"
      );
      assert.strictEqual(
        usdcBankAccountInfo.totalDeposits.toNumber(),
        expectedDeposited,
        "Bank total deposit shares should equal the deposit amount"
      );
      assert.strictEqual(
        userUsdcBalance.deposited.toNumber(),
        expectedDeposited,
        "User account total deposits should equal the sum of deposits"
      );
      assert.strictEqual(
        userUsdcBalance.depositedShares.toNumber(),
        expectedDeposited, // adjust this if your share calculation is different
        "User balance's deposited shares should equal the expected value"
      );
      assert.isAbove(
        userUsdcBalance.lastUpdatedDeposit.toNumber(),
        1742372659,
        "User balance's last updated deposit timestamp should be greater than zero"
      );
  });

  it('Test Borrow', async () => {
    const borrowSOL = await program.methods
      .borrow(new BN(1))
      .accounts({
        signer: signer.publicKey,
        collateralMint: mintUSDC,
        borrowMint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
        priceUpdate: solUsdPriceFeedAccount,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Borrow SOL', borrowSOL);
  });

  it('Test Repay', async () => {
    const repaySOL = await program.methods
      .repay(new BN(1))
      .accounts({
        signer: signer.publicKey,
        mint: mintSOL,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Repay SOL', repaySOL);
  });

  it('Test Withdraw', async () => {
    const withdrawUSDC = await program.methods
      .withdraw(new BN(100))
      .accounts({
        signer: signer.publicKey,
        mint: mintUSDC,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .rpc({ commitment: 'confirmed' });

    console.log('Withdraw USDC', withdrawUSDC);
  });
});