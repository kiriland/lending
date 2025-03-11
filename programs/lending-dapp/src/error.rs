use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Insufficient Funds")]
    InsufficientFunds,
    #[msg("Over Borrowable Amount")]
    OverBorrowableAmount,
    #[msg("Over Repayable Amount")]
    OverRepayableAmount,
    #[msg("Not Under Collateralized, liquidation not possible")]
    NotUnderCollateralized,
    #[msg("Overflow")]
    Overflow,
    #[msg("No Empty Balance")]
    NoEmptyBalance,
    #[msg("Invalid Token Mint Address")]
    InvalidCollateralMint,
}
