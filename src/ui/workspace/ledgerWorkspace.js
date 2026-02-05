// Ledger Workspace Manager
// This sits BETWEEN UI_STATE and Tabulator
// Enables instant account switching & transaction movement without full page re-renders

window.LedgerWorkspace = (function () {

  const store = {
    ledgers: {},          // accountId -> transactions[]
    activeAccountId: null,
    initialized: false
  };

  // Virtual suspense ledger for unassigned transactions
  const TEMP_ACCOUNT_ID = "0000";

  function log(...args){
    console.log("[LedgerWorkspace]", ...args);
  }

  // Build ledger store from RoboLedger engine
  function buildFromEngine() {
    log("Building workspace from Ledger engine");

    const allTx = window.RoboLedger.Ledger.getAll();

    store.ledgers = {};
    store.ledgers[TEMP_ACCOUNT_ID] = [];

    allTx.forEach(tx => {
      const acc = tx.account_id || TEMP_ACCOUNT_ID;

      if (!store.ledgers[acc]) {
        store.ledgers[acc] = [];
      }

      store.ledgers[acc].push(tx);
    });

    store.initialized = true;
    log("Workspace built. Ledgers:", Object.keys(store.ledgers));
  }

  function getLedger(accountId){
    return store.ledgers[accountId] || [];
  }

  function getAllLedgers(){
    return store.ledgers;
  }

  return {
    buildFromEngine,
    getLedger,
    getAllLedgers,
    TEMP_ACCOUNT_ID,
    store
  };

})();

// STEP 2: Account Switch Engine
LedgerWorkspace.switchAccount = function(accountId){

  if(!window.txnTable){
    console.warn("Grid not ready yet");
    return;
  }

  const data = LedgerWorkspace.getLedger(accountId);

  console.log("Switching to ledger:", accountId, "Rows:", data.length);

  window.txnTable.setData(data);

  UI_STATE.selectedAccount = accountId;
};

// STEP 3: Transaction Movement Engine
LedgerWorkspace.moveTransaction = function(txId, targetAccountId){

  const ledgers = LedgerWorkspace.store.ledgers;

  let foundTx = null;
  let sourceLedger = null;

  // Find transaction in any ledger
  Object.keys(ledgers).forEach(accId => {
    const index = ledgers[accId].findIndex(t => t.tx_id === txId);
    if(index !== -1){
      foundTx = ledgers[accId][index];
      sourceLedger = accId;
      ledgers[accId].splice(index, 1);  // Remove from source
    }
  });

  if(!foundTx){
    console.error("Transaction not found:", txId);
    return;
  }

  foundTx.account_id = targetAccountId;

  if(!ledgers[targetAccountId]){
    ledgers[targetAccountId] = [];
  }

  ledgers[targetAccountId].push(foundTx);

  // Refresh current grid instantly
  LedgerWorkspace.switchAccount(UI_STATE.selectedAccount);
};
