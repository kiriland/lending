use core::borrow;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::{Bank, User, MAX_AGE};

use crate::error::ErrorCode;

use super::calculate_accrued_interest;

#[derive(Accounts)]
pub struct Borrow<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub borrow_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [borrow_mint.key().as_ref()],
        bump,
    )]
    pub borrow_bank: Account<'info, Bank>,
    #[account(
        mut,
        seeds = [b"treasury", borrow_mint.key().as_ref()],
        bump,
    )]
    pub bank_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [signer.key().as_ref()],
        bump,
    )]
    pub user_account: Account<'info, User>,
    #[account(
        mut,
        seeds = [collateral_mint.key().as_ref()],
        bump,
    )]
    pub collateral_bank: Account<'info, Bank>,
    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = borrow_mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    pub collateral_price_update: Account<'info, PriceUpdateV2>,
    pub borrow_price_update: Account<'info, PriceUpdateV2>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn process_borrow(context: Context<Borrow>, amount: u64) -> Result<()> {
    let borrow_bank = &mut context.accounts.borrow_bank;
    let user = &mut context.accounts.user_account;
    let now = Clock::get()?;
    let decimals = context.accounts.borrow_mint.decimals as u64;
    
    let time_elapsed: i64 = now.unix_timestamp - borrow_bank.last_updated_borrow;
    if time_elapsed > 0 {
        let interest = calculate_accrued_interest(
            borrow_bank.total_borrowed,
            borrow_bank.interest_rate,
            borrow_bank.last_updated_borrow,
        )?;
        borrow_bank.total_borrowed = borrow_bank
            .total_borrowed
            .checked_add(interest)
            .ok_or(ErrorCode::Overflow)?;
        borrow_bank.last_updated_borrow = now.unix_timestamp;
    }

    let collateral_bank = &context.accounts.collateral_bank;
    let collateral_balance = user
        .balances
        .iter()
        .find(|b| b.bank_address == collateral_bank.key())
        .ok_or(ErrorCode::InsufficientFunds)?;
    let collateral_feed_id = collateral_bank.config.oracle_feed_id;
    let collateral_price = context.accounts.collateral_price_update.get_price_no_older_than(&now, MAX_AGE, &collateral_feed_id)?.price as u128;
    let updated_collateral = calculate_accrued_interest(
        collateral_balance.deposited,
        collateral_bank.interest_rate,
        collateral_balance.last_updated_deposit,
    )?;
    let collateral_value_usd = updated_collateral as u128 * collateral_price;

    let borrow_feed_id = borrow_bank.config.oracle_feed_id;
    let borrow_price = context.accounts.borrow_price_update.get_price_no_older_than(&now, MAX_AGE, &borrow_feed_id)?.price as u128;
    let borrow_value_usd = amount as u128 * borrow_price;
    
    let allowed_borrow = (collateral_value_usd * borrow_bank.max_ltv as u128) ;
    
    if borrow_value_usd > allowed_borrow {
        return Err(ErrorCode::OverBorrowableAmount.into());
    }
    let share_price = if borrow_bank.total_borrowed_shares == 0 {
        decimals 
    } else {
        ((borrow_bank.total_borrowed as u128 * decimals as u128) / borrow_bank.total_borrowed_shares as u128) as u64
    };

    let shares_to_mint = amount as u128 * decimals as u128 / share_price as u128;
    let seeds = &[
        b"treasury",
        context.accounts.borrow_mint.to_account_info().key.as_ref(),
        &[context.bumps.bank_token_account],
    ];
    let signer_seeds = [&seeds[..]];
    let accounts = TransferChecked {
        from: context.accounts.bank_token_account.to_account_info(),
        to: context.accounts.user_token_account.to_account_info(),
        mint: context.accounts.borrow_mint.to_account_info(),
        authority: context.accounts.bank_token_account.to_account_info(),
    };
    let cpi_context = CpiContext::new_with_signer(
        context.accounts.token_program.to_account_info(),
        accounts,
        &signer_seeds,
    );
    transfer_checked(cpi_context, amount, context.accounts.borrow_mint.decimals)?;

    borrow_bank.total_borrowed = borrow_bank
    .total_borrowed
    .checked_add(amount)
    .ok_or(ErrorCode::Overflow)?;

borrow_bank.total_borrowed_shares = borrow_bank
    .total_borrowed_shares
    .checked_add(shares_to_mint as u64)
    .ok_or(ErrorCode::Overflow)?;


    let balance = user.get_balance_or_create(&borrow_bank.key())?;
    balance.borrowed += amount;
    balance.borrowed_shares += shares_to_mint as u64;
    balance.last_updated_borrow = now.unix_timestamp;

    Ok(())
}
