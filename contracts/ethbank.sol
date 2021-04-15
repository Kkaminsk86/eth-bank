// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./bankcurrency.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/// @title Ethereum bank with erc20 currency
contract ethBank {
    using Address for address payable;
    using SafeMath for uint256;
    //assigning currency contract to variable
    BankCurrency private currency;
    //Constant - seconds in one year
    uint256 public constant secondsPerYear = 31536000;
    //Constant - borrow rate = 0.1%
    uint256 public constant borrowRate = 10;
    
    //MAPPINGS
    mapping(address => uint256) public etherBalanceOf;
    mapping(address => bool) public depositers;
    mapping(address => uint256) public collaterals;
    mapping(address => bool) public hasCollateral;
    mapping(address => uint256) public depositStart;
    mapping(address => bool) public isBorrowed;

    //EVENTS
    event Deposited(
        address indexed user,
        uint256 etherAmount,
        uint256 depositStart,
        bool isCollateral
    );
    event Withdrawn(
        address indexed user, 
        uint256 etherAmount, 
        uint256 profit
    );
    event Borrowed(address indexed user, uint256 borrowedTokens);
    event BorrowRepayed(address indexed user, uint256 fee);

    //passing currency contract in the constructor function
    constructor(BankCurrency _currency) {
        //assign currency deployed contract to variable
        currency = _currency;
    }

    /// @param _collateral bool if true store as collateral
    function depositEth(bool _collateral) external payable {
        //Collaterals have no interest gaining
        if (_collateral == true) {
            require(
                msg.value >= 1e15,
                "Error, amount of collateral must be >= 0.001 ETH"
            );
            collaterals[msg.sender] = collaterals[msg.sender].add(msg.value);
            hasCollateral[msg.sender] = true;
        } else {
            //check if ether value is >= than 0.01 ETH
            require(msg.value >= 1e16, "Error, amount of ether must be >= 0.01 ETH");
            //check if user isn't a depositer
            require(
                depositers[msg.sender] == false,
                "Error, user already deponed ether"
            );
            //adding msg.sender to depositers mapping
            depositers[msg.sender] = true;
            //increase msg.sender ether deposit balance
            etherBalanceOf[msg.sender] = etherBalanceOf[msg.sender].add(
                msg.value
            );
            //start deposit time
            depositStart[msg.sender] = depositStart[msg.sender].add(
                block.timestamp
            );
        }
        //emitting Deposited event
        emit Deposited(msg.sender, msg.value, block.timestamp, _collateral);
    }

    /// @param _amount desired amount to withdraw
    function withdrawEth(uint256 _amount) external {
        //check if user have deposit in bank
        require(depositers[msg.sender], "No ether deponed");
        //check if desired amount is not >= user balance
        require(etherBalanceOf[msg.sender] >= _amount, "Insufficient funds");
        uint256 withdrawAmount = _amount;
        uint256 depositStartTime = depositStart[msg.sender];
        //if amount to withdraw equals user balance then reset 
        if (_amount == etherBalanceOf[msg.sender]) {
            withdrawAmount = etherBalanceOf[msg.sender];
            depositers[msg.sender] = false;
            depositStart[msg.sender] = 0;
        }
        //substracting withdraw amount from user balance
        etherBalanceOf[msg.sender] = etherBalanceOf[msg.sender].sub(
            withdrawAmount
        );

        uint256 depositTime = block.timestamp.sub(depositStartTime);
        //calculating profit per second
        uint256 interestPerSecond =
            secondsPerYear.mul((withdrawAmount.div(1e16)));
        //calculating accrued profit
        uint256 profitEarned = interestPerSecond.mul(depositTime);
        //sending ether to user
        msg.sender.sendValue(withdrawAmount);
        //sending profit to user
        currency.mint(msg.sender, profitEarned);
        //emit Withdrawn event
        emit Withdrawn(msg.sender, withdrawAmount, profitEarned);
    }

    function borrowCurrency() external {
        //check if loan is already taken
        require(!isBorrowed[msg.sender], "loan already taken");
        //check if msg.sender has collateral
        require(hasCollateral[msg.sender], "No collateral");
        //get borrow amount
        uint256 collateral = collaterals[msg.sender];
        uint256 tokenAmount = collateral.div(2);
        //mint currency tokens
        currency.mint(msg.sender, tokenAmount);
        //setting the borrow status
        isBorrowed[msg.sender] = true;
        //emit Borrow event
        emit Borrowed(msg.sender, tokenAmount);
    }

    function repayBorrow() external {
        //check if loan is active
        require(isBorrowed[msg.sender] == true, "Error, loan is not active");
        //transfering currency tokens from user to the eth bank contract
        uint256 collateral = collaterals[msg.sender];
        uint256 tokensToReturn = collateral.div(2);
        require(currency.transferFrom(msg.sender, address(this), tokensToReturn), "Error, can't receive tokens");
        //calculating borrow fee
        uint256 fee = collateral.mul(10).div(10000);
        //resetting user data
        collaterals[msg.sender] = 0;
        isBorrowed[msg.sender] = false;
        //sending collateral - fee to user
        msg.sender.sendValue(collateral.sub(fee));
        // emit BorrowRepayed event
        emit BorrowRepayed(msg.sender, fee);
    }

}
