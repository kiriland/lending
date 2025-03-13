use crate::error::ErrorCode;
use anchor_lang::prelude::*;
#[derive(AnchorSerialize, InitSpace, AnchorDeserialize, Clone, Copy, Default)]
pub struct Balance {
    pub bank_address: Pubkey,
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
    pub fn get_balance(&mut self, bank_address: &Pubkey) -> Option<&mut Balance> {
        self.balances
            .iter_mut()
            .find(|balance| balance.bank_address == *bank_address)
    }
    pub fn get_balance_or_create(&mut self, bank_address: &Pubkey) -> Result<&mut Balance> {
        let mut empty_balance: Option<&mut Balance> = None;
        for balance in &mut self.balances {
            if balance.bank_address == *bank_address {
                return Ok(balance);
            }
            if empty_balance.is_none() && balance.bank_address == Pubkey::default() {
                empty_balance = Some(balance);
            }
        }
        let balance = empty_balance.ok_or(ErrorCode::NoEmptyBalance)?;
        balance.bank_address = *bank_address;
        Ok(balance)
    }
    pub fn get_first_empty_balance(&mut self) -> Option<&mut Balance> {
        self.balances
            .iter_mut()
            .find(|balance| balance.bank_address == Pubkey::default())
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
    pub fn empty() -> Self {
        Self {
            bank_address: Pubkey::default(),
            deposited: 0,
            deposited_shares: 0,
            borrowed: 0,
            borrowed_shares: 0,
        }
    }
    pub fn clear(&mut self) {
        *self = Self::empty();
    }
}
