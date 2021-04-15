const Currency = artifacts.require("bankcurrency");
const Bank = artifacts.require("ethbank");

module.exports = async function(deployer) {
	//deploying currency contract
	await deployer.deploy(Currency);
	//assigning token currency contract into variable to get it's address
	const currency = await Currency.deployed();
	//pass currency contract address for ETH Bank contract(for minting purposes)
	await deployer.deploy(Bank, currency.address);
	//assign ETH Bank contract into variable to get it's address
	const ethbank = await Bank.deployed();
	//granting minter and burner roles from deployer to ETH Bank
	const minterRole = await currency.MINTER_ROLE();
	await currency.grantRole(minterRole, ethbank.address);
	const burnerRole = await currency.BURNER_ROLE();
	await currency.grantRole(burnerRole, ethbank.address);
};