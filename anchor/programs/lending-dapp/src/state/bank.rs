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
    pub liquidation_threshold: f64,
    pub liquidation_bonus: u64,
    pub close_factor: u64,
    pub max_ltv: f64,
    pub last_updated_borrow: i64,
    pub interest_rate: f64,
    pub config: BankConfig,
}

#[derive(AnchorSerialize, InitSpace, AnchorDeserialize, Clone)]
pub struct BankConfig {
    pub oracle_feed_id: [u8; 32],
    #[max_len(5)]
    pub ticker_symbol: String,
}
impl Default for BankConfig {
    fn default() -> Self {
        Self {
            oracle_feed_id: [0; 32],
            ticker_symbol: String::default(),
        }
    }
}
