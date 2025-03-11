use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use crate::{Bank, User, MAX_AGE, SOL_USD_FEED_ID, USDC_USD_FEED_ID};

use crate::error::ErrorCode;

use super::calculate_accrued_interest;

#[derive(Accounts)]
pub struct Borrow<'info> {
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
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = signer,
        associated_token::token_program = token_program,
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,
    pub price_update: Account<'info, PriceUpdateV2>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn process_borrow(context: Context<Borrow>, amount: u64) -> Result<()> {
    let bank = &mut context.accounts.bank;
    let user = &mut context.accounts.user_account;

    let price_update = &mut context.accounts.price_update;

    let total_collateral: u64;

    // Assuming that the first two characters of the mint address are DC for USDC, OL for SOL, and DT for USDT
    match bank.config.ticker_symbol.as_str() {
        "SOL" => {
            let usdc_balance = user
                .balances
                .iter_mut()
                .find(|balance| balance.token_mint_address.to_string().as_str() == "USDC")
                .unwrap();
            let usdc_feed_id = get_feed_id_from_hex(USDC_USD_FEED_ID)?;
            let usdc_price =
                price_update.get_price_no_older_than(&Clock::get()?, MAX_AGE, &usdc_feed_id)?;
            let new_value = calculate_accrued_interest(
                usdc_balance.deposited,
                bank.interest_rate,
                user.last_updated_deposit,
            )?;
            total_collateral = usdc_price.price as u64 * new_value;
        }
        // Works for USDC and USDT. Constrain: SOL can only be borrowed with USDC collateral, and everything else can only be borrowed with SOL collateral
        _ => {
            let sol_balance = user
                .balances
                .iter_mut()
                .find(|balance| balance.token_mint_address.to_string().as_str() == "SOL")
                .unwrap();
            let sol_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
            let sol_price =
                price_update.get_price_no_older_than(&Clock::get()?, MAX_AGE, &sol_feed_id)?;
            let new_value = calculate_accrued_interest(
                sol_balance.deposited,
                bank.interest_rate,
                user.last_updated_deposit,
            )?;
            total_collateral = sol_price.price as u64 * new_value;
        }
    }
    let borrowable_amount = total_collateral
        .checked_mul(bank.liquidation_threshold)
        .unwrap();
    if borrowable_amount < amount {
        return Err(ErrorCode::OverBorrowableAmount.into());
    }
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
    transfer_checked(cpi_context, amount, context.accounts.mint.decimals)?;

    if bank.total_borrowed == 0 {
        bank.total_borrowed = amount;
        bank.total_borrowed_shares = amount;
    }
    let borrow_ratio = amount.checked_div(bank.total_borrowed).unwrap();
    let user_shares = bank
        .total_borrowed_shares
        .checked_mul(borrow_ratio)
        .unwrap();

    let balance = user
        .get_balance(&context.accounts.mint.to_account_info().key())
        .unwrap();
    balance.borrowed = amount;
    balance.borrowed_shares = user_shares as u64;

    user.last_updated_borrow = Clock::get()?.unix_timestamp;
    Ok(())
}
