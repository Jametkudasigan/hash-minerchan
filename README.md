# ⛏️ HASH Token CPU Miner

> CPU miner for HASH token on Ethereum Mainnet with auto-epoch detection, auto-submission, and session persistence.

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

---

## ✨ Features

- 🔄 **Auto Epoch Detection** — Automatically detects and switches to new epochs
- 🚀 **Auto Execute** — Run once, mines continuously with zero intervention
- 💾 **Session Persistence** — Saves nonce progress, resumes after restart
- ⛽ **Gas Price Guard** — Waits for acceptable gas prices before submitting
- 📊 **Real-time Stats** — Live hash rate, total hashes, best performance
- 🛡️ **Error Recovery** — Handles network issues, RPC failures gracefully
- 🔐 **Secure** — Private key via `.env`, never hardcoded

---

## 📦 Installation

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/hash-miner.git
cd hash-miner
npm install
```

### 2. Configure

**Option A: Interactive Setup (Recommended)**
```bash
npm run setup
```

**Option B: Manual**
```bash
cp .env.example .env
# Edit .env with your private key
```

### 3. Run

```bash
npm start
```

---

## ⚙️ Configuration (.env)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PRIVATE_KEY` | ✅ | — | Wallet private key (with `0x`) |
| `RPC_URL` | ❌ | Alchemy demo | Custom RPC endpoint |
| `GAS_LIMIT` | ❌ | `300000` | Transaction gas limit |
| `MAX_GAS_PRICE_GWEI` | ❌ | `50` | Max gas price to pay |
| `THREADS` | ❌ | CPU count | Mining threads |
| `RESTART_ON_EPOCH_CHANGE` | ❌ | `true` | Auto-restart on new epoch |

---

## 🖥️ Running on VPS / Server (Auto Execute)

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start miner with PM2
pm2 start miner.js --name hash-miner

# Save PM2 config
pm2 save
pm2 startup

# Monitor
pm2 logs hash-miner
pm2 monit
```

### Using systemd (Linux)

```bash
# Create service file
sudo tee /etc/systemd/system/hash-miner.service > /dev/null <<EOF
[Unit]
Description=HASH Token Miner
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) $(pwd)/miner.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable hash-miner
sudo systemctl start hash-miner
sudo journalctl -u hash-miner -f
```

### Using Docker

```bash
# Build
docker build -t hash-miner .

# Run
docker run -d --name hash-miner --env-file .env hash-miner

# Logs
docker logs -f hash-miner
```

### Using Screen (Simple)

```bash
screen -S hash-miner
npm start
# Press Ctrl+A then D to detach

# Reattach
screen -r hash-miner
```

---

## 📊 Example Output

```
[2024-01-15 10:23:45] ℹ️ Initializing HASH Token CPU Miner...
[2024-01-15 10:23:46] ✅ Wallet: 0x1234...
[2024-01-15 10:23:46] ℹ️ Threads: 8

==================================================
📋 CONTRACT INFORMATION
==================================================
   Total Supply:     1,050,000.0 HASH
   Total Mints:      10,500
   Current Era:      2
   Current Epoch:    42
   Current Reward:   50.00 HASH/mint
   Difficulty:       57896044618658097711785492504343953926634992332820282019728792003956564819968
   Challenge:        0x8f3a2b1c...
==================================================

[2024-01-15 10:23:47] ✅ Starting mining process...
[2024-01-15 10:23:47] ℹ️ Mining epoch 42 with 8 threads...
⚡ Hash Rate: 125,000 H/s | Total: 1,250,000 | Avg: 118,000 H/s | Nonce: 1,250,000
🎉 FOUND VALID NONCE: 8423957
[2024-01-15 10:25:12] ℹ️ Submitting solution to contract...
[2024-01-15 10:25:13] ℹ️ Transaction: 0xabc123...
[2024-01-15 10:25:18] ✅ CONFIRMED in block 19876543
[2024-01-15 10:25:18] 🏆 Mined 50.00 HASH tokens!
[2024-01-15 10:25:18] ℹ️ Etherscan: https://etherscan.io/tx/0xabc123...
[2024-01-15 10:25:18] ℹ️ Total successful mints: 1
```

---

## 🧮 Reward Schedule

| Era | Total Mints | Reward per Mint |
|-----|------------|-----------------|
| 1 | 0 – 99,999 | 100.00 HASH |
| 2 | 100,000 – 199,999 | 50.00 HASH |
| 3 | 200,000 – 299,999 | 25.00 HASH |
| 4 | 300,000 – 399,999 | 12.50 HASH |
| 5+ | 400,000+ | 6.25 HASH |

---

## 🔒 Security

- **Never** commit `.env` to git
- **Never** share your private key
- Use a **dedicated mining wallet** with minimal funds
- Consider using a **hardware wallet** + burner address

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| `Insufficient funds` | Add ETH to your wallet for gas |
| `Nonce too low` | Restart miner, it auto-resumes |
| `RPC timeout` | Use a better RPC provider |
| `Gas too high` | Increase `MAX_GAS_PRICE_GWEI` or wait |
| `Epoch changed` | Auto-handled, miner restarts automatically |

---

## 📄 License

MIT — Use at your own risk. Mining involves financial risks and costs.

---

## 💬 Support

Open an issue on GitHub or join the community discussion.
