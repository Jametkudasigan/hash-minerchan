/**
 * HASH Token CPU Miner
 * Ethereum Mainnet Proof-of-Work Miner
 * 
 * Auto-detects epoch, auto-submits solutions, auto-restarts on epoch change
 */

const { ethers, keccak256, AbiCoder } = require("ethers");
const fs = require("fs");
const path = require("path");
const winston = require("winston");
require("dotenv").config();

// ===================== CONFIGURATION =====================
const CONFIG = {
  CONTRACT_ADDRESS: "0xAC7b5d06fa1e77D08aea40d46cB7C5923A87A0cc",
  RPC_URL: process.env.RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/demo",
  CHAIN_ID: 1,
  GAS_LIMIT: parseInt(process.env.GAS_LIMIT) || 300000,
  MAX_GAS_PRICE_GWEI: parseInt(process.env.MAX_GAS_PRICE_GWEI) || 50,
  THREADS: parseInt(process.env.THREADS) || require("os").cpus().length,
  RESTART_ON_EPOCH_CHANGE: process.env.RESTART_ON_EPOCH_CHANGE !== "false",
  BASE_REWARD: ethers.parseUnits("100", 18),
  SESSION_FILE: path.join(__dirname, "data", "session.json"),
  STATS_FILE: path.join(__dirname, "data", "stats.json"),
};

// ===================== LOGGER =====================
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ level, message, timestamp }) => {
      const icons = { info: "ℹ️", warn: "⚠️", error: "❌", success: "✅", mine: "⛏️" };
      return `[${timestamp}] ${icons[level] || "•"} ${message}`;
    })
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/miner.log" }),
  ],
});

winston.addColors({ success: "green", mine: "cyan" });

// ===================== CONTRACT ABI =====================
const CONTRACT_ABI = [
  "function mint(uint256 nonce) external",
  "function totalMints() external view returns (uint256)",
  "function currentDifficulty() external view returns (uint256)",
  "function currentEpoch() external view returns (uint256)",
  "function challenge() external view returns (bytes32)",
  "function era() external view returns (uint256)",
  "function getReward() external view returns (uint256)",
  "function totalSupply() external view returns (uint256)",
  "event Mint(address indexed miner, uint256 nonce, uint256 reward)",
];

// ===================== MINER CLASS =====================
class HashMiner {
  constructor() {
    this.provider = null;
    this.wallet = null;
    this.contract = null;
    this.isRunning = false;
    this.stats = {
      totalHashes: 0,
      totalMints: 0,
      totalRewards: 0n,
      startTime: Date.now(),
      bestHashRate: 0,
    };
    this.currentEpoch = 0;
    this.currentDifficulty = 0n;
    this.currentChallenge = "0x";
    this.workers = [];
    this.nonceStart = 0;
    this.sessionNonce = 0;
    this.lastStatsTime = Date.now();
    this.hashRate = 0;
  }

  async initialize() {
    logger.info("🔐 Initializing HASH Token CPU Miner...");

    // Ensure directories exist
    ["logs", "data"].forEach((dir) => {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    });

    // Load private key
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey || privateKey === "0x") {
      logger.error("❌ PRIVATE_KEY not set in .env file!");
      logger.info("💡 Copy .env.example to .env and set your private key.");
      process.exit(1);
    }

