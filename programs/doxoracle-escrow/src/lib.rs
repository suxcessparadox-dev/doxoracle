use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("5yPoMKGhrfgiU7iJLE1e4VgQHTvJU94QZFCVqszwFLar");

const MAX_FIXTURE_ID_LEN: usize = 16;
const OUTCOMES: usize = 3; // 0 = home, 1 = draw, 2 = away

/// Service wallet that runs the resolution cron (holds the TxLINE
/// subscription). Markets are created permissionlessly by stakers, so
/// resolution authority is pinned here rather than to market creators.
/// TODO(v2): drop this entirely in favor of CPI-verified TxLINE proofs.
pub const RESOLVER: Pubkey =
    Pubkey::from_str_const("5YMZrz1mDpx8sPTWTmKgEtk7LfAY5Jr2MAp845QSYqqx");

#[program]
pub mod doxoracle_escrow {
    use super::*;

    /// Create a prediction market for a TxLINE fixture. The market PDA
    /// (seeds: "market" + fixture_id) owns the USDC vault via its ATA.
    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: String,
        kickoff_ts: i64,
    ) -> Result<()> {
        require!(
            fixture_id.len() <= MAX_FIXTURE_ID_LEN,
            EscrowError::FixtureIdTooLong
        );
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.fixture_id = fixture_id;
        market.kickoff_ts = kickoff_ts;
        market.resolved = false;
        market.outcome = 0;
        market.totals = [0; OUTCOMES];
        market.proof_hash = [0; 32];
        market.bump = ctx.bumps.market;
        Ok(())
    }

    /// Stake USDC on an outcome before kickoff. One position per wallet per
    /// market; additional stakes must back the same outcome.
    pub fn stake(ctx: Context<Stake>, outcome: u8, amount: u64) -> Result<()> {
        require!((outcome as usize) < OUTCOMES, EscrowError::InvalidOutcome);
        require!(amount > 0, EscrowError::ZeroAmount);
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, EscrowError::MarketResolved);
        require!(
            Clock::get()?.unix_timestamp < market.kickoff_ts,
            EscrowError::MarketLocked
        );

        let position = &mut ctx.accounts.position;
        if position.amount > 0 {
            require!(position.outcome == outcome, EscrowError::OutcomeMismatch);
        } else {
            position.owner = ctx.accounts.staker.key();
            position.market = market.key();
            position.outcome = outcome;
            position.claimed = false;
            position.bump = ctx.bumps.position;
        }

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.staker_token.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.staker.to_account_info(),
                },
            ),
            amount,
        )?;

        position.amount = position
            .amount
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        market.totals[outcome as usize] = market.totals[outcome as usize]
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        Ok(())
    }

    /// Record the final result. v1: authority-gated, storing the hash of the
    /// TxLINE Merkle proof as an on-chain receipt.
    /// TODO(v2): replace the authority gate with a CPI to Txoracle's
    /// `validateStat` against the daily_scores_roots PDA so resolution is
    /// fully trustless.
    pub fn resolve(ctx: Context<Resolve>, outcome: u8, proof_hash: [u8; 32]) -> Result<()> {
        require!((outcome as usize) < OUTCOMES, EscrowError::InvalidOutcome);
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, EscrowError::MarketResolved);
        require!(
            Clock::get()?.unix_timestamp >= market.kickoff_ts,
            EscrowError::MatchNotStarted
        );
        market.resolved = true;
        market.outcome = outcome;
        market.proof_hash = proof_hash;
        Ok(())
    }

    /// Claim a parimutuel payout: winners split the entire pool pro-rata.
    /// If nobody backed the winning outcome, stakers reclaim their stake.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let market = &ctx.accounts.market;
        let position = &mut ctx.accounts.position;
        require!(market.resolved, EscrowError::MarketNotResolved);
        require!(!position.claimed, EscrowError::AlreadyClaimed);

        let winning_pool = market.totals[market.outcome as usize];
        let total_pool: u64 = market
            .totals
            .iter()
            .try_fold(0u64, |acc, t| acc.checked_add(*t))
            .ok_or(EscrowError::Overflow)?;

        let payout = if winning_pool == 0 {
            // no winners — refund every staker their stake
            position.amount
        } else {
            require!(
                position.outcome == market.outcome,
                EscrowError::LosingPosition
            );
            u64::try_from(
                (position.amount as u128)
                    .checked_mul(total_pool as u128)
                    .ok_or(EscrowError::Overflow)?
                    / (winning_pool as u128),
            )
            .map_err(|_| EscrowError::Overflow)?
        };

        position.claimed = true;

        let fixture_id = market.fixture_id.clone();
        let seeds: &[&[u8]] = &[b"market", fixture_id.as_bytes(), &[market.bump]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.claimer_token.to_account_info(),
                    authority: ctx.accounts.market.to_account_info(),
                },
                &[seeds],
            ),
            payout.min(ctx.accounts.vault.amount),
        )?;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(fixture_id: String)]
