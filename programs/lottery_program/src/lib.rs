use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod lottery_program {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        let owner = &mut ctx.accounts.owner;

        program_state.lottery_count = 0;
        program_state.owner = *owner.key;

        Ok(())
    }

    pub fn create_lottery(ctx: Context<CreateLottery>) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        let user = &mut ctx.accounts.user;
        let lottery = &mut ctx.accounts.lottery;

        // check if the program_state "owner" is equal to "user"
        require!(*user.key == program_state.owner, LotteryError::NotAManager);

        lottery.participant_count = 0;
        lottery.is_active = true;

        program_state.lottery_count += 1;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer=owner,
        space=8+32+64,
        seeds=[b"state".as_ref()],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[derive(Accounts)]
pub struct CreateLottery<'info> {
    #[account(
        mut,
        seeds=[b"state".as_ref()],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(
        init,
        payer=user,
        space=8+32+32+64+2,
        seeds=[b"lottery".as_ref(), program_state.lottery_count.to_be_bytes().as_ref()],
        bump
    )]
    pub lottery: Account<'info, Lottery>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>
}


#[account]
pub struct ProgramState {
    pub owner: Pubkey,
    pub lottery_count: u64
}

#[account]
pub struct Lottery {
    pub escrow: Pubkey,
    pub winner: Pubkey,
    pub participant_count: u64,
    pub is_active: bool,
}

#[error_code]
pub enum LotteryError {
    #[msg("Restricted! You are not having Manager privilege.")]
    NotAManager
}