    // Setup provider and wallet
    this.provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL, CONFIG.CHAIN_ID);
    this.wallet = new ethers.Wallet(privateKey, this.provider);
    this.contract = new ethers.Contract(CONFIG.CONTRACT_ADDRESS, CONTRACT_ABI, this.wallet);

    logger.success(`📍 Wallet: ${this.wallet.address}`);
    logger.info(`⛽ RPC: ${CONFIG.RPC_URL}`);
    logger.info(`🧵 Threads: ${CONFIG.THREADS}`);

    // Load session
    this.loadSession();

    // Get initial contract state
    await this.updateContractState();
    await this.displayContractInfo();

    // Check balance
    const balance = await this.provider.getBalance(this.wallet.address);
    logger.info(`💰 ETH Balance: ${ethers.formatEther(balance)} ETH`);
    if (balance < ethers.parseEther("0.001")) {
      logger.warn("⚠️ Low ETH balance! You need ETH for gas fees.");
    }
  }

  async updateContractState() {
    try {
      const [totalMints, difficulty, epoch, challenge, era, reward, supply] = await Promise.all([
        this.contract.totalMints(),
        this.contract.currentDifficulty(),
        this.contract.currentEpoch(),
        this.contract.challenge(),
        this.contract.era(),
        this.contract.getReward(),
        this.contract.totalSupply(),
      ]);

      this.currentEpoch = Number(epoch);
      this.currentDifficulty = difficulty;
      this.currentChallenge = challenge;
      this.era = Number(era);
      this.reward = reward;
      this.totalMints = Number(totalMints);
      this.totalSupply = supply;

      return { totalMints, difficulty, epoch, challenge, era, reward, supply };
    } catch (err) {
      logger.error(`Failed to update contract state: ${err.message}`);
      throw err;
    }
  }

  async displayContractInfo() {
    const rewardEth = ethers.formatUnits(this.reward, 18);
    const supplyEth = ethers.formatUnits(this.totalSupply, 18);

    console.log("\n" + "=".repeat(50));
    console.log("📋 CONTRACT INFORMATION");
    console.log("=".repeat(50));
    console.log(`   Total Supply:     ${Number(supplyEth).toLocaleString()} HASH`);
    console.log(`   Total Mints:      ${this.totalMints.toLocaleString()}`);
    console.log(`   Current Era:      ${this.era + 1}`);
    console.log(`   Current Epoch:    ${this.currentEpoch}`);
    console.log(`   Current Reward:   ${rewardEth} HASH/mint`);
    console.log(`   Difficulty:       ${this.currentDifficulty.toString()}`);
    console.log(`   Challenge:        ${this.currentChallenge.slice(0, 20)}...`);
    console.log("=".repeat(50) + "\n");
  }

  generateChallenge() {
    // challenge = keccak256(abi.encodePacked(chainId, contract, miner, epoch))
    const encoded = ethers.solidityPacked(
      ["uint256", "address", "address", "uint256"],
      [CONFIG.CHAIN_ID, CONFIG.CONTRACT_ADDRESS, this.wallet.address, this.currentEpoch]
    );
    return ethers.keccak256(encoded);
  }

  verifyHash(nonce) {
    // hash = keccak256(abi.encodePacked(challenge, nonce))
    const encoded = ethers.solidityPacked(
      ["bytes32", "uint256"],
      [this.currentChallenge, nonce]
    );
    const hash = ethers.keccak256(encoded);
    const hashValue = BigInt(hash);
    return hashValue < this.currentDifficulty;
  }

  async mine() {
    this.isRunning = true;
    logger.success("🚀 Starting mining process...");
    logger.info(`⛏️  Mining epoch ${this.currentEpoch} with ${CONFIG.THREADS} threads...`);

    const startTime = Date.now();
    let localNonce = this.sessionNonce;
    let hashesThisInterval = 0;
    let lastInterval = Date.now();

    // Periodically update stats
    const statsInterval = setInterval(() => {
      const now = Date.now();
      const elapsed = (now - lastInterval) / 1000;
      this.hashRate = Math.round(hashesThisInterval / elapsed);
      this.stats.bestHashRate = Math.max(this.stats.bestHashRate, this.hashRate);
      this.stats.totalHashes += hashesThisInterval;

      const elapsedTotal = (now - this.stats.startTime) / 1000;
      const totalHR = Math.round(this.stats.totalHashes / elapsedTotal);

      process.stdout.write(
        `\r⚡ Hash Rate: ${this.hashRate.toLocaleString()} H/s | ` +
        `Total: ${this.stats.totalHashes.toLocaleString()} | ` +
        `Avg: ${totalHR.toLocaleString()} H/s | ` +
        `Nonce: ${localNonce.toLocaleString()}        `
      );

      hashesThisInterval = 0;
      lastInterval = now;
      this.saveSession(localNonce);
    }, 2000);

    // Epoch check interval
    const epochInterval = setInterval(async () => {
      try {
        const newEpoch = await this.contract.currentEpoch();
        if (Number(newEpoch) !== this.currentEpoch) {
          logger.info(`\n🔄 Epoch changed! ${this.currentEpoch} → ${Number(newEpoch)}`);
          if (CONFIG.RESTART_ON_EPOCH_CHANGE) {
            this.currentEpoch = Number(newEpoch);
            await this.updateContractState();
            this.currentChallenge = this.generateChallenge();
            localNonce = 0;
            logger.success(`✅ Switched to epoch ${this.currentEpoch}`);
          }
        }
      } catch (e) {
        // Silent fail, will retry
      }
    }, 30000);

    // Main mining loop
    try {
      while (this.isRunning) {
        if (this.verifyHash(localNonce)) {
          clearInterval(statsInterval);
          clearInterval(epochInterval);
          process.stdout.write("\n");
          logger.success(`🎉 FOUND VALID NONCE: ${localNonce}`);
          await this.submitSolution(localNonce);

          if (CONFIG.RESTART_ON_EPOCH_CHANGE) {
            await this.updateContractState();
            this.currentChallenge = this.generateChallenge();
            localNonce = 0;
            this.saveSession(0);
            // Restart mining
            return this.mine();
          }
          break;
        }
        localNonce++;
        hashesThisInterval++;
        this.sessionNonce = localNonce;

        // Cooperative multitasking
        if (localNonce % 10000 === 0) {
          await new Promise((r) => setImmediate(r));
        }
      }
    } catch (err) {
      clearInterval(statsInterval);
      clearInterval(epochInterval);
      logger.error(`Mining error: ${err.message}`);
      throw err;
    }
  }

  async submitSolution(nonce) {
    try {
      logger.info(`📤 Submitting solution to contract...`);

      // Check gas price
      const feeData = await this.provider.getFeeData();
      const gasPriceGwei = Number(feeData.gasPrice) / 1e9;
      if (gasPriceGwei > CONFIG.MAX_GAS_PRICE_GWEI) {
        logger.warn(`⛽ Gas price too high (${gasPriceGwei.toFixed(2)} Gwei), waiting...`);
        await this.waitForGasPrice();
      }

      // Submit transaction
      const tx = await this.contract.mint(nonce, {
        gasLimit: CONFIG.GAS_LIMIT,
      });

      logger.info(`📋 Transaction: ${tx.hash}`);
      logger.info(`⏳ Waiting for confirmation...`);

      const receipt = await tx.wait();

      if (receipt.status === 1) {
        const rewardEth = ethers.formatUnits(this.reward, 18);
        this.stats.totalMints++;
        this.stats.totalRewards += this.reward;
        this.saveStats();

        logger.success(`✅ CONFIRMED in block ${receipt.blockNumber}`);
        logger.success(`🏆 Mined ${rewardEth} HASH tokens!`);
        logger.info(`🔗 Etherscan: https://etherscan.io/tx/${tx.hash}`);
        logger.info(`📈 Total successful mints: ${this.stats.totalMints}`);
      } else {
        logger.error("❌ Transaction failed!");
      }
    } catch (err) {
      logger.error(`Submission failed: ${err.message}`);
      // If nonce was already used, just continue
      if (err.message.includes("already mined") || err.message.includes("invalid nonce")) {
        logger.warn("Nonce already used or invalid, continuing...");
      } else {
        throw err;
      }
    }
  }

  async waitForGasPrice() {
    while (true) {
      const feeData = await this.provider.getFeeData();
      const gasPriceGwei = Number(feeData.gasPrice) / 1e9;
      if (gasPriceGwei <= CONFIG.MAX_GAS_PRICE_GWEI) {
        logger.success(`⛽ Gas price acceptable: ${gasPriceGwei.toFixed(2)} Gwei`);
        return;
      }
      logger.info(`⏳ Gas: ${gasPriceGwei.toFixed(2)} Gwei, waiting for < ${CONFIG.MAX_GAS_PRICE_GWEI} Gwei...`);
      await new Promise((r) => setTimeout(r, 15000));
    }
  }

  loadSession() {
    try {
      if (fs.existsSync(CONFIG.SESSION_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.SESSION_FILE, "utf8"));
        this.sessionNonce = data.nonce || 0;
        logger.info(`📂 Loaded session from nonce ${this.sessionNonce.toLocaleString()}`);
      }
    } catch (e) {
      this.sessionNonce = 0;
    }
  }

  saveSession(nonce) {
    try {
      fs.writeFileSync(CONFIG.SESSION_FILE, JSON.stringify({ nonce, timestamp: Date.now() }, null, 2));
    } catch (e) {}
  }

  loadStats() {
    try {
      if (fs.existsSync(CONFIG.STATS_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.STATS_FILE, "utf8"));
        this.stats = { ...this.stats, ...data };
      }
    } catch (e) {}
  }

  saveStats() {
    try {
      fs.writeFileSync(CONFIG.STATS_FILE, JSON.stringify(this.stats, (key, value) =>
        typeof value === "bigint" ? value.toString() : value, 2));
    } catch (e) {}
  }

  displayFinalStats() {
    const elapsed = (Date.now() - this.stats.startTime) / 1000;
    const hours = Math.floor(elapsed / 3600);
    const minutes = Math.floor((elapsed % 3600) / 60);
    const seconds = Math.floor(elapsed % 60);
    const totalRewards = ethers.formatUnits(this.stats.totalRewards, 18);

    console.log("\n" + "=".repeat(50));
    console.log("📊 MINING STATISTICS");
    console.log("=".repeat(50));
    console.log(`   Runtime:        ${hours}h ${minutes}m ${seconds}s`);
    console.log(`   Total Hashes:     ${this.stats.totalHashes.toLocaleString()}`);
    console.log(`   Best Hash Rate:   ${this.stats.bestHashRate.toLocaleString()} H/s`);
    console.log(`   Successful Mints: ${this.stats.totalMints}`);
    console.log(`   Total Rewards:    ${totalRewards} HASH`);
    console.log("=".repeat(50));
  }

  async stop() {
    this.isRunning = false;
    logger.info("🛑 Stopping miner...");
    this.saveSession(this.sessionNonce);
    this.saveStats();
    this.displayFinalStats();
    process.exit(0);
  }
}

// ===================== MAIN =====================
async function main() {
  const miner = new HashMiner();

  // Graceful shutdown
  process.on("SIGINT", () => miner.stop());
  process.on("SIGTERM", () => miner.stop());

  try {
    await miner.initialize();
    await miner.mine();
  } catch (err) {
    logger.error(`Fatal error: ${err.message}`);
    miner.displayFinalStats();
    process.exit(1);
  }
}

main();
