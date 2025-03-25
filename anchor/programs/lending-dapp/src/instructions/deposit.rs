use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};
use crate::error::ErrorCode;
use crate::{Bank, User};

use super::transfer_tokens;

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
    )]
    pub bank: Account<'info, Bank>,

    #[account(
        mut,
        seeds = [b"treasury", mint.key().as_ref()],
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
        associated_token::mint = mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program, 
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn process_deposit(
    context: Context<Deposit>,
    amount: u64,
) -> Result<()> {
    transfer_tokens(
        &context.accounts.user_token_account,
        &context.accounts.bank_token_account,
        &amount,
        &context.accounts.mint,
        &context.accounts.signer,
        &context.accounts.token_program,
    )?;

    let bank = &mut context.accounts.bank;
    let user = &mut context.accounts.user_account;
    let decimals = context.accounts.mint.decimals ;
    
    if bank.total_deposits == 0 {
        bank.total_deposits = amount;
        bank.total_deposits_shares = amount;
        let balance = user
        .get_balance_or_create(&bank.key())
        .unwrap();
        balance.bank_address = bank.key();
        balance.change_deposited_shares(amount)?;
        balance.deposited += amount;

        balance.last_updated_deposit = Clock::get()?.unix_timestamp;
        return Ok(());
    } 
    let share_price = if bank.total_deposits_shares == 0 {
        decimals as u64 // 1.0 in fixed point
    } else {
        bank.total_deposits
            .checked_mul(decimals as u64)
            .unwrap()
            .checked_div(bank.total_deposits_shares)
            .unwrap()
    };
    let shares_to_mint = amount
        .checked_mul(decimals as u64)
        .unwrap()
        .checked_div(share_price)
        .unwrap();

bank.total_deposits = bank
    .total_deposits
    .checked_add(amount)
    .ok_or(ErrorCode::Overflow)?;
bank.total_deposits_shares = bank
    .total_deposits_shares
    .checked_add(shares_to_mint)
    .ok_or(ErrorCode::Overflow)?;

let balance = user
    .get_balance_or_create(&bank.key())
    .unwrap();
balance.bank_address = bank.key();
balance.change_deposited_shares(shares_to_mint)?;
balance.deposited = balance.deposited.checked_add(amount).ok_or(ErrorCode::Overflow)?;

balance.last_updated_deposit = Clock::get()?.unix_timestamp;
Ok(())

}