pub struct CreateMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = Market::SPACE,
        seeds = [b"market", fixture_id.as_bytes()],
        bump
    )]
    pub market: Account<'info, Market>,
    pub usdc_mint: Account<'info, Mint>,
    #[account(
        init,
        payer = authority,
        associated_token::mint = usdc_mint,
        associated_token::authority = market
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut)]
    pub staker: Signer<'info>,
    #[account(mut, seeds = [b"market", market.fixture_id.as_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        init_if_needed,
        payer = staker,
        space = Position::SPACE,
        seeds = [b"position", market.key().as_ref(), staker.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,
    #[account(mut, token::authority = staker)]
    pub staker_token: Account<'info, TokenAccount>,
    #[account(mut, associated_token::mint = staker_token.mint, associated_token::authority = market)]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Resolve<'info> {
    #[account(address = RESOLVER @ EscrowError::Unauthorized)]
    pub authority: Signer<'info>,
    #[account(mut, seeds = [b"market", market.fixture_id.as_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,
    #[account(seeds = [b"market", market.fixture_id.as_bytes()], bump = market.bump)]
    pub market: Account<'info, Market>,
    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), claimer.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == claimer.key() @ EscrowError::Unauthorized
    )]
    pub position: Account<'info, Position>,
    #[account(mut, associated_token::mint = claimer_token.mint, associated_token::authority = market)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::authority = claimer)]
    pub claimer_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct Market {
    pub authority: Pubkey,
    pub fixture_id: String,
    pub kickoff_ts: i64,
    pub resolved: bool,
    pub outcome: u8,
    pub totals: [u64; OUTCOMES],
    pub proof_hash: [u8; 32],
    pub bump: u8,
}

impl Market {
    // 8 disc + 32 + (4 + 16) + 8 + 1 + 1 + 24 + 32 + 1, padded
    pub const SPACE: usize = 160;
}

#[account]
pub struct Position {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub outcome: u8,
    pub amount: u64,
    pub claimed: bool,
    pub bump: u8,
}

impl Position {
    // 8 disc + 32 + 32 + 1 + 8 + 1 + 1, padded
    pub const SPACE: usize = 96;
}

#[error_code]
pub enum EscrowError {
    #[msg("fixture id exceeds 16 bytes")]
    FixtureIdTooLong,
    #[msg("outcome must be 0 (home), 1 (draw) or 2 (away)")]
    InvalidOutcome,
    #[msg("stake amount must be positive")]
    ZeroAmount,
    #[msg("market already resolved")]
    MarketResolved,
    #[msg("market locked at kickoff")]
    MarketLocked,
    #[msg("match has not started")]
    MatchNotStarted,
    #[msg("market not resolved yet")]
    MarketNotResolved,
    #[msg("position already claimed")]
    AlreadyClaimed,
    #[msg("position did not back the winning outcome")]
    LosingPosition,
    #[msg("existing position backs a different outcome")]
    OutcomeMismatch,
    #[msg("arithmetic overflow")]
    Overflow,
    #[msg("unauthorized")]
    Unauthorized,
}
