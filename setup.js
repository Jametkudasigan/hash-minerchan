/**
 * HASH Token Miner - Interactive Setup
 * Creates .env file and validates configuration
 */

const fs = require("fs");
const readline = require("readline");
const { ethers } = require("ethers");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  console.log("\n🔧 HASH Token Miner - Setup Wizard");
  console.log("=====================================\n");

  let privateKey = await ask("Enter your private key (with 0x prefix): ");
  privateKey = privateKey.trim();

  if (!privateKey.startsWith("0x") || privateKey.length !== 66) {
    console.log("❌ Invalid private key format!");
    process.exit(1);
  }

  // Validate key
  try {
    const wallet = new ethers.Wallet(privateKey);
    console.log(`✅ Wallet address: ${wallet.address}\n`);
  } catch (e) {
    console.log("❌ Invalid private key!");
    process.exit(1);
  }

  const rpcUrl = await ask("RPC URL (press Enter for default): ");
  const threads = await ask("Number of threads (press Enter for auto): ");
  const maxGas = await ask("Max gas price in Gwei (press Enter for 50): ");

  let envContent = `PRIVATE_KEY=${privateKey}\n`;
  if (rpcUrl.trim()) envContent += `RPC_URL=${rpcUrl.trim()}\n`;
  if (threads.trim()) envContent += `THREADS=${threads.trim()}\n`;
  if (maxGas.trim()) envContent += `MAX_GAS_PRICE_GWEI=${maxGas.trim()}\n`;

  fs.writeFileSync(".env", envContent);
  console.log("\n✅ .env file created successfully!");
  console.log("🚀 Run 'npm start' to begin mining.\n");

  rl.close();
}

main();
