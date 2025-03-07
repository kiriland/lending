use std::f64::consts::E;

use crate::{Bank, User};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::error::ErrorCode;

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
    let bank = &mut context.accounts.bank;
    let borrowed_value: u64;
    match context.accounts.mint.to_account_info().key() {
        key if key == user.usdc_address => {
            borrowed_value = user.borrowed_usdc;
        }
        _ => {
            borrowed_value = user.borrowed_sol;
        }
    }
    let time_diff = user.last_updated_borrow - Clock::get()?.unix_timestamp;
    bank.total_borrowed +=
        (bank.total_borrowed as f64 * E.powf(bank.interest_rate as f64 * time_diff as f64)) as u64;
    let value_per_share = bank.total_borrowed as f64 / bank.total_borrowed_shares as f64;
    let amount_to_repay = borrowed_value / value_per_share as u64;
    if amount > amount_to_repay {
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
    let borrow_ratio = amount.checked_div(bank.total_borrowed).unwrap();
    let user_shares = bank
        .total_borrowed_shares
        .checked_mul(borrow_ratio)
        .unwrap();
    match context.accounts.mint.to_account_info().key() {
        key if key == user.usdc_address => {
            user.borrowed_usdc -= amount;
            user.borrowed_usdc_shares -= user_shares;
        }
        _ => {
            user.borrowed_sol -= amount;
            user.borrowed_sol_shares -= user_shares;
        }
    }
    bank.total_borrowed -= amount;
    bank.total_borrowed_shares -= user_shares;
    Ok(())
}
