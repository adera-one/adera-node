import { ethers } from "ethers";
import program from "commander";

program.option("--rpc <rpc>", "Rpc");
program.option("--startNum <startNum>", "start num")
program.option("--endNum <endNum>", "end num")
program.option("--miner <miner>", "miner", "")
program.option("--num <Num>", "validator num", 21)
program.option("--turnLength <Num>", "the consecutive block length", 4)
program.option("--topNum <Num>", "top num of address to be displayed", 20)
program.option("--blockNum <Num>", "block num", 0)
program.option("-h, --help", "")

function printUsage() {
    console.log("Usage:");
    console.log("  node getchainstatus.js --help");
    console.log("  node getchainstatus.js [subcommand] [options]");
    console.log("\nSubcommands:");
    console.log("  GetMaxTxCountInBlockRange: find the block with max tx size of a range");
    console.log("  GetBinaryVersion: dump validators' binary version, based on Header.Extra");
    console.log("  GetTopAddr: get hottest $topNum target address of a block range");
    console.log("  GetSlashCount: get slash state at a specific block height");
    console.log("  GetPerformanceData: analyze the performance data of a block range");
    console.log("  GetBlobTxs: get BlobTxs of a block range");
    console.log("  GetFaucetStatus: get faucet status of ADR testnet");
    console.log("  GetKeyParameters: dump some key governance parameter");
    console.log("\nOptions:");
    console.log("  --rpc       specify the url of RPC endpoint");
    console.log("  --startNum  the start block number");
    console.log("  --endNum    the end block number");
    console.log("  --miner     the miner address");
    console.log("  --num       the number of blocks to be checked");
    console.log("  --topNum    the topNum of blocks to be checked");
    console.log("  --blockNum  the block number to be checked");
    console.log("\nExample:");
    // mainnet https://rpc.adrscan.com
    console.log("  node getchainstatus.js GetMaxTxCountInBlockRange --rpc http://localhost:8545 --startNum 40000001  --endNum 40000005")
    console.log("  node getchainstatus.js GetBinaryVersion --rpc http://localhost:8545 --num 21 --turnLength 4")
    console.log("  node getchainstatus.js GetTopAddr --rpc http://localhost:8545 --startNum 40000001  --endNum 40000010 --topNum 10")
    console.log("  node getchainstatus.js GetSlashCount --rpc http://localhost:8545 --blockNum 40000001")  // default: latest block
    console.log("  node getchainstatus.js GetPerformanceData --rpc http://localhost:8545 --startNum 40000001  --endNum 40000010")
    console.log("  node getchainstatus.js GetBlobTxs --rpc http://localhost:8545 --startNum 40000001  --endNum 40000010")
    console.log("  node getchainstatus.js GetFaucetStatus --rpc http://localhost:8545 --startNum 40000001  --endNum 40000010")
    console.log("  node getchainstatus.js GetKeyParameters --rpc http://localhost:8545") // default: latest block
    console.log("  node getchainstatus.js GetEip7623 --rpc http://localhost:8545 --startNum 40000001  --endNum 40000010")
}

program.usage = printUsage;
program.parse(process.argv);

const provider = new ethers.JsonRpcProvider(program.rpc)

const addrValidatorSet = '0x0000000000000000000000000000000000001000';
const addrSlash = '0x0000000000000000000000000000000000001001';
const addrStakeHub = '0x0000000000000000000000000000000000002002';

const validatorSetAbi = [
    "function validatorExtraSet(uint256 offset) external view returns (uint256, bool, bytes)",
    "function getLivingValidators() external view returns (address[], bytes[])",
    "function numOfCabinets() external view returns (uint256)",
    "function maxNumOfCandidates() external view returns (uint256)",
    "function maxNumOfWorkingCandidates() external view returns (uint256)",
    "function maxNumOfMaintaining() external view returns (uint256)",  // default 3
    "function turnLength() external view returns (uint256)",
    "function systemRewardAntiMEVRatio() external view returns (uint256)",
    "function maintainSlashScale() external view returns (uint256)",   // default 2, valid: 1->9
    "function burnRatio() external view returns (uint256)",            // default: 10%
    "function systemRewardBaseRatio() external view returns (uint256)" // default: 1/16
]
const slashAbi = [
    "function getSlashIndicator(address validatorAddr) external view returns (uint256, uint256)"
]

