import { nextTransactionId } from "./ids.js";

export function createTransaction(store, input) {
  const entry = {
    transaction_id: nextTransactionId(store),
    account_id: input.account_id,
    type: input.type,
    amount: input.amount,
    direction: input.direction,
    memo: input.memo || ""
  };

  store.transactions.unshift(entry);
  return entry;
}
