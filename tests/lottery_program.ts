import * as anchor from "@project-serum/anchor";
import { Program } from "@project-serum/anchor";
import { utf8 } from "@project-serum/anchor/dist/cjs/utils/bytes";
import { assert } from "chai";
import { LotteryProgram } from "../target/types/lottery_program";

var provider = anchor.AnchorProvider.env();
const owner_key = provider.wallet.publicKey;
const system_key = anchor.web3.SystemProgram.programId

const user_jonny = anchor.web3.Keypair.generate();
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
    const tx = await program.methods.createLottery(new anchor.BN(100000))
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

    try {
      const tx = await program.methods.createLottery(new anchor.BN(100000))
        .accounts({
          programState: account_state_pda,
          lottery: lottery_pda,
          user: bad_actor.publicKey,
          systemProgram: system_key
        })
        .signers([bad_actor])
        .rpc();

      assert(false, "unauthorised user created lottery!")
    } catch (err) {
      // console.log(err);

    }

  });

  it("Take part in lottery!", async () => {
    let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("lottery"), new anchor.BN(0).toBuffer('be', 8)],
      program.programId
    )
    let lottery_data = await program.account.lottery.fetch(lottery_pda);

    let [participant_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("participant"), lottery_data.index.toBuffer('be', 8), lottery_data.participantCount.toBuffer('be', 8)],
      program.programId
    )
    console.log("participant pda 1 =", participant_pda.toString())
    // create a unauthorised user

    await fundAccount(user_jonny);
    await getBalance("lottery before", lottery_pda);
    await getBalance("jonny before", user_jonny.publicKey);

    const tx = await program.methods.createParticipant()
      .accounts({
        lottery: lottery_pda,
        participant: participant_pda,
        user: user_jonny.publicKey
      })
      .signers([user_jonny])
      .rpc()

    console.log("Your participation transaction signature=", tx);
    await getBalance("lottery after", lottery_pda);
    await getBalance("jonny after", user_jonny.publicKey);
  });
  it("Take part in lottery Again!", async () => {
    let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("lottery"), new anchor.BN(0).toBuffer('be', 8)],
      program.programId
    )
    let lottery_data = await program.account.lottery.fetch(lottery_pda);

    let [participant_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("participant"), lottery_data.index.toBuffer('be', 8), lottery_data.participantCount.toBuffer('be', 8)],
      program.programId
    )
    console.log("participant pda 2 =", participant_pda)
    // create a unauthorised user

    await fundAccount(user_jonny);

    const tx = await program.methods.createParticipant()
      .accounts({
        lottery: lottery_pda,
        participant: participant_pda,
        user: user_jonny.publicKey
      })
      .signers([user_jonny])
      .rpc()

    console.log("Your participation transaction signature=", tx);
  });

  // it("Jonny take part in again in same lottery!", async () => {
  //   let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
  //     [utf8.encode("lottery"), new anchor.BN(0).toBuffer('be', 8)],
  //     program.programId
  //   )
  //   let lottery_data = await program.account.lottery.fetch(lottery_pda);

  //   let [participant_pda] = await anchor.web3.PublicKey.findProgramAddress(
  //     [utf8.encode("participant"), lottery_data.participantCount.toBuffer('be', 8)],
  //     program.programId
  //   )

  //   // create a unauthorised user
  //   await fundAccount(user_jonny);

  //   const tx = await program.methods.createParticipant()
  //     .accounts({
  //       lottery: lottery_pda,
  //       participant: participant_pda,
  //       user: user_jonny.publicKey
  //     })
  //     .signers([user_jonny])
  //     .rpc()

  //   console.log("Your participation transaction signature=", tx);
  // });

  it("Finalize the winner!", async () => {
    let [account_state_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("state")],
      program.programId
    )

    let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("lottery"), new anchor.BN(0).toBuffer('be', 8)],
      program.programId
    )
    await getBalance("lottery before", lottery_pda);
    await getBalance("jonny before", user_jonny.publicKey);
    let tx = await program.methods.finalizeWinner()
      .accounts({
        programState: account_state_pda,
        lottery: lottery_pda,
        user: owner_key,
      })
      .rpc()

    
  });

  it("List of participant PDA derived!", async () => {
    for await (let i of [0]) {
      let [participant_pda, bump] = await anchor.web3.PublicKey.findProgramAddress(
        [utf8.encode("participant"), new anchor.BN(0).toBuffer('be', 8), new anchor.BN(i).toBuffer('be', 8)],
        program.programId
      )
      console.log("participant pad", { i }, "=", participant_pda.toString(), " bump=", bump)
    }

  });

  it("Jonny claims his prize!", async () => {
    let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("lottery"), new anchor.BN(0).toBuffer('be', 8)],
      program.programId
    );

    let lottery_data = await program.account.lottery.fetch(lottery_pda);
      let lottery_winning_participant = lottery_data.winner;
    let tx = await program.methods.claimReward()
    .accounts({
      lottery: lottery_pda,
      participant: lottery_winning_participant,
      user: user_jonny.publicKey,
      systemProgram: system_key
    })
    .signers([user_jonny])
    .rpc();
    console.log("Claimer is =", user_jonny.publicKey.toString())
    lottery_data = await program.account.lottery.fetch(lottery_pda);
    console.log("Lottery Data", lottery_data)
    await getBalance("lottery after winner", lottery_pda);
    await getBalance("jonny after winner", user_jonny.publicKey);
  });

  it("Fail: Take part in completed lottery!", async () => {
    let [lottery_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("lottery"), new anchor.BN(0).toBuffer('be', 8)],
      program.programId
    )
    let lottery_data = await program.account.lottery.fetch(lottery_pda);

    let [participant_pda] = await anchor.web3.PublicKey.findProgramAddress(
      [utf8.encode("participant"), lottery_data.index.toBuffer('be', 8), lottery_data.participantCount.toBuffer('be', 8)],
      program.programId
    )
    console.log("participant pda 1 =", participant_pda.toString())
    // create a unauthorised user

    await fundAccount(user_jonny);
      try{
        const tx = await program.methods.createParticipant()
        .accounts({
          lottery: lottery_pda,
          participant: participant_pda,
          user: user_jonny.publicKey
        })
        .signers([user_jonny])
        .rpc()
        assert(false, "tx should have failed")
      }catch{
        assert(true)
      }
    

  });
});


const fundAccount = async (userKey) => {
  const connection = provider.connection;
  let signature = await connection.requestAirdrop(userKey.publicKey, 1000953520)
  await connection.confirmTransaction(signature);

  let balance = await connection.getBalance(userKey.publicKey);
}

const getBalance = async (text = "", target_pubkey) => {
  const connection = provider.connection;
  let balance = await connection.getBalance(target_pubkey);
  console.log(text, "=>", balance)
} 
