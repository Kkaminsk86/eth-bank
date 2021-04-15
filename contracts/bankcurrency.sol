// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/// @title Banking currency contract. ERC20 standard
/// @dev Burner role added for future contract functionalities
contract BankCurrency is ERC20, AccessControl {
    //add MINTER_ROLE
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    //add BURNER_ROLE
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    constructor() payable ERC20("ETH Bank Currency", "ETHB") {
        
        //Granting default_admin role to currency contract deployer
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function mint(address account, uint256 amount) public {
        //check if msg.sender have MINTER_ROLE
        require(
            hasRole(MINTER_ROLE, msg.sender),
            "Error, msg.sender does not have MINTER_ROLE"
        );
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        //check if msg.sender have BURNER_ROLE
        require(
            hasRole(BURNER_ROLE, msg.sender),
            "Error, msg.sender does not have BURNER_ROLE"
        );
        _burn(account, amount);
    }
}
