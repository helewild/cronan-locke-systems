integer MENU_MAIN = 0;
integer MENU_WITHDRAW = 1;
integer MENU_DEPOSIT = 2;
integer MENU_STATEMENT = 3;
integer MENU_CUSTOM_AMOUNT = 4;

integer SESSION_TIMEOUT = 120;
integer DIALOG_CHANNEL_BASE = -910000;
integer TEXTBOX_CHANNEL_BASE = -920000;

string CONFIG_API_URL = "http://15.204.56.251/api/v1/portal";
string CONFIG_OBJECT_SECRET = "REPLACE_ME_OBJECT_SECRET";
string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_BRANCH_ID = "main-branch";
string CONFIG_ATM_ID = "atm-001";
string CONFIG_BANK_NAME = "Cronan & Locke Systems";

key gActiveUser = NULL_KEY;
integer gMenuListen = 0;
integer gTextListen = 0;
integer gMenuChannel = 0;
integer gTextChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAmountMenu = MENU_MAIN;
key gPendingRequest = NULL_KEY;
string gPendingAction = "";
string gBankName = "";
string gAccountId = "";
string gCustomerName = "";
string gCardState = "UNKNOWN";
float gBalance = 0.0;

integer randomPrivateChannel(integer base)
{
    return base - (integer)llFrand(1000000.0);
}

string activeBankName()
{
    if (gBankName != "")
    {
        return gBankName;
    }
    return CONFIG_BANK_NAME;
}

string headerLine()
{
    return "[" + activeBankName() + " ATM]";
}

string residentName(key avatar)
{
    string full = llKey2Name(avatar);
    if (full == "")
    {
        return "Unknown Resident";
    }
    return full;
}

string formatMoney(float amount)
{
    integer cents = (integer)llRound(amount * 100.0);
    integer whole = cents / 100;
    integer frac = llAbs(cents % 100);

    if (frac == 0)
    {
        return "L$" + (string)whole;
    }

    if (frac < 10)
    {
        return "L$" + (string)whole + ".0" + (string)frac;
    }

    return "L$" + (string)whole + "." + (string)frac;
}

integer resetListeners()
{
    if (gMenuListen)
    {
        llListenRemove(gMenuListen);
        gMenuListen = 0;
    }
    if (gTextListen)
    {
        llListenRemove(gTextListen);
        gTextListen = 0;
    }
    return 0;
}

integer endSession(string reason)
{
    if (gActiveUser != NULL_KEY && reason != "")
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " " + reason);
    }

    resetListeners();
    gActiveUser = NULL_KEY;
    gCurrentMenu = MENU_MAIN;
    gPendingAmountMenu = MENU_MAIN;
    gPendingRequest = NULL_KEY;
    gPendingAction = "";
    llSetTimerEvent(0.0);
    return 0;
}

