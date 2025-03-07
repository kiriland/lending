use anchor_lang::prelude::*;
use anchor_spl::{associated_token::AssociatedToken, token_interface::{Mint, TokenAccount, TokenInterface}};

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

    if bank.total_deposits == 0 {
        bank.total_deposits = amount;
        bank.total_deposits_shares = amount;
    } 
    let deposit_ratio = amount.checked_div(bank.total_deposits).unwrap();
    let user_shares = bank.total_deposits_shares.checked_mul(deposit_ratio).unwrap();

    let user = &mut context.accounts.user_account;

    match context.accounts.mint.to_account_info().key() {
        key if key == user.usdc_address => {
            user.deposited_usdc = amount;
            user.deposited_usdc_shares = user_shares;
        }
        _ => {
            user.deposited_sol = amount;
            user.deposited_sol_shares = user_shares;
        }
    }
    bank.total_deposits += amount;
    bank.total_deposits_shares += user_shares;

    user.last_updated_deposit = Clock::get()?.unix_timestamp;
    Ok(())
}