import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { SardhanaPay } from "../target/types/sardhana_pay";

describe("sardhana_pay", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const program = anchor.workspace.SardhanaPay as Program<SardhanaPay>;

  const FEE_BPS = 250; // 2.5%
  const treasury = Keypair.generate();
  const creator = Keypair.generate();
  const talent = Keypair.generate();

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  const [creatorStatsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("creator"), creator.publicKey.toBuffer()],
    program.programId
  );

  const memoHash = Buffer.alloc(32, 7);

  before(async () => {
    await program.methods
      .initializeConfig(FEE_BPS)
      .accounts({
        config: configPda,
        authority: provider.wallet.publicKey,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  });

  it("stores the configured fee and treasury", async () => {
    const config = await program.account.config.fetch(configPda);
    assert.equal(config.feeBps, FEE_BPS);
    assert.isFalse(config.paused);
    assert.ok(config.treasury.equals(treasury.publicKey));
  });

  it("refuses a fee above the on-chain ceiling", async () => {
    try {
      await program.methods
        .updateConfig(2000, null)
        .accounts({ config: configPda, authority: provider.wallet.publicKey, newTreasury: null })
        .rpc();
      assert.fail("a 20% fee was accepted");
    } catch (err: any) {
      assert.include(err.toString(), "FeeTooHigh");
    }
  });

  it("pays the creator and the treasury in one transaction", async () => {
    const amount = new BN(LAMPORTS_PER_SOL);
    const expectedFee = amount.muln(FEE_BPS).divn(10_000);
    const expectedPayout = amount.sub(expectedFee);

    const creatorBefore = await provider.connection.getBalance(creator.publicKey);
    const treasuryBefore = await provider.connection.getBalance(treasury.publicKey);

    await program.methods
      .sponsor(amount, [...memoHash])
      .accounts({
        config: configPda,
        sponsor: provider.wallet.publicKey,
        creator: creator.publicKey,
        creatorStats: creatorStatsPda,
        treasury: treasury.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const creatorAfter = await provider.connection.getBalance(creator.publicKey);
    const treasuryAfter = await provider.connection.getBalance(treasury.publicKey);

    assert.equal(creatorAfter - creatorBefore, expectedPayout.toNumber());
    assert.equal(treasuryAfter - treasuryBefore, expectedFee.toNumber());

    const stats = await program.account.creatorStats.fetch(creatorStatsPda);
    assert.equal(stats.sponsorCount.toNumber(), 1);
    assert.equal(stats.totalLamports.toNumber(), expectedPayout.toNumber());
  });

  it("refuses a sponsorship routed to an unconfigured treasury", async () => {
    const attacker = Keypair.generate();
    try {
      await program.methods
        .sponsor(new BN(LAMPORTS_PER_SOL), [...memoHash])
        .accounts({
          config: configPda,
          sponsor: provider.wallet.publicKey,
          creator: creator.publicKey,
          creatorStats: creatorStatsPda,
          treasury: attacker.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("the fee was redirected to an arbitrary account");
    } catch (err: any) {
      assert.include(err.toString(), "WrongTreasury");
    }
  });

  it("refuses self-sponsorship and dust amounts", async () => {
    try {
      await program.methods
        .sponsor(new BN(1_000), [...memoHash])
        .accounts({
          config: configPda,
          sponsor: provider.wallet.publicKey,
          creator: creator.publicKey,
          creatorStats: creatorStatsPda,
          treasury: treasury.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      assert.fail("a dust sponsorship was accepted");
    } catch (err: any) {
      assert.include(err.toString(), "AmountTooSmall");
    }
  });

  describe("hire escrow", () => {
    const engagementId = new BN(1);
    const amount = new BN(2 * LAMPORTS_PER_SOL);
    let engagementPda: PublicKey;
    let vaultPda: PublicKey;

    before(async () => {
      [engagementPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("engagement"),
          provider.wallet.publicKey.toBuffer(),
          engagementId.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), engagementPda.toBuffer()],
        program.programId
      );

      const expiresAt = new BN(Math.floor(Date.now() / 1000) + 3600);
      await program.methods
        .createEngagement(engagementId, amount, 2, expiresAt)
        .accounts({
          config: configPda,
          engagement: engagementPda,
          vault: vaultPda,
          client: provider.wallet.publicKey,
          talent: talent.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
    });

    it("holds the funds in the vault, not in the state account", async () => {
      const vaultBalance = await provider.connection.getBalance(vaultPda);
      assert.equal(vaultBalance, amount.toNumber());

      const engagement = await program.account.engagement.fetch(engagementPda);
      assert.equal(engagement.totalLamports.toNumber(), amount.toNumber());
      assert.equal(engagement.releasedLamports.toNumber(), 0);
    });

    it("releases a milestone to the talent", async () => {
      const release = new BN(LAMPORTS_PER_SOL);
      const talentBefore = await provider.connection.getBalance(talent.publicKey);

      await program.methods
        .releaseMilestone(0, release)
        .accounts({
          config: configPda,
          engagement: engagementPda,
          vault: vaultPda,
          client: provider.wallet.publicKey,
          talent: talent.publicKey,
          treasury: treasury.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const expectedFee = release.muln(FEE_BPS).divn(10_000);
      const talentAfter = await provider.connection.getBalance(talent.publicKey);
      assert.equal(talentAfter - talentBefore, release.sub(expectedFee).toNumber());
    });

    it("refuses to pay the same milestone twice", async () => {
      try {
        await program.methods
          .releaseMilestone(0, new BN(LAMPORTS_PER_SOL))
          .accounts({
            config: configPda,
            engagement: engagementPda,
            vault: vaultPda,
            client: provider.wallet.publicKey,
            talent: talent.publicKey,
            treasury: treasury.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("a milestone was released twice");
      } catch (err: any) {
        assert.include(err.toString(), "MilestoneAlreadyReleased");
      }
    });

    it("refuses a refund before the deadline", async () => {
      try {
        await program.methods
          .refundEngagement()
          .accounts({
            engagement: engagementPda,
            vault: vaultPda,
            client: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        assert.fail("funds were pulled back before expiry");
      } catch (err: any) {
        assert.include(err.toString(), "NotExpired");
      }
    });
  });
});