integer startSession(key avatar)
{
    if (gActiveUser != NULL_KEY && gActiveUser != avatar)
    {
        llRegionSayTo(avatar, 0, headerLine() + " This ATM is currently in use. Please try again in a moment.");
        return FALSE;
    }

    resetListeners();
    gActiveUser = avatar;
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gTextChannel = randomPrivateChannel(TEXTBOX_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gTextListen = llListen(gTextChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    gPendingAmountMenu = MENU_MAIN;
    gPendingRequest = NULL_KEY;
    gPendingAction = "";
    llSetTimerEvent((float)SESSION_TIMEOUT);
    return TRUE;
}

string buildRequestBody(string actionType, integer amount, integer statementCount)
{
    return llList2Json(
        JSON_OBJECT,
        [
            "action", "object_action",
            "object_type", "atm",
            "action_type", actionType,
            "object_secret", CONFIG_OBJECT_SECRET,
            "tenant_id", CONFIG_TENANT_ID,
            "region_id", CONFIG_REGION_ID,
            "branch_id", CONFIG_BRANCH_ID,
            "atm_id", CONFIG_ATM_ID,
            "avatar_key", (string)gActiveUser,
            "avatar_name", residentName(gActiveUser),
            "amount", amount,
            "statement_count", statementCount
        ]
    );
}

integer sendRequest(string actionType, integer amount, integer statementCount)
{
    if (gPendingRequest != NULL_KEY)
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " Please wait for the current request to finish.");
        return FALSE;
    }

    gPendingAction = actionType;
    gPendingRequest = llHTTPRequest(
        CONFIG_API_URL,
        [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json"],
        buildRequestBody(actionType, amount, statementCount)
    );
    return TRUE;
}

integer dialog(key avatar, string message, list buttons, integer menuId)
{
    gCurrentMenu = menuId;
    llDialog(avatar, message, buttons, gMenuChannel);
    return 0;
}

list mainButtons()
{
    return ["Balance", "Withdraw", "Deposit", "Statement", "Exit"];
}

list amountButtons()
{
    return ["20", "50", "100", "500", "Custom", "Back"];
}

list statementButtons()
{
    return ["Last 5", "Last 10", "Back"];
}

integer showMainMenu()
{
    string message = activeBankName() + "\nATM Services\n\n"
        + "Resident: " + gCustomerName + "\n"
        + "Account: " + gAccountId + "\n"
        + "Balance: " + formatMoney(gBalance) + "\n"
        + "Card: " + gCardState + "\n"
        + "ATM: " + CONFIG_ATM_ID + "\n\n"
        + "Select a service:";

    dialog(gActiveUser, message, mainButtons(), MENU_MAIN);
    return 0;
}

integer showAmountMenu(integer menuId, string label)
{
    string message = label + "\n\n"
        + "Resident: " + gCustomerName + "\n"
        + "Account: " + gAccountId + "\n"
        + "Available Balance: " + formatMoney(gBalance) + "\n"
        + "Choose an amount or enter a custom value.";
    dialog(gActiveUser, message, amountButtons(), menuId);
    return 0;
}

integer showStatementMenu()
{
    dialog(gActiveUser, "Statement Request\n\nChoose the number of recent transactions to retrieve.", statementButtons(), MENU_STATEMENT);
    return 0;
}

integer promptForCustomAmount(integer returnMenu)
{
    gPendingAmountMenu = returnMenu;
    gCurrentMenu = MENU_CUSTOM_AMOUNT;
    llTextBox(
        gActiveUser,
        "Enter a whole Linden amount.\nExamples: 25, 150, 1200",
        gTextChannel
    );
    return 0;
}

integer parseAmount(string text)
{
    string trimmed = llStringTrim(text, STRING_TRIM);
    integer amount;

    if (trimmed == "")
    {
        return -1;
    }

    amount = (integer)trimmed;
    if (amount <= 0)
    {
        return -1;
    }
    return amount;
}

integer updateCache(string body)
{
    string tenantBank = llJsonGetValue(body, ["tenant", "bank_name"]);
    string accountId = llJsonGetValue(body, ["account", "account_id"]);
    string customerName = llJsonGetValue(body, ["account", "customer_name"]);
    string balance = llJsonGetValue(body, ["account", "balance"]);
    string cardState = llJsonGetValue(body, ["card", "state"]);

    if (tenantBank != JSON_INVALID)
    {
        gBankName = tenantBank;
        llSetObjectName(tenantBank + " ATM");
    }
    if (accountId != JSON_INVALID)
    {
        gAccountId = accountId;
    }
    if (customerName != JSON_INVALID)
    {
        gCustomerName = customerName;
    }
    if (balance != JSON_INVALID)
    {
        gBalance = (float)balance;
    }
    if (cardState != JSON_INVALID)
    {
        gCardState = cardState;
    }
    else
    {
        gCardState = "NO CARD";
    }
    return 0;
}

string buildStatementBody(string body)
{
    string transactions = llJsonGetValue(body, ["transactions"]);
    integer index = 0;
    string lines = "";

    while (llJsonValueType(transactions, [index]) != JSON_INVALID)
    {
        string created = llJsonGetValue(transactions, [index, "created_at"]);
        string type = llJsonGetValue(transactions, [index, "type"]);
        string amount = llJsonGetValue(transactions, [index, "amount"]);
        string direction = llJsonGetValue(transactions, [index, "direction"]);
        string memo = llJsonGetValue(transactions, [index, "memo"]);

        lines += (string)(index + 1) + ". ";
        if (created != JSON_INVALID && created != "")
        {
            lines += created + " / ";
        }
        lines += type + " / " + direction + " / L$" + amount;
        if (memo != JSON_INVALID && memo != "")
        {
            lines += " / " + memo;
        }
        lines += "\n";
        ++index;
    }

    if (lines == "")
    {
        lines = "No transactions returned.";
    }

    return lines;
}

integer handleApiError(string body, integer status)
{
    string error = llJsonGetValue(body, ["error"]);
    if (error == JSON_INVALID || error == "")
    {
        error = "HTTP " + (string)status;
    }
    llRegionSayTo(gActiveUser, 0, headerLine() + " " + error);
    showMainMenu();
    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "Balance")
    {
        sendRequest("balance", 0, 5);
    }
    else if (message == "Withdraw")
    {
        showAmountMenu(MENU_WITHDRAW, "Withdraw Funds");
    }
    else if (message == "Deposit")
    {
        showAmountMenu(MENU_DEPOSIT, "Deposit Funds");
    }
    else if (message == "Statement")
    {
        showStatementMenu();
    }
    else if (message == "Exit")
    {
        endSession("Session closed.");
    }
    return 0;
}

