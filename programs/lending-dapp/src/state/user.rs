use crate::error::ErrorCode;
use anchor_lang::prelude::*;
#[derive(AnchorSerialize, InitSpace, AnchorDeserialize, Clone, Copy, Default)]
pub struct Balance {
    pub token_mint_address: Pubkey,
    pub deposited: u64,
    pub deposited_shares: u64,
    pub borrowed: u64,
    pub borrowed_shares: u64,
}
pub const MAX_TOKEN_BALANCES: usize = 3;
#[account]
#[derive(InitSpace)]
pub struct User {
    pub owner: Pubkey,

    pub balances: [Balance; MAX_TOKEN_BALANCES],

    pub last_updated_deposit: i64,
    pub last_updated_borrow: i64,
}
impl User {
    pub fn get_balance(&mut self, token_mint_address: &Pubkey) -> Option<&mut Balance> {
        self.balances
            .iter_mut()
            .find(|balance| balance.token_mint_address.eq(token_mint_address))
    }
    pub fn get_balance_or_create(&mut self, token_mint_address: &Pubkey) -> Result<&mut Balance> {
        let mut empty_balance: Option<&mut Balance> = None;
        for balance in &mut self.balances {
            if balance.token_mint_address == *token_mint_address {
                return Ok(balance);
            }
            if empty_balance.is_none() && balance.token_mint_address == Pubkey::default() {
                empty_balance = Some(balance);
            }
        }
        let balance = empty_balance.ok_or(ErrorCode::NoEmptyBalance)?;
        balance.token_mint_address = *token_mint_address;
        Ok(balance)
    }
    pub fn get_first_empty_balance(&mut self) -> Option<&mut Balance> {
        self.balances
            .iter_mut()
            .find(|balance| balance.token_mint_address == Pubkey::default())
    }
}
impl Balance {
    pub fn change_deposited_shares(&mut self, delta: u64) -> Result<()> {
        let deposited_shares: u64 = self.deposited_shares.into();
        self.deposited_shares = deposited_shares
            .checked_add(delta)
            .ok_or(ErrorCode::Overflow)?;
        Ok(())
    }
}