const stakeHubAbi = [
    "function getValidatorElectionInfo(uint256 offset, uint256 limit) external view returns (address[], uint256[], bytes[], uint256)",
    "function getValidatorDescription(address validatorAddr) external view returns (tuple(string, string, string, string))",
    "function consensusToOperator(address consensusAddr) public view returns (address)",
    "function minSelfDelegationADR() public view returns (uint256)",  // default 2000, valid: 1000 -> 100,000
    "function maxElectedValidators() public view returns (uint256)",  // valid: 1 -> 500
    "function unbondPeriod() public view returns (uint256)",          // default 7days, valid: 3days ->30days
    "function downtimeSlashAmount() public view returns (uint256)",   // default 10ADR, valid: 5 -> felonySlashAmount
    "function felonySlashAmount() public view returns (uint256)",     // default 200ADR, valid: > max(100, downtimeSlashAmount)
    "function downtimeJailTime() public view returns (uint256)",      // default 2days, 
    "function felonyJailTime() public view returns (uint256)"         // default 30days, 
]

const validatorSet = new ethers.Contract(addrValidatorSet, validatorSetAbi, provider);
const slashIndicator = new ethers.Contract(addrSlash, slashAbi,  provider)
const stakeHub = new ethers.Contract(addrStakeHub, stakeHubAbi, provider)

const validatorMap = new Map([
    // ADR mainnet
    ["0x37e9627A91DD13e453246856D58797Ad6583D762", "Adera"],
    ["0xB4647b856CB9C3856d559C885Bed8B43e0846a47", "Adera0"],
]);



// 1.cmd: "GetMaxTxCountInBlockRange", usage:
// node getchainstatus.js GetMaxTxCountInBlockRange --rpc http://localhost:8545 \
//      --startNum 40000001  --endNum 40000005 \
//      --miner(optional): specified: find the max txCounter from the specified validator,
//                         not specified: find the max txCounter from all validators
async function getMaxTxCountInBlockRange()  {
    let txCount = 0;
    let num = 0;
    console.log("Find the max txs count between", program.startNum, "and", program.endNum);
    for (let i = program.startNum; i < program.endNum; i++) {
        if (program.miner !== "") {
            let blockData = await provider.getBlock(Number(i))
            if (program.miner !== blockData.miner) {
                continue
            }
        }
        let x = await provider.send("eth_getBlockTransactionCountByNumber", [
            ethers.toQuantity(i)]);
        let a = ethers.toNumber(x)
        if (a > txCount) {
            num = i;
            txCount = a;
        }
    }
    console.log("BlockNum = ", num, "TxCount =", txCount);
}

// 2.cmd: "GetBinaryVersion", usage:
// node getchainstatus.js GetBinaryVersion \
//      --rpc http://localhost:8545 \
//       --num(optional): default 21, the number of blocks that will be checked
//       --turnLength(optional): default 4, the consecutive block length
async function getBinaryVersion()  {
    const blockNum = await provider.getBlockNumber();
    let turnLength = program.turnLength
    for (let i = 0; i < program.num; i++) {
        let blockData = await provider.getBlock(blockNum - i*turnLength);
        // 1.get Geth client version
        let major = ethers.toNumber(ethers.dataSlice(blockData.extraData, 2, 3))
        let minor = ethers.toNumber(ethers.dataSlice(blockData.extraData, 3, 4))
        let patch = ethers.toNumber(ethers.dataSlice(blockData.extraData, 4, 5))

        // 2.get minimum txGasPrice based on the last non-zero-gasprice transaction
        let lastGasPrice = 0
        for  (let txIndex = blockData.transactions.length - 1; txIndex >= 0; txIndex--) {
            let txHash = blockData.transactions[txIndex]
            let txData =  await provider.getTransaction(txHash);
            if (txData.gasPrice == 0) {
                continue
            }
            lastGasPrice = txData.gasPrice
            break
        }
        var moniker = await getValidatorMoniker(blockData.miner, blockNum)
        console.log(blockNum - i*turnLength, blockData.miner, "version =", major + "." + minor + "." + patch, " MinGasPrice = " + lastGasPrice, moniker)
    }
};

