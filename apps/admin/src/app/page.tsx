import { formatLinden, loadStore } from "@/lib/store";

function titleize(input: string): string {
  return input
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default async function AdminPage() {
  const store = await loadStore();
  const activeIncidents = store.vault_incidents.filter((incident) => incident.state === "ACTIVE");
  const dueFines = store.fines.filter((fine) => fine.status === "DUE");
  const activeLoans = store.loans.filter((loan) => loan.status === "ACTIVE");
  const totalBalances = store.accounts.reduce((sum, account) => sum + account.balance, 0);
  const totalCash = store.accounts.reduce((sum, account) => sum + account.cash_on_hand, 0);
  const totalFineExposure = store.accounts.reduce((sum, account) => sum + account.outstanding_fine, 0);
  const totalLoanExposure = store.accounts.reduce((sum, account) => sum + account.loan_balance, 0);

  return (
    <main className="ops-shell">
      <section className="hero-frame">
        <div className="hero-copy">
          <p className="eyebrow">Admin Platform</p>
          <h1>Cronan &amp; Locke Systems</h1>
          <p className="lede">
            Banking, justice, lending, and security operations for multi-tenant RP communities.
            This admin app now runs on a real Next.js foundation and reads directly from the current platform mock store.
          </p>
        </div>
        <div className="hero-stamp">
          <span className="stamp-label">System</span>
          <strong>ONLINE</strong>
          <span>{new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
        </div>
      </section>

      <section className="metric-grid">
        <article className="metric-card">
          <span>Tenants</span>
          <strong>{store.tenants.length}</strong>
        </article>
        <article className="metric-card">
          <span>Accounts</span>
          <strong>{store.accounts.length}</strong>
        </article>
        <article className="metric-card">
          <span>Cards</span>
          <strong>{store.cards.length}</strong>
        </article>
        <article className="metric-card alert">
          <span>Active Incidents</span>
          <strong>{activeIncidents.length}</strong>
        </article>
        <article className="metric-card">
          <span>Due Fines</span>
          <strong>{dueFines.length}</strong>
        </article>
        <article className="metric-card">
          <span>Active Loans</span>
          <strong>{activeLoans.length}</strong>
        </article>
      </section>

      <section className="dashboard-grid">
        <div className="column">
          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Platform Scope</p>
                <h2>Tenants</h2>
              </div>
              <span className="panel-meta">{store.tenants.length} configured</span>
            </div>
            <div className="tenant-list">
              {store.tenants.map((tenant) => (
                <div className="tenant-card" key={tenant.tenant_id}>
                  <div>
                    <h3>{tenant.bank_name}</h3>
                    <p>{tenant.name}</p>
                  </div>
                  <div className="tenant-meta">
                    <span className={`status-chip ${tenant.status.toLowerCase()}`}>{tenant.status}</span>
                    <p>{tenant.feature_flags.map(titleize).join(" | ")}</p>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Customer Ledger</p>
                <h2>Accounts</h2>
              </div>
              <span className="panel-meta">{formatLinden(totalBalances)} in held balances</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Customer</th>
                  <th>Balance</th>
                  <th>Cash</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {store.accounts.map((account) => (
                  <tr key={account.account_id}>
                    <td>{account.account_id}</td>
                    <td>{account.customer_name}</td>
                    <td>{formatLinden(account.balance)}</td>
                    <td>{formatLinden(account.cash_on_hand)}</td>
                    <td>
                      <span className={`status-chip ${account.status.toLowerCase()}`}>{account.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Financial Exposure</p>
                <h2>Platform Totals</h2>
              </div>
              <span className="panel-meta">Current mock-store snapshot</span>
            </div>
            <div className="exposure-grid">
              <div className="exposure-card">
                <span>Total Cash On Hand</span>
                <strong>{formatLinden(totalCash)}</strong>
              </div>
              <div className="exposure-card">
                <span>Outstanding Fines</span>
                <strong>{formatLinden(totalFineExposure)}</strong>
              </div>
              <div className="exposure-card">
                <span>Loan Exposure</span>
                <strong>{formatLinden(totalLoanExposure)}</strong>
              </div>
            </div>
          </article>
        </div>

        <div className="column">
          <article className="panel incident-panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Security Dispatch</p>
                <h2>Vault Incidents</h2>
              </div>
              <span className="panel-meta">{activeIncidents.length} active</span>
            </div>
            <div className="incident-stack">
              {store.vault_incidents.map((incident) => (
                <div className={`incident-card ${incident.state.toLowerCase()}`} key={incident.incident_id}>
                  <div className="incident-banner">Vault Incident {incident.state === "ACTIVE" ? "Detected" : "Archived"}</div>
                  <dl>
                    <div>
                      <dt>Incident ID</dt>
                      <dd>{incident.incident_id}</dd>
                    </div>
                    <div>
                      <dt>Status</dt>
                      <dd>{incident.stage}</dd>
                    </div>
                    <div>
                      <dt>Unit</dt>
                      <dd>{incident.responding_unit}</dd>
                    </div>
                    <div>
                      <dt>Last Event</dt>
                      <dd>{incident.last_update}</dd>
                    </div>
                    <div>
                      <dt>Marked Cash</dt>
                      <dd>{incident.marked_cash_flag ? "YES" : "NO"}</dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Card & Credit</p>
                <h2>Cards and Loans</h2>
              </div>
              <span className="panel-meta">Linked to account-level status</span>
            </div>
            <div className="split-grid">
              <div>
                <h3 className="subhead">Cards</h3>
                <ul className="compact-list">
                  {store.cards.map((card) => (
                    <li key={card.card_id}>
                      <span>{card.card_id}</span>
                      <strong>{card.state}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="subhead">Loans</h3>
                <ul className="compact-list">
                  {store.loans.map((loan) => (
                    <li key={loan.loan_id}>
                      <span>{loan.loan_id}</span>
                      <strong>{formatLinden(loan.balance)}</strong>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Enforcement</p>
                <h2>Fines</h2>
              </div>
              <span className="panel-meta">{dueFines.length} due</span>
            </div>
            <ul className="record-list">
              {store.fines.map((fine) => (
                <li key={fine.fine_id}>
                  <div>
                    <strong>{fine.reference}</strong>
                    <p>{fine.account_id}</p>
                  </div>
                  <div className="record-meta">
                    <strong>{formatLinden(fine.amount)}</strong>
                    <span className={`status-chip ${fine.status.toLowerCase()}`}>{fine.status}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Audit Trail</p>
                <h2>Recent Actions</h2>
              </div>
              <span className="panel-meta">{store.audit_logs.length} recorded</span>
            </div>
            <ul className="record-list">
              {store.audit_logs.map((entry) => (
                <li key={entry.audit_id}>
                  <div>
                    <strong>{titleize(entry.action)}</strong>
                    <p>
                      {entry.actor_name} via {entry.object_type}:{entry.object_id}
                    </p>
                  </div>
                  <div className="record-meta">
                    <strong>{entry.amount ? formatLinden(entry.amount) : "N/A"}</strong>
                    <span className={`status-chip ${entry.status.toLowerCase()}`}>{titleize(entry.status)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>

          <article className="panel">
            <div className="panel-head">
              <div>
                <p className="panel-kicker">Ledger Feed</p>
                <h2>Transactions</h2>
              </div>
              <span className="panel-meta">{store.transactions.length} available</span>
            </div>
            <ul className="record-list">
              {store.transactions.map((transaction) => (
                <li key={transaction.transaction_id}>
                  <div>
                    <strong>{titleize(transaction.type)}</strong>
                    <p>{transaction.memo}</p>
                  </div>
                  <div className="record-meta">
                    <strong>{formatLinden(transaction.amount)}</strong>
                    <span className={`status-chip ${transaction.direction.toLowerCase()}`}>{transaction.direction}</span>
                  </div>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
