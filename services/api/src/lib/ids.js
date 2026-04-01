function nextNumericSuffix(values, prefix) {
  const numbers = values
    .filter((value) => typeof value === "string" && value.startsWith(prefix))
    .map((value) => Number(value.slice(prefix.length)))
    .filter((value) => Number.isFinite(value));

  const max = numbers.length ? Math.max(...numbers) : 0;
  return String(max + 1).padStart(5, "0");
}

export function nextAuditId(store) {
  return "WPB-AUD-" + nextNumericSuffix(store.audit_logs.map((item) => item.audit_id), "WPB-AUD-");
}

export function nextTransactionId(store) {
  return "WPB-TXN-" + nextNumericSuffix(store.transactions.map((item) => item.transaction_id), "WPB-TXN-");
}
