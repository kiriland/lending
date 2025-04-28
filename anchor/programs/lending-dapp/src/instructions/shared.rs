use std::f64::consts::E;

use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

pub fn transfer_tokens<'info>(
    from: &InterfaceAccount<'info, TokenAccount>,
    to: &InterfaceAccount<'info, TokenAccount>,
    amount: &u64,
    mint: &InterfaceAccount<'info, Mint>,
    authority: &Signer<'info>,
    token_program: &Interface<'info, TokenInterface>,
) -> Result<()> {
    let transfer_accounts_options = TransferChecked {
        from: from.to_account_info(),
        to: to.to_account_info(),
        mint: mint.to_account_info(),
        authority: authority.to_account_info(),
    };
    let cpi_context = CpiContext::new(token_program.to_account_info(), transfer_accounts_options);

    transfer_checked(cpi_context, *amount, mint.decimals)
}

pub fn calculate_accrued_interest(
    deposited: u64,
    interest_rate: f64,
    last_updated: i64,
) -> Result<u64> {
    let seconds_per_hour = 60.0 * 60.0;
    let per_second_rate = (interest_rate) / seconds_per_hour;
    let current_time = Clock::get()?.unix_timestamp;
    let time_elapsed = current_time - last_updated;
    let new_value = (deposited as f64 * E.powf(per_second_rate * time_elapsed as f64)) as u64;

    Ok(new_value)
}
