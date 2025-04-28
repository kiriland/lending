use std::f64::consts::E;

use crate::{Bank, User};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::error::ErrorCode;

use super::calculate_accrued_interest;
use super::transfer_tokens;

#[derive(Accounts)]
pub struct Repay<'info> {
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
pub fn process_repay(context: Context<Repay>, amount: u64) -> Result<()> {
    let user = &mut context.accounts.user_account;
    let bank_address = &context.accounts.bank.key();
    let bank = &mut context.accounts.bank;

    let balance = user.get_balance(bank_address).unwrap();
    let borrowed_value = balance.borrowed;
    let last_updated_borrow = balance.last_updated_borrow;

    bank.total_borrowed =
        calculate_accrued_interest(bank.total_borrowed, bank.interest_rate, last_updated_borrow)?;

    let value_per_share = bank.total_borrowed as f64 / bank.total_borrowed_shares as f64;
    let amount_to_repay = borrowed_value as f64 / value_per_share as f64;
    if amount as f64 > amount_to_repay {
        return Err(ErrorCode::OverRepayableAmount.into());
    }
    transfer_tokens(
        &context.accounts.user_token_account,
        &context.accounts.bank_token_account,
        &amount,
        &context.accounts.mint,
        &context.accounts.signer,
        &context.accounts.token_program,
    )?;
    let borrow_ratio = amount as f64 / (bank.total_borrowed) as f64;
    let user_shares = bank.total_borrowed_shares as f64 * borrow_ratio as f64;
    balance.borrowed -= amount as u64;
    balance.borrowed_shares -= user_shares as u64;
    bank.total_borrowed -= amount as u64;
    bank.total_borrowed_shares -= user_shares as u64;
    Ok(())
}
