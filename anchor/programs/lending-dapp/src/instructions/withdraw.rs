use std::f64::consts::E;

use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface,TransferChecked, transfer_checked},
};

use crate::{Bank, User};
use crate::error::ErrorCode;

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [mint.key().as_ref()],
        bump,
    )]
    pub bank: Account<'info, Bank>,

    mint: InterfaceAccount<'info, Mint>,
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
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program, 
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn process_withdraw(
    context: Context<Withdraw>,
    amount: u64,
) -> Result<()> {
    let user = &mut context.accounts.user_account;
    let bank_address = &context.accounts.bank.key();
    let bank = &mut context.accounts.bank;
    let decimals = context.accounts.mint.decimals;
    let balance = user
        .get_balance(bank_address)
        .unwrap();
    let last_updated_deposit = balance.last_updated_deposit;
    let deposited_value = balance.deposited;
    let time_diff = last_updated_deposit - Clock::get()?.unix_timestamp;
    
    let share_price = bank.total_deposits
    .checked_mul(decimals as u64)
    .unwrap()
    .checked_div(bank.total_deposits_shares)
    .unwrap();

    let shares_to_burn = amount
        .checked_mul(decimals as u64)
        .unwrap()
        .checked_div(share_price as u64)
        .unwrap();
    require!(balance.deposited_shares >= shares_to_burn, ErrorCode::InsufficientFunds);

    let seeds = &[
        b"treasury",
        context.accounts.mint.to_account_info().key.as_ref(),
        &[context.bumps.bank_token_account],
    ];
    let signer_seeds = [&seeds[..]];
    let accounts = TransferChecked {
        from: context.accounts.bank_token_account.to_account_info(),
        to: context.accounts.user_token_account.to_account_info(),
        mint: context.accounts.mint.to_account_info(),
        authority: context.accounts.bank_token_account.to_account_info(),
    };
    let cpi_context = CpiContext::new_with_signer(
        context.accounts.token_program.to_account_info(),
        accounts,
        &signer_seeds,
    );
    transfer_checked(
        cpi_context,
        amount,
        context.accounts.mint.decimals,
    )?;


    
    balance.deposited -= amount;
    balance.deposited_shares -= shares_to_burn as u64;
    

    bank.total_deposits -= amount;
    bank.total_deposits_shares -= shares_to_burn as u64;
    Ok(())
}

