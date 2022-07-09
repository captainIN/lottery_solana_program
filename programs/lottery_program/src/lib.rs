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


#[account]
pub struct ProgramState {
    pub owner: Pubkey,
    pub lottery_count: u64
}
