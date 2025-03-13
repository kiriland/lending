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

    if bank.total_deposits == 0 {
        bank.total_deposits = amount;
        bank.total_deposits_shares = amount;
        let balance = user
        .get_balance_or_create(&bank.key())
        .unwrap();
        balance.bank_address = bank.key();
        balance.change_deposited_shares(amount)?;
        balance.deposited += amount;

        user.last_updated_deposit = Clock::get()?.unix_timestamp;
        return Ok(());
    } 
    let deposit_ratio = amount
    .checked_mul(bank.total_deposits_shares)
    .ok_or(ErrorCode::Overflow)?
    .checked_div(bank.total_deposits)
    .ok_or(ErrorCode::InsufficientFunds)?;
let user_shares = deposit_ratio;


bank.total_deposits = bank
    .total_deposits
    .checked_add(amount)
    .ok_or(ErrorCode::Overflow)?;
bank.total_deposits_shares = bank
    .total_deposits_shares
    .checked_add(user_shares)
    .ok_or(ErrorCode::Overflow)?;

let balance = user
    .get_balance_or_create(&bank.key())
    .unwrap();
balance.bank_address = bank.key();
balance.change_deposited_shares(user_shares)?;
balance.deposited = balance.deposited.checked_add(amount).ok_or(ErrorCode::Overflow)?;

user.last_updated_deposit = Clock::get()?.unix_timestamp;
Ok(())

}