// 3.cmd: "GetTopAddr", usage:
// node getchainstatus.js GetTopAddr \
//      --rpc http://localhost:8545 \
//      --startNum 40000001  --endNum 40000005 \
//      --topNum(optional): the top num of address to be displayed, default 20
function getTopKElements(map, k) {
    let entries = Array.from(map.entries());
    entries.sort((a, b) => b[1] - a[1]);
    return entries.slice(0, k);
}

async function getTopAddr()  {
    let countMap = new Map();
    let totalTxs = 0
    console.log("Find the top target address, between", program.startNum, "and", program.endNum);
    for (let i = program.startNum; i <= program.endNum; i++) {
        let blockData = await provider.getBlock(Number(i), true)
        totalTxs += blockData.transactions.length
        for  (let txIndex = blockData.transactions.length - 1; txIndex >= 0; txIndex--) {
            let txData = await blockData.getTransaction(txIndex)
            if (txData.to == null) {
                console.log("Contract creation,txHash:", txData.hash)
                continue
            }
            let toAddr = txData.to;
            if (countMap.has(toAddr)) {
                countMap.set(toAddr, countMap.get(toAddr) + 1);
            } else {
                countMap.set(toAddr, 1);
            }
        }
        console.log("progress:", (program.endNum-i), "blocks left", "totalTxs", totalTxs)
    }
    let tops = getTopKElements(countMap, program.topNum)
    tops.forEach((value, key) => {
        // value: [ '0x40661F989826CC641Ce1601526Bb16a4221412c8', 71 ]
        console.log(key+":", value[0], " ", value[1], " ", ((value[1]*100)/totalTxs).toFixed(2)+"%");
      });
};

// 4.cmd: "GetSlashCount", usage:
// node getchainstatus.js GetSlashCount \
//      --rpc http://localhost:8545 \
//      --blockNum(optional): the block num which is based for the slash state, default: latest block
async function getValidatorMoniker(consensusAddr, blockNum) {
    if (validatorMap.has(consensusAddr)) {
        return validatorMap.get(consensusAddr)
    }
    let opAddr = await stakeHub.consensusToOperator(consensusAddr, {blockTag:blockNum})
    let desc = await stakeHub.getValidatorDescription(opAddr, {blockTag:blockNum})
    let moniker = desc[0]
    console.log(consensusAddr, moniker)
    return moniker
}

async function getSlashCount()  {
        let blockNum = ethers.getNumber(program.blockNum)
        if (blockNum === 0) {
           blockNum = await provider.getBlockNumber()
        }
        let slashScale = await validatorSet.maintainSlashScale({blockTag:blockNum})
        let maxElected = await stakeHub.maxElectedValidators({blockTag:blockNum})
        const maintainThreshold = BigInt(50)  // governable, hardcode to avoid one RPC call
        const felonyThreshold = BigInt(150)   // governable, hardcode to avoid one RPC call

        let block = await provider.getBlock(blockNum)
        console.log("At block", blockNum, "time", block.date)
        const data = await validatorSet.getLivingValidators({blockTag:blockNum})
        let totalSlash = 0
        for (let i = 0; i < data[0].length; i++) {
            let addr = data[0][i];
            var moniker = await getValidatorMoniker(addr, blockNum)
            let info = await slashIndicator.getSlashIndicator(addr, {blockTag:blockNum})
            let slashHeight = ethers.toNumber(info[0])
            let slashCount = ethers.toNumber(info[1])
            totalSlash += slashCount
            console.log("Slash:", slashCount, addr, moniker, slashHeight)
            if (slashCount >= maintainThreshold) {
                let validatorExtra = await validatorSet.validatorExtraSet(i, {blockTag:blockNum})
                let enterMaintenanceHeight = validatorExtra[0]
                let isMaintaining = validatorExtra[1]
                // let voteAddress = validatorExtra[2]
                if (isMaintaining) {
                    let jailHeight = (felonyThreshold - BigInt(slashCount)) * slashScale * maxElected + BigInt(enterMaintenanceHeight)
                    console.log("          in maintenance mode since", enterMaintenanceHeight, "will jail after", ethers.toNumber(jailHeight))    
                } else {
                    console.log("          exited maintenance mode")
                }
            }
        }
        console.log("Total slash count", totalSlash)
};

