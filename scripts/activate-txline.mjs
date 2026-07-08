/**
 * TxLINE devnet activation (CLAUDE.md Step 3).
 *
 * 1. On-chain subscribe: Service Level 1 (World Cup, free), 4 weeks
 * 2. POST /auth/guest/start -> JWT
 * 3. Sign "txSig::jwt" with the local keypair (nacl detached)
 * 4. POST /token/activate -> API token
 * 5. Write TXLINE_JWT + TXLINE_API_TOKEN into .env.local
 *
 * Docs: https://txline.txodds.com/documentation/quickstart
 */
import fs from "node:fs";
import path from "node:path";
import anchor from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import axios from "axios";
import nacl from "tweetnacl";

const PROGRAM_ID = new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");
const TXL_MINT = new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG");
const API_ORIGIN = "https://txline-dev.txodds.com";
const API_BASE = "https://txline-dev.txodds.com/api";
const RPC = "https://api.devnet.solana.com";

const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;
const SELECTED_LEAGUES = [];

const root = path.resolve(import.meta.dirname, "..");
const keypairPath = path.join(root, "scripts", ".txline-keypair.json");
const envPath = path.join(root, ".env.local");

function loadOrCreateKeypair() {
  if (fs.existsSync(keypairPath)) {
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(keypairPath, "utf8")));
    const kp = Keypair.fromSecretKey(secret);
    console.log("Loaded existing keypair:", kp.publicKey.toBase58());
    return kp;
  }
  const kp = Keypair.generate();
  fs.writeFileSync(keypairPath, JSON.stringify([...kp.secretKey]));
  console.log("Generated new keypair:", kp.publicKey.toBase58());
  return kp;
}

async function ensureSol(connection, pubkey) {
  const balance = await connection.getBalance(pubkey);
  console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
  if (balance >= 0.05 * LAMPORTS_PER_SOL) return;

  const amounts = [1, 0.5, 0.5, 0.2, 0.2, 0.1];
  for (let attempt = 0; attempt < amounts.length; attempt++) {
    try {
      console.log(`Requesting devnet airdrop (${amounts[attempt]} SOL, attempt ${attempt + 1})...`);
      const sig = await connection.requestAirdrop(
        pubkey,
        Math.round(amounts[attempt] * LAMPORTS_PER_SOL),
      );
      const latest = await connection.getLatestBlockhash();
      await connection.confirmTransaction({ signature: sig, ...latest }, "confirmed");
      console.log("Airdrop confirmed");
      return;
    } catch (err) {
      console.log(`Airdrop attempt failed: ${err.message ?? err}`);
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
    }
  }
  throw new Error(
    `Airdrop rate-limited. Fund ${pubkey.toBase58()} manually at https://faucet.solana.com and re-run.`,
  );
}

function updateEnv(jwt, apiToken) {
  let env = fs.readFileSync(envPath, "utf8");
  env = env.replace(/^TXLINE_JWT=.*$/m, `TXLINE_JWT=${jwt}`);
  env = env.replace(/^TXLINE_API_TOKEN=.*$/m, `TXLINE_API_TOKEN=${apiToken}`);
  fs.writeFileSync(envPath, env);
  console.log("Wrote TXLINE_JWT and TXLINE_API_TOKEN to .env.local");
}

async function main() {
  const keypair = loadOrCreateKeypair();
  const connection = new Connection(RPC, "confirmed");
  await ensureSol(connection, keypair.publicKey);

  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });

  console.log("Fetching on-chain IDL...");
  const program = await anchor.Program.at(PROGRAM_ID, provider);

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_treasury_v2")],
    PROGRAM_ID,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    TXL_MINT,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("pricing_matrix")],
    PROGRAM_ID,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    TXL_MINT,
    keypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  console.log("Subscribing on-chain (Service Level 1, free tier)...");
  const txSig = await program.methods
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_MINT,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([
      createAssociatedTokenAccountIdempotentInstruction(
        keypair.publicKey,
        userTokenAccount,
        keypair.publicKey,
        TXL_MINT,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      ),
    ])
    .rpc();
  console.log("Subscribe tx:", txSig);

  console.log("Starting guest auth...");
  const authResponse = await axios.post(`${API_ORIGIN}/auth/guest/start`);
  const jwt = authResponse.data.token;
  if (!jwt) throw new Error(`No JWT in response: ${JSON.stringify(authResponse.data)}`);

  const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
  const signatureBytes = nacl.sign.detached(
    new TextEncoder().encode(messageString),
    keypair.secretKey,
  );
  const walletSignature = Buffer.from(signatureBytes).toString("base64");

  console.log("Activating API token...");
  const activationResponse = await axios.post(
    `${API_BASE}/token/activate`,
    { txSig, walletSignature, leagues: SELECTED_LEAGUES },
    { headers: { Authorization: `Bearer ${jwt}` } },
  );
  const apiToken = activationResponse.data.token || activationResponse.data;
  if (!apiToken || typeof apiToken !== "string") {
    throw new Error(`Unexpected activation response: ${JSON.stringify(activationResponse.data)}`);
  }

  updateEnv(jwt, apiToken);

  console.log("Verifying with a fixtures snapshot...");
  const snapshot = await axios.get(`${API_BASE}/fixtures/snapshot`, {
    headers: { Authorization: `Bearer ${jwt}`, "X-Api-Token": apiToken },
  });
  const fixtures = snapshot.data;
  console.log(
    "Snapshot OK — sample:",
    JSON.stringify(Array.isArray(fixtures) ? fixtures.slice(0, 2) : fixtures).slice(0, 2000),
  );
  console.log("\nTxLINE activation complete ✅");
}

main().catch((err) => {
  console.error("Activation failed:", err.response?.data ?? err);
  process.exit(1);
});
