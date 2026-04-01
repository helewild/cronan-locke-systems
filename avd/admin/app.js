const DATA_URL = "../../services/api/data/store.json";
const STORAGE_KEY = "cls-admin-preview-state-v1";

let state = null;

document.querySelectorAll(".nav").forEach((btn) => {
    btn.onclick = () => {
        document.querySelectorAll(".nav").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).classList.add("active");
    };
});

function formatMoney(value) {
    return `L$${value}`;
}

function stamp() {
    return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function syncClock() {
    const now = new Date();
    document.getElementById("clockLine").textContent =
        `DATE: ${now.getMonth() + 1}/${now.getDate()}/${now.getFullYear()} TIME: ${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function clone(data) {
    return JSON.parse(JSON.stringify(data));
}

function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

async function loadInitialState() {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
        state = JSON.parse(cached);
        return;
    }

    const res = await fetch(DATA_URL);
    const data = await res.json();

    state = {
        tenants: data.tenants || [],
        accounts: (data.accounts || []).map((acc) => ({
            id: acc.account_id,
            name: acc.customer_name,
            balance: acc.balance,
            frozen: acc.status === "FROZEN"
        })),
        incidents: (data.vault_incidents || []).map((incident) => ({
            id: incident.incident_id,
            status: incident.stage,
            state: incident.state,
            unit: incident.responding_unit,
            lastEvent: incident.last_update,
            vault_id: incident.vault_id
        })),
        atm: [
            { id: "atm-001", name: "Main Branch ATM", status: "ONLINE" },
            { id: "atm-002", name: "North Gate ATM", status: "ONLINE" }
        ],
        payroll: [
            { ts: stamp(), msg: "Payroll queue loaded for demo tenant" }
        ],
        logs: (data.transactions || []).map((txn) => ({
            ts: stamp(),
            msg: `${txn.type} - ${formatMoney(txn.amount)} - ${txn.account_id}`
        }))
    };

    saveState();
}

function refreshStats() {
    document.getElementById("statTenants").innerText = state.tenants.length;
    document.getElementById("statAccounts").innerText = state.accounts.length;
    document.getElementById("statCards").innerText = 1;
    document.getElementById("statIncidents").innerText = state.incidents.filter((i) => i.state === "ACTIVE").length;
    document.getElementById("statFines").innerText = 1;
    document.getElementById("statLoans").innerText = 1;
}

function loadAccounts() {
    const tbody = document.querySelector("#accountsTable tbody");
    tbody.innerHTML = "";

    state.accounts.forEach((acc) => {
        const row = document.createElement("tr");
        const statusLabel = acc.frozen ? "FROZEN" : "ACTIVE";

        row.innerHTML = `
            <td>${acc.id}</td>
            <td>${acc.name}</td>
            <td>${formatMoney(acc.balance)}</td>
            <td>
                <button onclick="deposit('${acc.id}')">Deposit</button>
                <button onclick="withdraw('${acc.id}')">Withdraw</button>
                <button class="danger" onclick="freeze('${acc.id}')">${statusLabel}</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

function renderTransactions() {
    const box = document.getElementById("transactionsBox");
    box.innerHTML = "";

    state.logs.slice(0, 20).forEach((log) => {
        const p = document.createElement("p");
        p.textContent = `[${log.ts}] ${log.msg}`;
        box.appendChild(p);
    });
}

function loadIncidents() {
    const active = state.incidents.filter((i) => i.state === "ACTIVE");
    document.getElementById("statIncidents").innerText = active.length;

    const box = document.getElementById("incidentBox");
    const summary = document.getElementById("incidentSummary");

    if (!active.length) {
        box.innerHTML = "No active incidents";
        summary.innerHTML = "<p>No active incidents</p>";
        return;
    }

    const i = active[0];

    box.innerHTML = `
        <p>ID: ${i.id}</p>
        <p>Status: <span style="color:red">${i.status}</span></p>
        <p>Unit: ${i.unit || "NONE"}</p>
        <button onclick="dispatch('${i.id}')">DISPATCH POLICE</button>
        <button onclick="lockVault()">LOCK VAULT</button>
    `;

    summary.innerHTML = `
        <p>ID: ${i.id}</p>
        <p>Status: <span class="status">${i.status}</span></p>
        <p>Unit: ${i.unit || "NONE"}</p>
        <p>Last Event: ${i.lastEvent}</p>
    `;
}

function loadATM() {
    const tbody = document.querySelector("#atmTable tbody");
    tbody.innerHTML = "";

    state.atm.forEach((atm) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>${atm.id}</td>
            <td>${atm.name}</td>
            <td>${atm.status}</td>
            <td><button onclick="toggleATM('${atm.id}')">Toggle</button></td>
        `;

        tbody.appendChild(row);
    });
}

function loadPayroll() {
    const box = document.getElementById("payrollBox");
    box.innerHTML = "";

    state.payroll.slice(0, 12).forEach((entry) => {
        const p = document.createElement("p");
        p.textContent = `[${entry.ts}] ${entry.msg}`;
        box.appendChild(p);
    });
}

function loadLogs() {
    const box = document.getElementById("logs");
    const ticker = document.getElementById("bottomTicker");
    box.innerHTML = "";
    ticker.innerHTML = "";

    state.logs.slice(0, 25).forEach((log) => {
        const p = document.createElement("p");
        p.textContent = `[${log.ts}] ${log.msg}`;
        box.appendChild(p);
    });

    state.logs.slice(0, 3).forEach((log) => {
        const p = document.createElement("p");
        p.textContent = `[${log.ts}] ${log.msg}`;
        ticker.appendChild(p);
    });
}

function loadAll() {
    refreshStats();
    loadAccounts();
    renderTransactions();
    loadIncidents();
    loadATM();
    loadPayroll();
    loadLogs();
    saveState();
}

function findAccount(id) {
    return state.accounts.find((acc) => acc.id === id);
}

function addLog(msg) {
    state.logs.unshift({ ts: stamp(), msg });
}

window.deposit = function deposit(id) {
    const acc = findAccount(id);
    if (!acc) return;
    acc.balance += 100;
    addLog(`Deposit - ${formatMoney(100)} - ${id}`);
    loadAll();
};

window.withdraw = function withdraw(id) {
    const acc = findAccount(id);
    if (!acc) return;
    acc.balance = Math.max(0, acc.balance - 100);
    addLog(`Withdrawal - ${formatMoney(100)} - ${id}`);
    loadAll();
};

window.freeze = function freeze(id) {
    const acc = findAccount(id);
    if (!acc) return;
    acc.frozen = !acc.frozen;
    addLog(`Account ${acc.frozen ? "Frozen" : "Reactivated"} - ${id}`);
    loadAll();
};

window.dispatch = function dispatch(id) {
    const incident = state.incidents.find((i) => i.id === id);
    if (!incident) return;
    incident.status = "UNIT DISPATCHED";
    incident.unit = "UNIT 12";
    incident.lastEvent = "Dispatch authorized from admin terminal";
    addLog(`Police Dispatched - ${id}`);
    loadAll();
};

window.dispatchActive = function dispatchActive() {
    const incident = state.incidents.find((i) => i.state === "ACTIVE");
    if (!incident) return;
    window.dispatch(incident.id);
};

window.lockVault = function lockVault() {
    const incident = state.incidents.find((i) => i.state === "ACTIVE");
    if (!incident) return;
    incident.status = "LOCKDOWN TRIGGERED";
    incident.lastEvent = "Vault lockdown command issued";
    addLog(`Vault Lockdown Triggered - ${incident.id}`);
    loadAll();
};

window.toggleATM = function toggleATM(id) {
    const atm = state.atm.find((item) => item.id === id);
    if (!atm) return;
    atm.status = atm.status === "ONLINE" ? "OFFLINE" : "ONLINE";
    addLog(`ATM ${atm.status} - ${id}`);
    loadAll();
};

window.runPayroll = function runPayroll() {
    state.payroll.unshift({ ts: stamp(), msg: "Payroll batch executed for active tenant" });
    addLog("Payroll Batch Executed");
    loadAll();
};

loadInitialState().then(() => {
    syncClock();
    setInterval(syncClock, 1000);
    loadAll();
    setInterval(loadAll, 5000);
});
