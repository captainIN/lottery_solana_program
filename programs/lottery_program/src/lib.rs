use anchor_lang::prelude::*;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

#[program]
pub mod lottery_program {
    use super::*;
    use anchor_lang::solana_program::system_instruction::transfer;
    use anchor_lang::solana_program::program::invoke;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        let owner = &mut ctx.accounts.owner;

        program_state.lottery_count = 0;
        program_state.owner = *owner.key;

        Ok(())
    }

    pub fn create_lottery(ctx: Context<CreateLottery>, entry_fee:u64) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        let user = &mut ctx.accounts.user;
        let lottery = &mut ctx.accounts.lottery;

        // check if the program_state "owner" is equal to "user"
        require!(*user.key == program_state.owner, LotteryError::NotAManager);

        lottery.index = program_state.lottery_count;
        lottery.entry_fee = entry_fee;
        lottery.participant_count = 0;
        lottery.funds = 0;
        lottery.is_active = true;
        lottery.reward_claimed = false;

        program_state.lottery_count += 1;

        Ok(())
    }

    pub fn create_participant(ctx: Context<CreateParticipant>) -> Result<()> {
        let participant = &mut ctx.accounts.participant;
        let user = &mut ctx.accounts.user;
        let lottery = &mut ctx.accounts.lottery;

        // check if the user has alredy participated
        // Logic pending for this check

        // Check if the lottery is active
        require!(lottery.is_active == true, LotteryError::LotteryIsOver);

        let ix = transfer(&user.key, &lottery.key(), lottery.entry_fee);

        invoke(&ix, &[
            user.to_account_info(),
            lottery.to_account_info(),
        ]).ok();

        participant.user = *user.key;
        participant.index = lottery.participant_count;

        lottery.funds += lottery.entry_fee;
        lottery.participant_count += 1;

        Ok(())
    }

    pub fn finalize_winner(ctx: Context<FinalizeWinner>, offchain_random_index:u64) -> Result<()> {
        let program_state = &mut ctx.accounts.program_state;
        let lottery = &mut ctx.accounts.lottery;
        let user = &mut ctx.accounts.user;

        // Check if the user is the owner of state
        require!(program_state.owner == *user.key, LotteryError::NotAManager);

        let mut participant_list = Vec::new();
        for index in 0..lottery.participant_count {
            let (expected_pda, _bump) = Pubkey::find_program_address(&[b"participant", &lottery.index.to_be_bytes(), &index.to_be_bytes()], ctx.program_id);
            // msg!("Index = {}, bump={}, pda = {}", index, bump, expected_pda);
            participant_list.push(expected_pda)
        }

        // let winning_index:usize = participant_list.len()/2; // OnChain old logic
        let winning_index = offchain_random_index as usize; // off chain logic
        let choosen_winner_participant:Pubkey = participant_list[winning_index]; 

        msg!("Winner is {}", choosen_winner_participant);
        lottery.winner = choosen_winner_participant;
        lottery.is_active = false;


        Ok(())
    }

    pub fn claim_reward(ctx: Context<ClaimReward>) -> Result<()> {
        let lottery = &mut ctx.accounts.lottery;
        let user = &mut ctx.accounts.user;
        let participant = &mut ctx.accounts.participant;

        msg!("winner = {} and claimer={}", lottery.winner, *user.key);

        require!(participant.key() == lottery.winner, LotteryError::NotAWinner);
        require!(participant.user == *user.key, LotteryError::NotAWinner);
        require!(lottery.reward_claimed == false, LotteryError::RewardAlreadyClaimed);
        
        transfer_service_fee_lamports(&lottery.to_account_info(), user, lottery.funds)?;

        // Set prize claimed as true
        lottery.reward_claimed = true;

        Ok(())
    }

    
}
fn transfer_service_fee_lamports(
    from_account: &AccountInfo,
    to_account: &AccountInfo,
    amount_of_lamports: u64,
) -> Result<()> {
    // Does the from account have enough lamports to transfer?
    require!(**from_account.try_borrow_lamports()? > amount_of_lamports, LotteryError::InsufficientFundsForTransaction);

    // Debit from_account and credit to_account
    **from_account.try_borrow_mut_lamports()? -= amount_of_lamports;
    **to_account.try_borrow_mut_lamports()? += amount_of_lamports;
    Ok(())
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

    pub system_program: Program<'info, System>,
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
        space=8+64+64+64+32+64+2+2,
        seeds=[b"lottery".as_ref(), program_state.lottery_count.to_be_bytes().as_ref()],
        bump
    )]
    pub lottery: Account<'info, Lottery>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct CreateParticipant<'info> {
    #[account(
        mut,
        seeds=[b"lottery".as_ref(), lottery.index.to_be_bytes().as_ref()],
        bump,
    )]
    pub lottery: Account<'info, Lottery>,

    #[account(
        init,
        payer=user,
        space=8+32+64,
        seeds=[b"participant".as_ref(), lottery.index.to_be_bytes().as_ref(), lottery.participant_count.to_be_bytes().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}


#[derive(Accounts)]
pub struct FinalizeWinner<'info> {
    #[account(
        mut,
        seeds=[b"state".as_ref()],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,

    #[account(
        mut,
        seeds=[b"lottery".as_ref(), lottery.index.to_be_bytes().as_ref()],
        bump,
    )]
    pub lottery: Account<'info, Lottery>,

    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct ClaimReward<'info> {

    #[account(
        mut,
        seeds=[b"lottery".as_ref(), lottery.index.to_be_bytes().as_ref()],
        bump,
    )]
    pub lottery: Account<'info, Lottery>,

    #[account(
        mut,
        seeds=[b"participant".as_ref(), lottery.index.to_be_bytes().as_ref(), participant.index.to_be_bytes().as_ref()],
        bump
    )]
    pub participant: Account<'info, Participant>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>
}

#[account]
pub struct ProgramState {
    pub owner: Pubkey,
    pub lottery_count: u64,
}

#[account]
pub struct Lottery {
    pub index: u64,
    pub funds: u64,
    pub entry_fee: u64,
    pub winner: Pubkey,
    pub participant_count: u64,
    pub is_active: bool,
    pub reward_claimed: bool
}

#[derive(std::fmt::Debug)]
#[account]
pub struct Participant {
    user: Pubkey,
    index: u64
}

#[error_code]
pub enum LotteryError {
    #[msg("Restricted! You are not having Manager privilege.")]
    NotAManager,

    #[msg("Claim Failed! You are not winner of this lottery.")]
    NotAWinner,

    #[msg("Claim Failed! Lottery reward is already claimed.")]
    RewardAlreadyClaimed,

    #[msg("Lottery Inactive. This lottery is over.")]
    LotteryIsOver,

    #[msg("Claim Failed! Insufficiant funds.")]
    InsufficientFundsForTransaction,
}
