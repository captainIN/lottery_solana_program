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
});
