use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Bank {
    pub authority: Pubkey,
    pub token_mint_address: Pubkey,
    pub total_deposits: u64,
    pub total_deposits_shares: u64,

    pub total_borrowed: u64,
    pub total_borrowed_shares: u64,
    pub liquidation_threshold: u64,
    pub liquidation_bonus: u64,
    pub close_factor: u64,
    pub max_ltv: u64,
    pub last_updated: i64,
    pub interest_rate: u64,
}
