import { getStore, writeStore } from "../data/store.js";
import { createAuditEntry } from "../lib/audit.js";
import { readBody } from "../lib/readBody.js";
import { sendJson } from "../lib/sendJson.js";
import { createTransaction } from "../lib/transactions.js";

function findAccount(store, accountId) {
  return store.accounts.find((account) => account.account_id === accountId) || null;
}

function findCardByAccount(store, accountId) {
  return store.cards.find((card) => card.account_id === accountId) || null;
}

function okResponse(action, message, data, audit) {
  return {
    ok: true,
    action,
    message,
    data,
    audit_id: audit.audit_id
  };
}

function errorResponse(res, action, message, errorCode) {
  sendJson(res, 400, {
    ok: false,
    action,
    message,
    error_code: errorCode
  });
}

function handleBalanceView(store, body) {
  const account = findAccount(store, body.account_id);
  if (!account) {
    return { error: ["balance_view", "Account not found", "ACCOUNT_NOT_FOUND"] };
  }

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: account.account_id,
    action: "balance_view"
  });

  return {
    body: okResponse("balance_view", "Balance retrieved", { account }, audit)
  };
}

function handleDeposit(store, body) {
  const account = findAccount(store, body.account_id);
  const amount = Number(body.amount || 0);

  if (!account) {
    return { error: ["deposit_request", "Account not found", "ACCOUNT_NOT_FOUND"] };
  }
  if (amount <= 0) {
    return { error: ["deposit_request", "Invalid amount", "INVALID_AMOUNT"] };
  }

  account.balance += amount;

  createTransaction(store, {
    account_id: account.account_id,
    type: "DEPOSIT",
    amount,
    direction: "IN",
    memo: body.memo || "Deposit"
  });

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: account.account_id,
    action: "deposit_request",
    amount,
    memo: body.memo || "Deposit"
  });

  return {
    body: okResponse("deposit_request", "Deposit approved", { account }, audit)
  };
}

function handleWithdraw(store, body) {
  const account = findAccount(store, body.account_id);
  const amount = Number(body.amount || 0);

  if (!account) {
    return { error: ["withdraw_request", "Account not found", "ACCOUNT_NOT_FOUND"] };
  }
  if (amount <= 0) {
    return { error: ["withdraw_request", "Invalid amount", "INVALID_AMOUNT"] };
  }
  if (account.balance < amount) {
    return { error: ["withdraw_request", "Insufficient funds", "INSUFFICIENT_FUNDS"] };
  }

  account.balance -= amount;

  createTransaction(store, {
    account_id: account.account_id,
    type: "WITHDRAWAL",
    amount,
    direction: "OUT",
    memo: body.memo || "Withdrawal"
  });

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: account.account_id,
    action: "withdraw_request",
    amount,
    memo: body.memo || "Withdrawal"
  });

  return {
    body: okResponse("withdraw_request", "Withdrawal approved", { account }, audit)
  };
}

function handleTransfer(store, body) {
  const source = findAccount(store, body.account_id);
  const amount = Number(body.amount || 0);
  const targetName = body.target_name;
  const target = store.accounts.find((account) => account.customer_name === targetName) || null;

  if (!source) {
    return { error: ["transfer_request", "Source account not found", "ACCOUNT_NOT_FOUND"] };
  }
  if (!target) {
    return { error: ["transfer_request", "Target account not found", "TARGET_NOT_FOUND"] };
  }
  if (amount <= 0) {
    return { error: ["transfer_request", "Invalid amount", "INVALID_AMOUNT"] };
  }
  if (source.balance < amount) {
    return { error: ["transfer_request", "Insufficient funds", "INSUFFICIENT_FUNDS"] };
  }

  source.balance -= amount;
  target.balance += amount;

  createTransaction(store, {
    account_id: source.account_id,
    type: "TRANSFER",
    amount,
    direction: "OUT",
    memo: "Transfer to " + target.customer_name
  });

  createTransaction(store, {
    account_id: target.account_id,
    type: "TRANSFER",
    amount,
    direction: "IN",
    memo: "Transfer from " + source.customer_name
  });

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: source.account_id,
    action: "transfer_request",
    amount,
    memo: "Transfer to " + target.customer_name
  });

  return {
    body: okResponse("transfer_request", "Transfer approved", {
      source_account_id: source.account_id,
      target_account_id: target.account_id,
      amount
    }, audit)
  };
}

