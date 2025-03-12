use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{Bank, User, ANCHOR_DISCRIMINATOR};
use pyth_solana_receiver_sdk::price_update::get_feed_id_from_hex;

#[derive(Accounts)]
pub struct InitBank<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR + Bank::INIT_SPACE,
        seeds = [mint.key().as_ref()],
        bump
    )]
    pub bank: Account<'info, Bank>,

    #[account(
        init,
        payer = signer,
        token::mint = mint,
        token::authority = bank_token_account,
        seeds = [b"treasury", mint.key().as_ref()],
        bump,
    )]
    pub bank_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitUser<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init,
        payer = signer,
        space = ANCHOR_DISCRIMINATOR + User::INIT_SPACE,
        seeds = [signer.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, User>,
    pub system_program: Program<'info, System>,
}

pub fn process_init_bank(
    context: Context<InitBank>,
    liquidation_threshold: u64,
    max_ltv: u64,
    oracle_feed_id_hex: &str,
    ticker_symbol: String,
) -> Result<()> {
    let bank = &mut context.accounts.bank;
    bank.authority = context.accounts.signer.key();
    bank.token_mint_address = context.accounts.mint.key();
    bank.liquidation_threshold = liquidation_threshold;
    bank.max_ltv = max_ltv;
    bank.interest_rate = 0.05 as u64;
    bank.config.oracle_feed_id = get_feed_id_from_hex(oracle_feed_id_hex)?;
    bank.config.ticker_symbol = ticker_symbol;
    Ok(())
}

pub fn process_init_user(context: Context<InitUser>) -> Result<()> {
    let user_account = &mut context.accounts.user_account;
    user_account.owner = context.accounts.signer.key();
    Ok(())
}