// 5.cmd: "getPerformanceData", usage:
// node getchainstatus.js getPerformanceData \
//      --rpc http://localhost:8545 \
//      --startNum 40000001  --endNum 40000005
async function getPerformanceData()  {
    let txCountTotal = 0;
    let gasUsedTotal = 0;
    let inturnBlocks = 0;
    let justifiedBlocks = 0;
    let turnLength = 1;
    let parliaEnabled = true;
    try  {
        turnLength = await provider.send("parlia_getTurnLength", [ethers.toQuantity(program.startNum)]);
    } catch (error) {
        // the "parlia" module was not enabled for RPC call
        parliaEnabled = false
        console.log("parlia RPC modudle is not enabled\n", error);
    }

    for (let i = program.startNum; i < program.endNum; i++) {
        let txCount = await provider.send("eth_getBlockTransactionCountByNumber", [
            ethers.toQuantity(i)]);
        txCountTotal += ethers.toNumber(txCount)

        let header = await provider.send("eth_getHeaderByNumber", [
            ethers.toQuantity(i)]);
        let gasUsed = eval(eval(header.gasUsed).toString(10))
        gasUsedTotal += gasUsed
        let difficulty = eval(eval(header.difficulty).toString(10))
        if (difficulty == 2) {
            inturnBlocks += 1
        }
        let timestamp = eval(eval(header.timestamp).toString(10))
        if (parliaEnabled) {
            let justifiedNumber = await provider.send("parlia_getJustifiedNumber", [ethers.toQuantity(i)]);
            if (justifiedNumber + 1 == i) {
                justifiedBlocks += 1
            } else {
                console.log("justified unexpected", "BlockNumber =", i,"justifiedNumber",justifiedNumber)    
            }
        }
        console.log("BlockNumber =", i, "mod =", i%turnLength, "miner =", header.miner , "difficulty =", difficulty, "txCount =", ethers.toNumber(txCount), "gasUsed", gasUsed, "timestamp", timestamp)
    }
    let blockCount = program.endNum - program.startNum
    let txCountPerBlock = txCountTotal/blockCount

    let startHeader = await provider.send("eth_getHeaderByNumber", [
        ethers.toQuantity(program.startNum)]);
    let startTime = eval(eval(startHeader.timestamp).toString(10))
    let endHeader = await provider.send("eth_getHeaderByNumber", [
        ethers.toQuantity(program.endNum)]);
    let endTime = eval(eval(endHeader.timestamp).toString(10))
    let timeCost = endTime - startTime
    let avgBlockTime = timeCost/blockCount
    let inturnBlocksRatio = inturnBlocks/blockCount
    let justifiedBlocksRatio = justifiedBlocks/blockCount
    let tps = txCountTotal/timeCost
    let M = 1000000
    let avgGasUsedPerBlock = gasUsedTotal/blockCount/M
    let avgGasUsedPerSecond = gasUsedTotal/timeCost/M

    console.log("Get the performance between [", program.startNum, ",", program.endNum, ")");
    console.log("txCountPerBlock =", txCountPerBlock, "txCountTotal =", txCountTotal, "BlockCount =", blockCount, "avgBlockTime =", avgBlockTime, "inturnBlocksRatio =", inturnBlocksRatio, "justifiedBlocksRatio =", justifiedBlocksRatio);
    console.log("txCountPerSecond =", tps, "avgGasUsedPerBlock =", avgGasUsedPerBlock, "avgGasUsedPerSecond =", avgGasUsedPerSecond);
};

