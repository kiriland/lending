use anchor_lang::prelude::*;

use crate::error::ErrorCode;
use crate::{user, Bank, User, ANCHOR_DISCRIMINATOR};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_interface::{
    close_account, transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};
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
        init_if_needed,
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
#[derive(Accounts)]
pub struct CloseBank<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        close = signer,
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
        bump
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

pub fn process_init_bank(
    context: Context<InitBank>,
    liquidation_threshold: f64,
    max_ltv: f64,
    oracle_feed_id_hex: &str,
    ticker_symbol: String,
) -> Result<()> {
    let bank = &mut context.accounts.bank;
    bank.authority = context.accounts.signer.key();
    bank.token_mint_address = context.accounts.mint.key();
    bank.liquidation_threshold = liquidation_threshold;
    bank.max_ltv = max_ltv;
    bank.interest_rate = 0.05;
    bank.config.oracle_feed_id = get_feed_id_from_hex(oracle_feed_id_hex)?;
    bank.config.ticker_symbol = ticker_symbol;
    Ok(())
}

pub fn process_init_user(context: Context<InitUser>) -> Result<()> {
    let user_account = &mut context.accounts.user_account;
    user_account.owner = context.accounts.signer.key();
    Ok(())
}
pub fn process_close_bank(context: Context<CloseBank>) -> Result<()> {
    if context.accounts.bank.authority != context.accounts.signer.key() {
        return Err(ErrorCode::Unauthorized.into());
    }
    let user = &mut context.accounts.user_account;
    let balance = user.get_balance(&context.accounts.bank.key());
    if !balance.is_none() {
        let balance = balance.unwrap();
        let amount_to_be_returned = balance.deposited;
        balance.clear();
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
            amount_to_be_returned,
            context.accounts.mint.decimals,
        )?;
    }

    // let cpi_accounts = anchor_spl::token_interface::CloseAccount {
    //     account: context.accounts.bank_token_account.to_account_info(),
    //     destination: context.accounts.user_token_account.to_account_info(),
    //     authority: context.accounts.bank_token_account.to_account_info(),
    // };
    // let cpi_program = context.accounts.token_program.to_account_info();
    // let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, &signer_seeds);

    // // Call the close_account CPI function.
    // close_account(cpi_ctx)?;

    Ok(())
}
