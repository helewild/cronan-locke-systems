import { nextAuditId } from "./ids.js";

export function createAuditEntry(store, input) {
  const entry = {
    audit_id: nextAuditId(store),
    tenant_id: input.tenant_id || "demo-tenant",
    region_id: input.region_id || "demo-region",
    branch_id: input.branch_id || "main-branch",
    object_id: input.object_id || "system",
    object_type: input.object_type || "system",
    actor_name: input.actor_name || "System",
    target_account_id: input.target_account_id || null,
    action: input.action,
    status: input.status || "approved",
    amount: input.amount || 0,
    memo: input.memo || ""
  };

  store.audit_logs.push(entry);
  return entry;
}