// 6.cmd: "GetBlobTxs", usage:
// node getchainstatus.js GetBlobTxs \
//      --rpc http://localhost:8545 \
//      --startNum 40000001  --endNum 40000005
// depends on ethjs v6.11.0+ for 4844, https://github.com/ethers-io/ethers.js/releases/tag/v6.11.0
// ADR mainnet enabled 4844 on block: 8
async function getBlobTxs()  {
    var startBlock = parseInt(program.startNum)
    var endBlock = parseInt(program.endNum)
    if (isNaN(endBlock) || isNaN(startBlock) || startBlock == 0) {
        console.error("invalid input, --startNum", program.startNum, "--end", program.endNum)
        return
    }
    // if --endNum is not specified, set it to the latest block number.
    if (endBlock == 0) {
        endBlock = await provider.getBlockNumber();
    }
    if (startBlock > endBlock) {
        console.error("invalid input, startBlock:",startBlock, " endBlock:", endBlock);
        return
    }

    for (let i = startBlock; i <= endBlock; i++) {
        let blockData = await provider.getBlock(i);
        console.log("startBlock:",startBlock, "endBlock:", endBlock, "curBlock", i, "blobGasUsed", blockData.blobGasUsed);
        if (blockData.blobGasUsed == 0) {
            continue
        }
        for  (let txIndex = 0; txIndex<= blockData.transactions.length - 1; txIndex++) {
            let txHash = blockData.transactions[txIndex]
            let txData =  await provider.getTransaction(txHash);
            if (txData.type == 3) {
                console.log("BlobTx in block:",i, " txIndex:", txIndex, " txHash:", txHash);
            }
        }
    }
};

// 7.cmd: "GetFaucetStatus", usage:
// node getchainstatus.js GetFaucetStatus \
//      --rpc http://localhost:8545 \
//      --startNum 40000001  --endNum 40000005
async function getFaucetStatus()  {
    var startBlock = parseInt(program.startNum)
    var endBlock = parseInt(program.endNum)
    if (isNaN(endBlock) || isNaN(startBlock) || startBlock == 0) {
        console.error("invalid input, --startNum", program.startNum, "--end", program.endNum)
        return
    }
    // if --endNum is not specified, set it to the latest block number.
    if (endBlock == 0) {
        endBlock = await provider.getBlockNumber();
    }
    if (startBlock > endBlock) {
        console.error("invalid input, startBlock:",startBlock, " endBlock:", endBlock);
        return
    }

    let startBalance = await provider.getBalance("0xaa25Aa7a19f9c426E07dee59b12f944f4d9f1DD3", startBlock)
    let endBalance = await provider.getBalance("0xaa25Aa7a19f9c426E07dee59b12f944f4d9f1DD3", endBlock)
    const faucetAmount = BigInt(0.3 * 10**18); // Convert 0.3 ether to wei as a BigInt
    const numFaucetRequest = (startBalance - endBalance) / faucetAmount;

    // Convert BigInt to ether
    const startBalanceEth = Number(startBalance) / 10**18;
    const endBalanceEth = Number(endBalance) / 10**18;

    console.log(`Start Balance: ${startBalanceEth} ETH`);
    console.log(`End Balance: ${endBalanceEth} ETH`);

    console.log("successful faucet request: ",numFaucetRequest);
};


// 8.cmd: "GetKeyParameters", usage:
// node getchainstatus.js GetKeyParameters \
//      --rpc http://localhost:8545 \
//      --blockNum(optional): the block num which is based for the slash state, default: latest block
async function getKeyParameters()  {
    let blockNum = ethers.getNumber(program.blockNum)
    if (blockNum === 0) {
       blockNum = await provider.getBlockNumber()
    }
    let block = await provider.getBlock(blockNum)
    console.log("At block", blockNum, "time", block.date)

    // part 1: validatorset
    let numOfCabinets = await validatorSet.numOfCabinets({blockTag:blockNum})
    if (numOfCabinets == 0) {        numOfCabinets = 21    }
    // let maxNumOfCandidates = await validatorSet.maxNumOfCandidates({blockTag:blockNum})  // deprecated
    // let turnLength = await validatorSet.turnLength({blockTag:blockNum})
    let maxNumOfWorkingCandidates = await validatorSet.maxNumOfWorkingCandidates({blockTag:blockNum})
    let maintainSlashScale = await validatorSet.maintainSlashScale({blockTag:blockNum})
    console.log("numOfCabinets", Number(numOfCabinets), "maxNumOfWorkingCandidates", Number(maxNumOfWorkingCandidates),
                "maintainSlashScale", maintainSlashScale)

    // part 2: staking
    // let minSelfDelegationADR = await stakeHub.minSelfDelegationADR({blockTag:blockNum})/BigInt(10**18)
    let maxElectedValidators = await stakeHub.maxElectedValidators({blockTag:blockNum})
    let validatorElectionInfo = await stakeHub.getValidatorElectionInfo(0,0,{blockTag:blockNum})
    let consensusAddrs = validatorElectionInfo[0]
    let votingPowers = validatorElectionInfo[1]
    let voteAddrs = validatorElectionInfo[2]
    let totalLength = validatorElectionInfo[3]
    console.log("maxElectedValidators", Number(maxElectedValidators), "Registered", Number(totalLength))
    let validatorTable = []
    for (let i = 0; i < totalLength; i++) {
        validatorTable.push({
                addr: consensusAddrs[i],
                votingPower: Number(votingPowers[i]/BigInt(10**18)),
                voteAddr: voteAddrs[i],
                moniker: await getValidatorMoniker(consensusAddrs[i], blockNum)
            })
    }
    validatorTable.sort((a, b) => b.votingPower - a.votingPower);
    console.table(validatorTable)
}

