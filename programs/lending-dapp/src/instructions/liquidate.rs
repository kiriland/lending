use crate::error::ErrorCode;
use crate::{Bank, User, MAX_AGE, SOL_USD_FEED_ID, USDC_USD_FEED_ID};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked},
};
use pyth_solana_receiver_sdk::price_update::{get_feed_id_from_hex, PriceUpdateV2};

use super::{calculate_accrued_interest, transfer_tokens};

#[derive(Accounts)]
pub struct Liquidate<'info> {
    #[account(mut)]
    pub liquidator: Signer<'info>,
    pub price_update: Account<'info, PriceUpdateV2>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub borrowed_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        seeds = [collateral_mint.key().as_ref()],
        bump,
    )]
    pub collateral_bank: Account<'info, Bank>,
    #[account(
    mut,
    seeds = [borrowed_mint.key().as_ref()],
    bump,
    )]
    pub borrowed_bank: Account<'info, Bank>,
    #[account(
        mut,
        seeds = [b"treasury", collateral_mint.key().as_ref()],
        bump,
    )]
    pub collateral_bank_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"treasury", borrowed_mint.key().as_ref()],
        bump,
    )]
    pub borrowed_bank_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [liquidator.key().as_ref()],
        bump,
    )]
    pub liquidator_account: Account<'info, User>,
    #[account(
        mut,
        associated_token::mint = collateral_mint,
        associated_token::authority = liquidator,
        associated_token::token_program = token_program,
    )]
    pub liquidator_collateral_token_account: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = borrowed_mint,
        associated_token::authority = liquidator,
        associated_token::token_program = token_program,
    )]
    pub liquidator_borrowed_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

pub fn process_liquidate(context: Context<Liquidate>) -> Result<()> {
    let collateral_bank = &mut context.accounts.collateral_bank;
    let borrowed_bank = &mut context.accounts.borrowed_bank;
    let liquidator_account = &mut context.accounts.liquidator_account;
    let price_update = &mut context.accounts.price_update;
    let sol_feed_id = get_feed_id_from_hex(SOL_USD_FEED_ID)?;
    let sol_price = price_update.get_price_no_older_than(&Clock::get()?, MAX_AGE, &sol_feed_id)?;
    let usdc_feed_id = get_feed_id_from_hex(USDC_USD_FEED_ID)?;
    let usdc_price =
        price_update.get_price_no_older_than(&Clock::get()?, MAX_AGE, &usdc_feed_id)?;
    let usdt_feed_id = get_feed_id_from_hex(USDC_USD_FEED_ID)?;
    let usdt_price =
        price_update.get_price_no_older_than(&Clock::get()?, MAX_AGE, &usdt_feed_id)?;
    let total_collateral: u64;
    let total_borrowed: u64;
    let collateral_mint = context.accounts.collateral_mint.to_account_info().key();
    let borrowed_mint = context.accounts.borrowed_mint.to_account_info().key();
    let collateral_mint_key_str = collateral_mint.to_string();
    match collateral_mint_key_str.get(0..2) {
        Some("dc") => {
            let new_usdc = calculate_accrued_interest(
                liquidator_account
                    .get_balance(&collateral_mint)
                    .unwrap()
                    .deposited,
                collateral_bank.interest_rate,
                liquidator_account.last_updated_deposit,
            )?;
            total_collateral = usdc_price.price as u64 * new_usdc;
            let new_sol = calculate_accrued_interest(
                liquidator_account
                    .get_balance(&borrowed_mint)
                    .unwrap()
                    .borrowed,
                borrowed_bank.interest_rate,
                liquidator_account.last_updated_borrow,
            )?;
            total_borrowed = sol_price.price as u64 * new_sol;
        }
        Some("ol") => {
            let new_sol = calculate_accrued_interest(
                liquidator_account
                    .get_balance(&collateral_mint)
                    .unwrap()
                    .deposited,
                collateral_bank.interest_rate,
                liquidator_account.last_updated_deposit,
            )?;
            total_collateral = sol_price.price as u64 * new_sol;
            let new_usdc = calculate_accrued_interest(
                liquidator_account
                    .get_balance(&borrowed_mint)
                    .unwrap()
                    .borrowed,
                borrowed_bank.interest_rate,
                liquidator_account.last_updated_borrow,
            )?;
            total_borrowed = usdc_price.price as u64 * new_usdc;
        }
        Some("dt") => {
            let new_usdt = calculate_accrued_interest(
                liquidator_account
                    .get_balance(&collateral_mint)
                    .unwrap()
                    .deposited,
                collateral_bank.interest_rate,
                liquidator_account.last_updated_deposit,
            )?;
            total_collateral = usdt_price.price as u64 * new_usdt;

            let new_sol = calculate_accrued_interest(
                liquidator_account
                    .get_balance(&borrowed_mint)
                    .unwrap()
                    .borrowed,
                borrowed_bank.interest_rate,
                liquidator_account.last_updated_borrow,
            )?;
            total_borrowed = sol_price.price as u64 * new_sol;
        }
        _ => return Err(ErrorCode::InvalidCollateralMint.into()),
    }
    let health_factor = total_collateral as f64 * collateral_bank.liquidation_threshold as f64
        / total_borrowed as f64;
    if health_factor >= 1.0 {
        return Err(ErrorCode::NotUnderCollateralized.into());
    }
    let liquidation_amount = total_borrowed
        .checked_mul(borrowed_bank.close_factor)
        .unwrap();
    transfer_tokens(
        &context.accounts.liquidator_borrowed_token_account,
        &context.accounts.borrowed_bank_token_account,
        &liquidation_amount,
        &context.accounts.borrowed_mint,
        &context.accounts.liquidator,
        &context.accounts.token_program,
    )?;
    let liquidator_returned_amount = liquidation_amount
        .checked_mul(collateral_bank.liquidation_bonus)
        .unwrap()
        .checked_add(liquidation_amount)
        .unwrap();

    let seeds = &[
        b"treasury",
        context
            .accounts
            .collateral_mint
            .to_account_info()
            .key
            .as_ref(),
        &[context.bumps.collateral_bank_token_account],
    ];
    let signer_seeds = [&seeds[..]];
    let accounts = TransferChecked {
        from: context
            .accounts
            .collateral_bank_token_account
            .to_account_info(),
        to: context
            .accounts
            .liquidator_collateral_token_account
            .to_account_info(),
        mint: context.accounts.collateral_mint.to_account_info(),
        authority: context
            .accounts
            .collateral_bank_token_account
            .to_account_info(),
    };
    let cpi_context = CpiContext::new_with_signer(
        context
            .accounts
            .collateral_bank_token_account
            .to_account_info(),
        accounts,
        &signer_seeds,
    );
    transfer_checked(
        cpi_context,
        liquidator_returned_amount,
        context.accounts.collateral_mint.decimals,
    )?;
    Ok(())
}
