const
	LOCAL_NODE_ADDRESS = "http://localhost:8946",
	NODE_0_WALLET = "0x40ead8d2363fbad416ee0f156a922dcad52ce321",
	NODE_1_WALLET = "0x0491615b945056a0a2015ca5678971628fa00fbe",
	NODE_2_WALLET = "0x70082f53d071fa0f1342345f94a838376c2540f8",
	POLLING_INTERVAL = 2000,
	TIME_TO_UNLOCK = 20000,
	TRIGGERING_VARIABLE_PERSISTENCY = 15000;

let
	Web3 = require("web3"),
	localNode,
	boxUser0Triggered = false,
	boxUser1Triggered = false,
	lockEnergised = false,
	unlockProgress = 0,
	nodeBattleState = "none",
	lastBlockNumber = 0,
	listOfTransactions = [],
	networkDifficulty = 0,
	node0WalletBalance = 0,
	node1WalletBalance = 0,
	node2WalletBalance = 0;

if (typeof localNode !== "undefined") {
	localNode = new Web3(web3.currentProvider);
} else {
	localNode = new Web3(new Web3.providers.HttpProvider(LOCAL_NODE_ADDRESS));
}

if(localNode.isConnected()) {
	pollNetworkForStats(localNode);
} else {
	console.log("Ethereum node not found.");
};

module.exports = function(State) {
	State.current = function(cb) {
		process.nextTick(function() {
			let stateJson = {
				"smartLock":
					{
						"boxUser0Triggered": boxUser0Triggered,
						"boxUser1Triggered": boxUser1Triggered,
						"lockEnergised": lockEnergised
					},
				"networkDifficulty": networkDifficulty,
				"nodeBattleState": nodeBattleState,
				"wallets":
					{
					"etherLeft":
						{
							"node0": node0WalletBalance,
							"node1": node1WalletBalance,
							"node2": node2WalletBalance
						}
					},
				"unlockProgress": unlockProgress,
				"recentTransactions": listOfTransactions
			};

			cb(null, stateJson);
		});
	};

	State.boxUser0Triggered = function(cb) {
		process.nextTick(function() {
			setBoxUser0Triggered();
			cb(null, {});
		});
	};

	State.boxUser1Triggered = function(cb) {
		process.nextTick(function() {
			setBoxUser1Triggered();
			cb(null, {});
		});
	};

	State.lockEnergised = function(cb) {
		process.nextTick(function() {
			console.log("Lock energised.");
			lockEnergised = true;
			setTimeout(function () {
					unlockProgress = 0;
				}, 2000);
			setTimeout(function () {
					lockEnergised = false;
				}, TRIGGERING_VARIABLE_PERSISTENCY);

			cb(null, {});
		});
	};

	State.unlockingTransaction = function(transactionObject, cb) {
		process.nextTick(function() {
			console.log("unlockingTransaction");
			console.log(transactionObject);
			listOfTransactions = enterNewTransaction(listOfTransactions, transactionObject.transactionHash, transactionObject.unlocker);
			cb(null, {});
		});
	};
};

function setBoxUser0Triggered () {
	console.log("User 0 trigger the unlocking process.");
	boxUser0Triggered = true;
	setTimeout(function () {
			boxUser0Triggered = false;
		}, TRIGGERING_VARIABLE_PERSISTENCY);

	startCountdownToUnlocking();
}

function setBoxUser1Triggered () {
	console.log("User 1 trigger the unlocking process.");
	boxUser1Triggered = true;
	setTimeout(function () {
			boxUser1Triggered = false;
		}, TRIGGERING_VARIABLE_PERSISTENCY);

	startCountdownToUnlocking();
}

function startCountdownToUnlocking () {
	if (boxUser0Triggered && boxUser1Triggered) {
		console.log("Countdown to unlocking started.");

		setInterval(function(){
			if (unlockProgress < 100) {
				unlockProgress++;
				console.log(unlockProgress + "% till unlocking.");
			} else {
				clearInterval(this);
			}

			if (lockEnergised) { clearInterval(this); };
		}, TIME_TO_UNLOCK/100);
	}
}

function enterNewTransaction (txList, txHash, txUnlocker) {
	let txDescription = "";

	if (txUnlocker == "0") {
		txDescription = "User A unlocking"
	} else if (txUnlocker == "1") {
		txDescription = "User B unlocking"
	}

	txList.push(
		{
			"hash": txHash,
			"blockHash": null,
			"confirmations": 0,
			"description": txDescription
		}
	);

	if (txList.length > 5) {
		txList.shift();
	}

	nodeBattleState = "none";

	return txList;
}

function calculateConfirmationsAndBlockHash (web3Node, txHash, lastBlockNumber) {
	let transaction = web3Node.eth.getTransaction(txHash);

	return {
		"confirmations": (transaction.blockNumber ? lastBlockNumber - transaction.blockNumber : 0),
		"blockHash": transaction.blockHash
	};
}

function pollNetworkForStats (web3Node) {
	setInterval(function(){
		let lastBlock = web3Node.eth.getBlock("latest");

		// Network stats
		lastBlockNumber = lastBlock.number;
		networkDifficulty = lastBlock.totalDifficulty;

		// Node wallet ballances
		node0WalletBalance = web3Node.fromWei(web3Node.eth.getBalance(NODE_0_WALLET), 'ether');
		node1WalletBalance = web3Node.fromWei(web3Node.eth.getBalance(NODE_1_WALLET), 'ether');
		node2WalletBalance = web3Node.fromWei(web3Node.eth.getBalance(NODE_2_WALLET), 'ether');

		// Transaction confirmations and their block hashes
		for (let i = 0; i < listOfTransactions.length; i++) {
			let confirmationsAndBlockHash = calculateConfirmationsAndBlockHash(web3Node, listOfTransactions[i].hash, lastBlockNumber);

			listOfTransactions[i].confirmations =  confirmationsAndBlockHash.confirmations;
			listOfTransactions[i].blockHash =  confirmationsAndBlockHash.blockHash;
		}

		// Nodes battling for a transaction
		if (listOfTransactions.length > 0) {
			nodeBattleState = computeNodeBattleState(web3Node, listOfTransactions[listOfTransactions.length - 1].blockHash);
		};
	}, POLLING_INTERVAL);
}

function computeNodeBattleState (web3Node, blockHash) {
	let winningMiner = blockHash && blockHash != "0x0000000000000000000000000000000000000000000000000000000000000000" ? web3Node.eth.getBlock(blockHash).miner : null;

	if (winningMiner == NODE_0_WALLET) {
		return "1";
	} else if (winningMiner == NODE_1_WALLET) {
		return "2";
	} else {
		return "battling";
	}
}