// 9.cmd: "getEip7623", usage:
// node getEip7623.js GetEip7623 \
//      --rpc http://localhost:8545 \
//      --startNum 40000001  --endNum 40000005
async function getEip7623()  {
    var startBlock = parseInt(program.startNum)
    var endBlock = parseInt(program.endNum)
    if (isNaN(endBlock) || isNaN(startBlock) || startBlock === 0) {
        console.error("invalid input, --startNum", program.startNum, "--end", program.endNum)
        return
    }
    // if --endNum is not specified, set it to the latest block number.
    if (endBlock === 0) {
        endBlock = await provider.getBlockNumber();
    }
    if (startBlock > endBlock) {
        console.error("invalid input, startBlock:",startBlock, " endBlock:", endBlock);
        return
    }

    const startTime = Date.now();

    const TOTAL_COST_FLOOR_PER_TOKEN = 10
    const intrinsicGas = 21000
    for (let blockNumber = startBlock; blockNumber <= endBlock; blockNumber++) {
        const block = await provider.getBlock(blockNumber, true);

        for (let txHash of block.transactions) {
            let tx = block.getPrefetchedTransaction(txHash)
            const receipt = await provider.getTransactionReceipt(tx.hash);
            let tokens_in_calldata = -4; // means '0x'
            let calldata = tx.data;
            for (let i = 0; i < calldata.length; i += 2) {
                const byte = parseInt(calldata.substr(i, 2), 16);
                if (byte === 0) {
                    tokens_in_calldata++;
                } else {
                    tokens_in_calldata = tokens_in_calldata + 4;
                }
            }
            let  want = TOTAL_COST_FLOOR_PER_TOKEN  * tokens_in_calldata + intrinsicGas
            if (want > receipt.gasUsed) {
                console.log("Cost more gas, blockNum:", tx.blockNumber, "txHash", tx.hash, " gasUsed", receipt.gasUsed.toString(), " New GasUsed", want)
            }
        }
    }
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    console.log(`Script executed in: ${duration} seconds`);
}

const main = async () => {
    if (process.argv.length <= 2) {
        console.error('invalid process.argv.length', process.argv.length);
        printUsage()
        return
    }
    const cmd =  process.argv[2]
    if (cmd == "-h" || cmd == "--help") {
        printUsage()
        return
    }
    if (cmd === "GetMaxTxCountInBlockRange") {
        await getMaxTxCountInBlockRange()
    } else if (cmd === "GetBinaryVersion") {
        await getBinaryVersion()
    } else if (cmd === "GetTopAddr") {
        await getTopAddr()
    } else if (cmd === "GetSlashCount") {
        await getSlashCount()
    } else if (cmd === "GetPerformanceData") {
        await getPerformanceData()
    } else if (cmd === "GetBlobTxs") {
        await getBlobTxs()
    } else if (cmd === "GetFaucetStatus") {
        await getFaucetStatus()
    } else if (cmd === "GetKeyParameters") {
        await getKeyParameters()
    } else if (cmd === "GetEip7623"){
        await getEip7623()
    } else {
        console.log("unsupported cmd", cmd);
        printUsage()
    }
}

main().then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });