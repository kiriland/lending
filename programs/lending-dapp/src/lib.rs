#![allow(unexpected_cfgs)]

pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("DL4w1JEu213nsJZbL8Ap91j4k28zP5LDjH6rHDyUGaXi");

#[program]
pub mod lending_dapp {
    use super::*;

    pub fn init_bank(
        context: Context<InitBank>,
        liquidation_threshold: u64,
        max_ltv: u64,
    ) -> Result<()> {
        instructions::admin::process_init_bank(context, liquidation_threshold, max_ltv)
    }
    pub fn init_user(context: Context<InitUser>, usdc_address: Pubkey) -> Result<()> {
        instructions::admin::process_init_user(context, usdc_address)
    }
    pub fn deposit(context: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::process_deposit(context, amount)
    }
    pub fn withdraw(context: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::withdraw::process_withdraw(context, amount)
    }
    pub fn borrow(context: Context<Borrow>, amount: u64) -> Result<()> {
        instructions::borrow::process_borrow(context, amount)
    }
    pub fn repay(context: Context<Repay>, amount: u64) -> Result<()> {
        instructions::repay::process_repay(context, amount)
    }
    pub fn liquidate(context: Context<Liquidate>) -> Result<()> {
        instructions::liquidate::process_liquidate(context)
    }
}