integer handleAmountChoice(string message, integer menuId)
{
    integer amount;

    if (message == "Back")
    {
        showMainMenu();
        return 0;
    }

    if (message == "Custom")
    {
        promptForCustomAmount(menuId);
        return 0;
    }

    amount = parseAmount(message);
    if (amount < 0)
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " Invalid amount selection.");
        showMainMenu();
        return 0;
    }

    if (menuId == MENU_WITHDRAW)
    {
        sendRequest("withdraw", amount, 5);
    }
    else if (menuId == MENU_DEPOSIT)
    {
        sendRequest("deposit", amount, 5);
    }
    return 0;
}

integer handleStatementChoice(string message)
{
    if (message == "Back")
    {
        showMainMenu();
    }
    else if (message == "Last 5")
    {
        sendRequest("statement", 0, 5);
    }
    else if (message == "Last 10")
    {
        sendRequest("statement", 0, 10);
    }
    return 0;
}

integer handleTextInput(string message)
{
    integer amount = parseAmount(message);
    if (amount < 0)
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " Invalid amount. Please enter a whole number greater than zero.");
        promptForCustomAmount(gPendingAmountMenu);
        return 0;
    }

    if (gPendingAmountMenu == MENU_WITHDRAW)
    {
        sendRequest("withdraw", amount, 5);
    }
    else if (gPendingAmountMenu == MENU_DEPOSIT)
    {
        sendRequest("deposit", amount, 5);
    }
    return 0;
}

default
{
    state_entry()
    {
        gBankName = CONFIG_BANK_NAME;
        llSetObjectName(CONFIG_BANK_NAME + " ATM");
        llOwnerSay("ATM live script ready. Replace CONFIG_OBJECT_SECRET before use, then touch to open a live banking session.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        if (startSession(avatar))
        {
            llRegionSayTo(avatar, 0, headerLine() + " Opening ATM session...");
            sendRequest("session", 0, 5);
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gActiveUser)
        {
            return;
        }

        llSetTimerEvent((float)SESSION_TIMEOUT);

        if (channel == gMenuChannel)
        {
            if (gCurrentMenu == MENU_MAIN)
            {
                handleMainChoice(message);
            }
            else if (gCurrentMenu == MENU_WITHDRAW)
            {
                handleAmountChoice(message, MENU_WITHDRAW);
            }
            else if (gCurrentMenu == MENU_DEPOSIT)
            {
                handleAmountChoice(message, MENU_DEPOSIT);
            }
            else if (gCurrentMenu == MENU_STATEMENT)
            {
                handleStatementChoice(message);
            }
        }
        else if (channel == gTextChannel)
        {
            handleTextInput(message);
        }
    }

    http_response(key request_id, integer status, list metadata, string body)
    {
        if (request_id != gPendingRequest)
        {
            return;
        }

        gPendingRequest = NULL_KEY;

        if (gActiveUser == NULL_KEY)
        {
            return;
        }

        if (status < 200 || status >= 300)
        {
            handleApiError(body, status);
            return;
        }

        updateCache(body);

        if (gPendingAction == "statement")
        {
            llRegionSayTo(
                gActiveUser,
                0,
                headerLine() + "\nStatement for " + gAccountId + "\n"
                + buildStatementBody(body)
            );
            gPendingAction = "";
            showMainMenu();
            return;
        }

        if (gPendingAction == "withdraw" || gPendingAction == "deposit")
        {
            string amount = llJsonGetValue(body, ["receipt", "amount"]);
            string balance = llJsonGetValue(body, ["receipt", "resulting_balance"]);
            llRegionSayTo(
                gActiveUser,
                0,
                headerLine() + "\nReceipt: " + llToUpper(gPendingAction) + "\n"
                + "Account: " + gAccountId + "\n"
                + "Amount: L$" + amount + "\n"
                + "Balance: L$" + balance
            );
        }
        else
        {
            llRegionSayTo(
                gActiveUser,
                0,
                headerLine() + "\nResident: " + gCustomerName + "\n"
                + "Account: " + gAccountId + "\n"
                + "Balance: " + formatMoney(gBalance) + "\n"
                + "Card: " + gCardState
            );
        }

        gPendingAction = "";
        showMainMenu();
    }

    timer()
    {
        endSession("Session timed out.");
    }

    changed(integer change)
    {
        if (change & (CHANGED_OWNER | CHANGED_INVENTORY))
        {
            llResetScript();
        }
    }
}
