import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { utf8 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { assert } from "chai";
import { LotteryProgram } from "../target/types/lottery_program";

var provider = anchor.AnchorProvider.env();
const owner_key = provider.wallet.publicKey;
const system_key = anchor.web3.SystemProgram.programId
describe("lottery_program", () => {
  // Configure the client to use the local cluster.

  anchor.setProvider(provider);

  const program = anchor.workspace.LotteryProgram as Program<LotteryProgram>;

  it("Is initialized!", async () => {

    let [account_state_signer] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("state")],
      program.programId
    )
    const tx = await program.methods.initialize().accounts({
      programState: account_state_signer,
      owner: owner_key,
      systemProgram: system_key
    })
      .rpc();
    console.log("Your initialized transaction signature", tx);

    let created_state = await program.account.programState.fetch(account_state_signer);
    assert(created_state.owner.toString() === owner_key.toString(), "Owner do not match.")
  });

  it("lottery room created!", async () => {

    let [account_state_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("state")],
      program.programId
    )
    let account_state_data = await program.account.programState.fetch(account_state_pda);

    let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("lottery"), account_state_data.lotteryCount.toBuffer('be', 8)],
      program.programId
    )
    const tx = await program.methods.createLottery()
      .accounts({
        programState: account_state_pda,
        lottery: lottery_pda,
        user: owner_key,
        systemProgram: system_key
      })
      .rpc();

      let created_lottery = await program.account.lottery.fetch(lottery_pda);
      account_state_data = await program.account.programState.fetch(account_state_pda);
      assert(created_lottery.participantCount.toString() === "0", "Wrong Lottery Participant count.")
      assert(account_state_data.lotteryCount.toString() === "1", "Wrong Lottery count in program.")
  });

  it("Non-manager fails creating lottery room!", async () => {

    let [account_state_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("state")],
      program.programId
    )
    let account_state_data = await program.account.programState.fetch(account_state_pda);

    let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("lottery"), account_state_data.lotteryCount.toBuffer('be', 8)],
      program.programId
    )

    // create a unauthorised user
    let bad_actor = anchor.web3.Keypair.generate();
    await fundAccount(bad_actor);

    try{
      const tx = await program.methods.createLottery()
      .accounts({
        programState: account_state_pda,
        lottery: lottery_pda,
        user: bad_actor.publicKey,
        systemProgram: system_key
      })
      .signers([bad_actor])
      .rpc();

      assert(false, "unauthorised user created lottery!")
    }catch(err){
      // console.log(err);
      
    }
    
  });
});


const fundAccount = async (userKey) => {
  const connection = provider.connection;
  let signature = await connection.requestAirdrop(userKey.publicKey, 1000953520)
  await connection.confirmTransaction(signature);

  let balance = await connection.getBalance(userKey.publicKey);
}
