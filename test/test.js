const Currency = artifacts.require("./bankcurrency");
const Bank = artifacts.require("./ethbank");
//EVM error. Undoing all state changes.
const EVM_REVERT = 'VM Exception while processing transaction: revert'
//Big numbers
const toBN = web3.utils.toBN;
//helper function
const delay = s => {
  const milliseconds = s * 1000
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}


require('chai')
  .use(require('chai-as-promised'))
  .should()

contract('ethbank', ([deployer, user]) => {
  let ethbank, currency

  beforeEach(async () => {
    currency = await Currency.new()
    ethbank = await Bank.new(currency.address)
    
    const minterRole = await currency.MINTER_ROLE();
    await currency.grantRole(minterRole, ethbank.address, {from: deployer})
    const burnerRole = await currency.BURNER_ROLE();
    await currency.grantRole(burnerRole, ethbank.address, {from: deployer})
  });

  describe('testing currency contract...', () => {
    describe('on successful deploy', () => {
      it('checking currency name', async () => {
        expect(await currency.name()).to.be.eq('ETH Bank Currency')
      });

      it('checking currency symbol', async () => {
        expect(await currency.symbol()).to.be.eq('ETHB')
      });

      it('checking currency initial total supply', async () => {
        expect(Number(await currency.totalSupply())).to.eq(0)
      });

      it('ETH Bank should have minter and burner role', async () => {
        const MINTER_ROLE = await currency.MINTER_ROLE();
        const BURNER_ROLE = await currency.BURNER_ROLE();
        expect(await currency.hasRole(MINTER_ROLE, ethbank.address)).to.eq(true);
        expect(await currency.hasRole(BURNER_ROLE, ethbank.address)).to.eq(true);
      });

    });

    describe('failure', () => {

      it('minting currency should be rejected if address is different than ethbank address', async () => {
        await currency.mint(user, '1', {from: deployer}).should.be.rejectedWith(EVM_REVERT) //unauthorized minter
      });
    });
  });

  describe('testing depositEth function...', () => {
    let balance

    describe('successful transaction', () => {
      beforeEach(async () => {
        await ethbank.depositEth(false, {value: toBN(1e18), from: user}) //1e18 == 1 ETH
      });

      it('user balance should increase', async () => {
        expect(Number(await ethbank.etherBalanceOf(user))).to.eq(Number(toBN(1e18)))
      });

      it('deposit time should start', async () => {
        expect(Number(await ethbank.depositStart(user))).to.be.above(0)
      });

      it('deposit status should be true', async () => {
        expect(await ethbank.depositers(user)).to.eq(true)
      });
    });

    describe('unsuccessful transaction', () => {
      it('depositing should be rejected', async () => {
        await ethbank.depositEth(false, {value: 1e15, from: user}).should.be.rejectedWith(EVM_REVERT) //to small amount
      });
    });
    describe('testing collateral deposit', () => {
      it('collateral should be add to collaterals mapping', async () => {
        await ethbank.depositEth(true, {value: toBN(1e18), from: user})
        expect(Number(await ethbank.collaterals(user))).to.eq(Number(toBN(1e18)))
      });
    });
  });

  describe('testing withdrawEth function', () => {
    let balance

    describe('withdrawing all ether', () => {

      beforeEach(async () => {
        await ethbank.depositEth(false, {value: toBN(1e18), from: user}) //1 ETH
        balance = await web3.eth.getBalance(ethbank.address)
        await ethbank.withdrawEth(toBN(1e18), {from: user})
      });

      it('balances should decrease', async () => {
        expect(Number(await web3.eth.getBalance(ethbank.address))).to.eq(0)
        expect(Number(await ethbank.etherBalanceOf(user))).to.eq(0)
      });

      it('user should receive ether back', async () => {
        expect(Number(await web3.eth.getBalance(user))).to.be.above(Number(balance))
      });

      it('user should receive proper amount of interest', async () => {
        //time synchronization problem may occur. Use 'wait' helper function for different times
        await delay(5)
        balance = Number(await currency.balanceOf(user))
        expect(balance).to.be.above(0)

      it('depositer data should be reseted', async () => {
        expect(Number(await ethbank.depositStart(user))).to.eq(0)
        expect(Number(await ethbank.etherBalanceOf(user))).to.eq(0)
        expect(await ethbank.depositers(user)).to.eq(false)
      })
    });

    describe('withdrawing some ether', () => {

      beforeEach(async () => {
        await ethbank.depositEth(false, {value: toBN(1e18), from: user}) //1 ETH
        balance = await web3.eth.getBalance(ethbank.address)
        await ethbank.withdrawEth(toBN(2e17), {from: user})
      });

      it('balances should decrease', async () => {
        expect(Number(await web3.eth.getBalance(ethbank.address))).to.eq(Number(toBN(8e17)))
        expect(Number(await ethbank.etherBalanceOf(user))).to.eq(Number(toBN(8e17)))
      });

      it('user should receive proper amount of interest', async () => {
        //time synchronization problem may occur. Use 'delay' helper function for different times
        await delay(5)
        balance = Number(await currency.balanceOf(user))
        expect(balance).to.be.above(0)
      })

      it('depositer data should not be reseted', async () => {
        expect(Number(await ethbank.depositStart(user))).to.not.eq(0)
        expect(Number(await ethbank.etherBalanceOf(user))).to.not.eq(0)
        expect(await ethbank.depositers(user)).to.eq(true)
      })
    });

    describe('unsuccessful transaction', () => {
      it('withdrawing should be rejected', async () =>{
        await ethbank.depositEth(false, {value: toBN(1e16), from: user}) //0.01 ETH
        await delay(2) //accruing interest
        await ethbank.withdrawEth(toBN(1e16), {from: deployer}).should.be.rejectedWith(EVM_REVERT) //wrong user
      });

      it('withdrawing should be rejected if deposit is collateral', async () =>{
        await ethbank.depositEth(true, {value: toBN(1e16), from: user}) //0.01 ETH
        await delay(2) //accruing interest
        await ethbank.withdrawEth(toBN(1e16), {from: user}).should.be.rejectedWith(EVM_REVERT) //collateral
      });
    });
  });


  describe('testing borrowCurrency function', () => {
    describe('successful transaction', () => {
      beforeEach(async () => {
        await ethbank.depositEth(true, {value: 1e16, from: user})
        await ethbank.borrowCurrency({from: user})
      })

      it('currency token total supply should increase', async () => {
        expect(Number(await currency.totalSupply())).to.eq(5*(1e15))
      });

      it('currency tokens user balance should increase', async () => {
        expect(Number(await currency.balanceOf(user))).to.eq(5*(1e15))
      });

      it('collaterals should increase', async () => {
        expect(Number(await ethbank.collaterals(user))).to.eq(1e16) //0.01 ETH
      })

      it('user isBorrowed status should be true', async () => {
        expect(await ethbank.isBorrowed(user)).to.eq(true)
      })
    });

    describe('unsuccessful transaction', () => {
      it('borrowing should be rejected', async () => {
        await ethbank.borrowCurrency({value: 1e14, from: user}).should.be.rejectedWith(EVM_REVERT)})
    });
  });

  describe('testing function repayBorrow', () => {
      describe('successful transaction', () => {
        beforeEach(async () => {
          await ethbank.depositEth(true, {value: 1e16, from: user})
          await delay(1)
          await ethbank.borrowCurrency({from: user})
          await delay(1)
          await currency.approve(ethbank.address, 5e15, {from: user})
          await delay(1)
          await ethbank.repayBorrow({from: user})
        });

        it('user currency tokens balance should be 0', async () => {
          expect(Number(await currency.balanceOf(user))).to.eq(0);
        });

        it('ethbank should get fee', async () => {
          expect(Number(await web3.eth.getBalance(ethbank.address))).to.eq(1e13);
        });

        it('borrower data should be reseted', async () => {
          expect(Number(await ethbank.collaterals(user))).to.eq(0)
          expect(await ethbank.isBorrowed(user)).to.eq(false)
        });
      });
    });
  });
});