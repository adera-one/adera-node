node getchainstatus.js GetMaxTxCountInBlockRange --rpc http://localhost:8545 --startNum 0 --endNum 1000
node getchainstatus.js GetBinaryVersion --rpc http://localhost:8545 --num 21 --turnLength 4
node getchainstatus.js GetTopAddr --rpc http://localhost:8545 --startNum 500  --endNum 1000 --topNum 2
node getchainstatus.js GetSlashCount --rpc http://localhost:8545 --blockNum 500
node getchainstatus.js GetPerformanceData --rpc http://localhost:8545 --startNum 0  --endNum 100
node getchainstatus.js GetBlobTxs --rpc http://localhost:8545 --startNum 0  --endNum 100
node getchainstatus.js GetFaucetStatus --rpc http://localhost:8545 --startNum 1  --endNum 111
node getchainstatus.js GetKeyParameters --rpc http://localhost:8545
node getchainstatus.js GetEip7623 --rpc http://localhost:8545 --startNum 500  --endNum 1009