function handleStatement(store, body) {
  const account = findAccount(store, body.account_id);
  const count = Number(body.count || 5);

  if (!account) {
    return { error: ["statement_request", "Account not found", "ACCOUNT_NOT_FOUND"] };
  }

  const transactions = store.transactions
    .filter((item) => item.account_id === account.account_id)
    .slice(0, count);

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: account.account_id,
    action: "statement_request",
    memo: "Statement count " + count
  });

  return {
    body: okResponse("statement_request", "Statement retrieved", { transactions }, audit)
  };
}

function handleHistory(store, body) {
  const account = findAccount(store, body.account_id);

  if (!account) {
    return { error: ["history_view", "Account not found", "ACCOUNT_NOT_FOUND"] };
  }

  const history = store.transactions.filter((item) => item.account_id === account.account_id).slice(0, 10);

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: account.account_id,
    action: "history_view"
  });

  return {
    body: okResponse("history_view", "History retrieved", { transactions: history }, audit)
  };
}

function handleFinePay(store, body) {
  const account = findAccount(store, body.account_id);
  const fine = store.fines.find((item) => item.account_id === body.account_id && item.status === "DUE") || null;

  if (!account) {
    return { error: ["fine_pay", "Account not found", "ACCOUNT_NOT_FOUND"] };
  }
  if (!fine) {
    return { error: ["fine_pay", "No due fine found", "FINE_NOT_FOUND"] };
  }
  if (account.balance < fine.amount) {
    return { error: ["fine_pay", "Insufficient funds", "INSUFFICIENT_FUNDS"] };
  }

  account.balance -= fine.amount;
  account.outstanding_fine = 0;
  fine.status = "PAID";

  createTransaction(store, {
    account_id: account.account_id,
    type: "FINE PAYMENT",
    amount: fine.amount,
    direction: "OUT",
    memo: fine.reference
  });

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: account.account_id,
    action: "fine_pay",
    amount: fine.amount,
    memo: fine.reference
  });

  return {
    body: okResponse("fine_pay", "Fine paid", { fine, account }, audit)
  };
}

function handleLoanView(store, body) {
  const loan = store.loans.find((item) => item.account_id === body.account_id) || null;

  if (!loan) {
    return { error: ["loan_view", "Loan not found", "LOAN_NOT_FOUND"] };
  }

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: body.account_id,
    action: "loan_view"
  });

  return {
    body: okResponse("loan_view", "Loan retrieved", { loan }, audit)
  };
}

function handleCardStatus(store, body) {
  const card = findCardByAccount(store, body.account_id);

  if (!card) {
    return { error: ["card_status", "Card not found", "CARD_NOT_FOUND"] };
  }

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: body.account_id,
    action: "card_status"
  });

  return {
    body: okResponse("card_status", "Card status retrieved", { card }, audit)
  };
}

function handleCardAction(store, body, action, nextState) {
  const card = findCardByAccount(store, body.account_id);

  if (!card) {
    return { error: [action, "Card not found", "CARD_NOT_FOUND"] };
  }

  card.state = nextState;

  const audit = createAuditEntry(store, {
    ...body,
    target_account_id: body.account_id,
    action,
    memo: "Card state set to " + nextState
  });

  return {
    body: okResponse(action, "Card updated", { card }, audit)
  };
}

const handlers = {
  balance_view: handleBalanceView,
  deposit_request: handleDeposit,
  withdraw_request: handleWithdraw,
  transfer_request: handleTransfer,
  statement_request: handleStatement,
  history_view: handleHistory,
  fine_pay: handleFinePay,
  loan_view: handleLoanView,
  card_status: handleCardStatus,
  card_lock: (store, body) => handleCardAction(store, body, "card_lock", "LOCKED"),
  card_unlock: (store, body) => handleCardAction(store, body, "card_unlock", "ACTIVE"),
  card_report_stolen: (store, body) => handleCardAction(store, body, "card_report_stolen", "STOLEN")
};

export async function handleActionRequest(req, res) {
  let body;

  try {
    body = await readBody(req);
  } catch (_error) {
    sendJson(res, 400, {
      ok: false,
      message: "Invalid JSON body"
    });
    return;
  }

  const action = body.action;
  const store = getStore();
  const handler = handlers[action];

  if (!action || !handler) {
    errorResponse(res, action || "unknown", "Unsupported action", "UNSUPPORTED_ACTION");
    return;
  }

  const result = handler(store, body);

  if (result.error) {
    const [errAction, message, code] = result.error;
    errorResponse(res, errAction, message, code);
    return;
  }

  writeStore(store);
  sendJson(res, 200, result.body);
}
