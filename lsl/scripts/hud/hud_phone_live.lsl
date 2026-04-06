integer MENU_MAIN = 0;
integer MENU_TRANSFER = 1;
integer MENU_FINE = 2;
integer MENU_LOAN = 3;
integer MENU_CARD = 4;
integer MENU_TEXT = 5;

integer INPUT_NONE = 0;
integer INPUT_TRANSFER_TARGET = 1;
integer INPUT_TRANSFER_AMOUNT = 2;
integer INPUT_TRANSFER_MEMO = 3;
integer INPUT_LOAN_AMOUNT = 4;

integer SESSION_TIMEOUT = 180;
integer DIALOG_CHANNEL_BASE = -960000;
integer TEXTBOX_CHANNEL_BASE = -970000;

string CONFIG_API_URL = "http://15.204.56.251/api/v1/portal";
string CONFIG_BOOTSTRAP_SECRET = "QbN2GpbUD2mO4M-bIZKAX_rE3cng549x";
string CONFIG_TENANT_ID = "";
string CONFIG_DEVICE_ID = "";
string CONFIG_BANK_NAME = "Cronan & Locke Systems";

key gUser = NULL_KEY;
integer gMenuListen = 0;
integer gTextListen = 0;
integer gMenuChannel = 0;
integer gTextChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingInput = INPUT_NONE;
key gPendingRequest = NULL_KEY;
string gPendingAction = "";
string gBankName = "";
string gResolvedTenantId = "";
string gResolvedObjectSecret = "";
string gAccountId = "";
string gCustomerName = "";
float gBalance = 0.0;
float gOutstandingFine = 0.0;
float gLoanBalance = 0.0;
string gCardId = "";
string gCardState = "UNKNOWN";
string gSelectedFineId = "";
string gSelectedLoanId = "";
string gTransferTargetAccountId = "";
string gTransferTargetName = "";
integer gTransferAmount = 0;
string gTransferMemo = "";
list gTransferDirectory = [];
list gHistory = [];
list gFinePairs = [];
list gLoanPairs = [];

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

string activeTenantId()
{
    if (gResolvedTenantId != "")
    {
        return gResolvedTenantId;
    }
    return CONFIG_TENANT_ID;
}

string activeObjectSecret()
{
    if (gResolvedObjectSecret != "")
    {
        return gResolvedObjectSecret;
    }
    return CONFIG_BOOTSTRAP_SECRET;
}

string activeDeviceId()
{
    if (CONFIG_DEVICE_ID != "")
    {
        return CONFIG_DEVICE_ID;
    }
    return (string)llGetKey();
}

string headerLine()
{
    return "[" + activeBankName() + " Mobile]";
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

integer loadCachedConfig()
{
    string desc = llGetObjectDesc();
    list parts;

    if (llSubStringIndex(desc, "CLSHUD|") != 0)
    {
        return FALSE;
    }

    parts = llParseStringKeepNulls(desc, ["|"], []);
    if (llGetListLength(parts) < 4)
    {
        return FALSE;
    }

    gResolvedTenantId = llList2String(parts, 1);
    gBankName = llList2String(parts, 2);
    gResolvedObjectSecret = llList2String(parts, 3);
    return TRUE;
}

integer saveCachedConfig()
{
    llSetObjectDesc("CLSHUD|" + gResolvedTenantId + "|" + gBankName + "|" + gResolvedObjectSecret);
    return 0;
}

integer clearPending()
{
    gPendingInput = INPUT_NONE;
    gPendingAction = "";
    gSelectedFineId = "";
    gSelectedLoanId = "";
    gTransferTargetAccountId = "";
    gTransferTargetName = "";
    gTransferAmount = 0;
    gTransferMemo = "";
    return 0;
}

integer endSession(string reason)
{
    if (gUser != NULL_KEY && reason != "")
    {
        llRegionSayTo(gUser, 0, headerLine() + " " + reason);
    }

    resetListeners();
    gCurrentMenu = MENU_MAIN;
    gPendingRequest = NULL_KEY;
    clearPending();
    llSetTimerEvent(0.0);
    return 0;
}

string buildRequestBody(string actionType)
{
    return llList2Json(
        JSON_OBJECT,
        [
            "action", "object_action",
            "object_type", "hud",
            "action_type", actionType,
            "object_secret", activeObjectSecret(),
            "tenant_id", activeTenantId(),
            "device_id", activeDeviceId(),
            "avatar_key", (string)gUser,
            "avatar_name", residentName(gUser),
            "object_owner_key", (string)llGetOwner(),
            "object_owner_name", residentName(llGetOwner()),
            "target_account_id", gTransferTargetAccountId,
            "amount", gTransferAmount,
            "memo", gTransferMemo,
            "fine_id", gSelectedFineId,
            "loan_id", gSelectedLoanId,
            "statement_count", 10
        ]
    );
}

integer sendRequest(string actionType)
{
    if (gPendingRequest != NULL_KEY)
    {
        llRegionSayTo(gUser, 0, headerLine() + " Please wait for the current request to finish.");
        return FALSE;
    }

    gPendingAction = actionType;
    gPendingRequest = llHTTPRequest(
        CONFIG_API_URL,
        [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json"],
        buildRequestBody(actionType)
    );
    return TRUE;
}

integer startSession(key avatar)
{
    resetListeners();
    gUser = avatar;
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gTextChannel = randomPrivateChannel(TEXTBOX_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gTextListen = llListen(gTextChannel, "", avatar, "");
    clearPending();
    gCurrentMenu = MENU_MAIN;
    llSetTimerEvent((float)SESSION_TIMEOUT);
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
    return ["Balance", "Transfer", "History", "Fine", "Loan", "Card", "Close"];
}

list transferButtons()
{
    list buttons = [];
    integer count = llGetListLength(gTransferDirectory);
    integer index = 0;

    while (index < count && index < 3)
    {
        buttons += [llList2String(gTransferDirectory, index)];
        ++index;
    }

    buttons += ["Enter Name", "Back"];
    return buttons;
}

list fineButtons()
{
    if (gSelectedFineId != "")
    {
        return ["Pay Fine", "Back"];
    }
    return ["Back"];
}

list loanButtons()
{
    if (gSelectedLoanId != "")
    {
        return ["Pay Loan", "Back"];
    }
    return ["Back"];
}

list cardButtons()
{
    if (gCardState == "ACTIVE")
    {
        return ["Lock Card", "Report Stolen", "Back"];
    }
    if (gCardState == "LOCKED")
    {
        return ["Unlock Card", "Report Stolen", "Back"];
    }
    return ["Back"];
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
    string tenantId = llJsonGetValue(body, ["tenant", "tenant_id"]);
    string tenantObjectSecret = llJsonGetValue(body, ["tenant_object_secret"]);
    string accountId = llJsonGetValue(body, ["account", "account_id"]);
    string customerName = llJsonGetValue(body, ["account", "customer_name"]);
    string balance = llJsonGetValue(body, ["account", "balance"]);
    string outstandingFine = llJsonGetValue(body, ["account", "outstanding_fine"]);
    string loanBalance = llJsonGetValue(body, ["account", "loan_balance"]);
    string firstCardId = llJsonGetValue(body, ["cards", 0, "card_id"]);
    string firstCardState = llJsonGetValue(body, ["cards", 0, "state"]);
    integer index = 0;

    if (tenantBank != JSON_INVALID)
    {
        gBankName = tenantBank;
        llSetObjectName(tenantBank + " Mobile");
    }
    if (tenantId != JSON_INVALID)
    {
        gResolvedTenantId = tenantId;
    }
    if (tenantObjectSecret != JSON_INVALID && tenantObjectSecret != "")
    {
        gResolvedObjectSecret = tenantObjectSecret;
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
    if (outstandingFine != JSON_INVALID)
    {
        gOutstandingFine = (float)outstandingFine;
    }
    if (loanBalance != JSON_INVALID)
    {
        gLoanBalance = (float)loanBalance;
    }
    if (firstCardId != JSON_INVALID)
    {
        gCardId = firstCardId;
    }
    if (firstCardState != JSON_INVALID)
    {
        gCardState = firstCardState;
    }

    gTransferDirectory = [];
    while (llJsonValueType(body, ["transfer_directory", index]) != JSON_INVALID && index < 3)
    {
        gTransferDirectory += [llJsonGetValue(body, ["transfer_directory", index, "customer_name"])];
        ++index;
    }

    gHistory = [];
    index = 0;
    while (llJsonValueType(body, ["transactions", index]) != JSON_INVALID && index < 5)
    {
        string type = llJsonGetValue(body, ["transactions", index, "type"]);
        string amount = llJsonGetValue(body, ["transactions", index, "amount"]);
        string direction = llJsonGetValue(body, ["transactions", index, "direction"]);
        gHistory += [type + " / " + direction + " / L$" + amount];
        ++index;
    }

    gFinePairs = [];
    index = 0;
    gSelectedFineId = "";
    while (llJsonValueType(body, ["fines", index]) != JSON_INVALID)
    {
        string fineId = llJsonGetValue(body, ["fines", index, "fine_id"]);
        string fineStatus = llJsonGetValue(body, ["fines", index, "status"]);
        string fineReference = llJsonGetValue(body, ["fines", index, "reference"]);
        if (fineStatus == "DUE")
        {
            gFinePairs += [fineReference, fineId];
            if (gSelectedFineId == "")
            {
                gSelectedFineId = fineId;
            }
        }
        ++index;
    }

    gLoanPairs = [];
    index = 0;
    gSelectedLoanId = "";
    while (llJsonValueType(body, ["loans", index]) != JSON_INVALID)
    {
        string loanId = llJsonGetValue(body, ["loans", index, "loan_id"]);
        string loanStatus = llJsonGetValue(body, ["loans", index, "status"]);
        string loanTerms = llJsonGetValue(body, ["loans", index, "terms"]);
        if (loanStatus == "ACTIVE")
        {
            gLoanPairs += [loanTerms, loanId];
            if (gSelectedLoanId == "")
            {
                gSelectedLoanId = loanId;
            }
        }
        ++index;
    }

    saveCachedConfig();
    return 0;
}

integer showMainMenu()
{
    dialog(
        gUser,
        activeBankName() + "\nPhone Banking\n\n"
        + "Resident: " + gCustomerName + "\n"
        + "Account: " + gAccountId + "\n"
        + "Balance: " + formatMoney(gBalance) + "\n"
        + "Fine Due: " + formatMoney(gOutstandingFine) + "\n"
        + "Loan Balance: " + formatMoney(gLoanBalance) + "\n"
        + "Card: " + gCardState + "\n\n"
        + "Select a service:",
        mainButtons(),
        MENU_MAIN
    );
    return 0;
}

integer showTransferMenu()
{
    string body = "Transfer Funds\n\n";
    integer count = llGetListLength(gTransferDirectory);
    integer index = 0;

    if (count == 0)
    {
        body += "No quick recipients cached.\n";
    }
    else
    {
        body += "Quick recipients:\n";
        while (index < count)
        {
            body += "- " + llList2String(gTransferDirectory, index) + "\n";
            ++index;
        }
    }

    body += "\nChoose a recipient.";
    dialog(gUser, body, transferButtons(), MENU_TRANSFER);
    return 0;
}

integer showHistoryMenu()
{
    string body = "Recent Activity\n\n";
    integer count = llGetListLength(gHistory);
    integer index = 0;

    if (count == 0)
    {
        body += "No recent transactions.";
    }
    else
    {
        while (index < count)
        {
            body += llList2String(gHistory, index) + "\n";
            ++index;
        }
    }

    dialog(gUser, body, ["Refresh", "Back"], MENU_MAIN);
    return 0;
}

integer showFineMenu()
{
    string body = "Outstanding Fine\n\nAmount Due: " + formatMoney(gOutstandingFine);
    if (gSelectedFineId == "")
    {
        body += "\nNo due fine found.";
    }
    dialog(gUser, body, fineButtons(), MENU_FINE);
    return 0;
}

integer showLoanMenu()
{
    string body = "Loan Summary\n\nBalance: " + formatMoney(gLoanBalance);
    if (gSelectedLoanId == "")
    {
        body += "\nNo active loan found.";
    }
    else if (llGetListLength(gLoanPairs) >= 2)
    {
        body += "\nTerms: " + llList2String(gLoanPairs, 0);
    }
    dialog(gUser, body, loanButtons(), MENU_LOAN);
    return 0;
}

integer showCardMenu()
{
    dialog(
        gUser,
        "Card Controls\n\nCard: " + gCardId + "\nState: " + gCardState + "\n\nChoose an action.",
        cardButtons(),
        MENU_CARD
    );
    return 0;
}

integer promptTransferName()
{
    gPendingInput = INPUT_TRANSFER_TARGET;
    gCurrentMenu = MENU_TEXT;
    llTextBox(gUser, "Enter the recipient account holder name.", gTextChannel);
    return 0;
}

integer promptTransferAmount()
{
    gPendingInput = INPUT_TRANSFER_AMOUNT;
    gCurrentMenu = MENU_TEXT;
    llTextBox(gUser, "Enter the Linden amount to transfer.", gTextChannel);
    return 0;
}

integer promptTransferMemo()
{
    gPendingInput = INPUT_TRANSFER_MEMO;
    gCurrentMenu = MENU_TEXT;
    llTextBox(gUser, "Enter a transfer memo, or type none.", gTextChannel);
    return 0;
}

integer promptLoanAmount()
{
    gPendingInput = INPUT_LOAN_AMOUNT;
    gCurrentMenu = MENU_TEXT;
    llTextBox(gUser, "Enter the Linden amount to pay toward the loan.", gTextChannel);
    return 0;
}

string findTransferAccountIdByName(string customerName)
{
    integer count = llGetListLength(gTransferDirectory);
    integer index = 0;
    while (index < count)
    {
        if (llList2String(gTransferDirectory, index) == customerName)
        {
            return llJsonGetValue(llList2Json(JSON_ARRAY, []), [0]);
        }
        ++index;
    }
    return "";
}

string resolveTransferAccountId(string customerName, string body)
{
    integer index = 0;
    while (llJsonValueType(body, ["transfer_directory", index]) != JSON_INVALID)
    {
        if (llJsonGetValue(body, ["transfer_directory", index, "customer_name"]) == customerName)
        {
            return llJsonGetValue(body, ["transfer_directory", index, "account_id"]);
        }
        ++index;
    }
    return "";
}

integer handleApiError(string body, integer status)
{
    string error = llJsonGetValue(body, ["error"]);
    if (error == JSON_INVALID || error == "")
    {
        error = "HTTP " + (string)status;
    }
    llRegionSayTo(gUser, 0, headerLine() + " " + error);
    clearPending();
    showMainMenu();
    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "Balance")
    {
        sendRequest("session");
    }
    else if (message == "Transfer")
    {
        showTransferMenu();
    }
    else if (message == "History")
    {
        sendRequest("history");
    }
    else if (message == "Fine")
    {
        showFineMenu();
    }
    else if (message == "Loan")
    {
        showLoanMenu();
    }
    else if (message == "Card")
    {
        showCardMenu();
    }
    else if (message == "Close")
    {
        endSession("Session closed.");
    }
    else if (message == "Refresh")
    {
        sendRequest("history");
    }
    else if (message == "Back")
    {
        showMainMenu();
    }
    return 0;
}

integer handleTransferChoice(string message)
{
    if (message == "Back")
    {
        clearPending();
        showMainMenu();
        return 0;
    }

    if (message == "Enter Name")
    {
        promptTransferName();
        return 0;
    }

    gTransferTargetName = message;
    promptTransferAmount();
    return 0;
}

integer handleFineChoice(string message)
{
    if (message == "Pay Fine")
    {
        sendRequest("pay_fine");
    }
    else
    {
        showMainMenu();
    }
    return 0;
}

integer handleLoanChoice(string message)
{
    if (message == "Pay Loan")
    {
        promptLoanAmount();
    }
    else
    {
        showMainMenu();
    }
    return 0;
}

integer handleCardChoice(string message)
{
    if (message == "Lock Card")
    {
        sendRequest("lock_card");
    }
    else if (message == "Unlock Card")
    {
        sendRequest("unlock_card");
    }
    else if (message == "Report Stolen")
    {
        sendRequest("report_stolen_card");
    }
    else
    {
        showMainMenu();
    }
    return 0;
}

integer handleTextInput(string message)
{
    string trimmed = llStringTrim(message, STRING_TRIM);
    integer amount = 0;

    if (gPendingInput == INPUT_TRANSFER_TARGET)
    {
        if (trimmed == "")
        {
            promptTransferName();
            return 0;
        }
        gTransferTargetName = trimmed;
        promptTransferAmount();
        return 0;
    }

    if (gPendingInput == INPUT_TRANSFER_AMOUNT)
    {
        amount = parseAmount(trimmed);
        if (amount < 0)
        {
          promptTransferAmount();
          return 0;
        }
        gTransferAmount = amount;
        promptTransferMemo();
        return 0;
    }

    if (gPendingInput == INPUT_TRANSFER_MEMO)
    {
        if (llToLower(trimmed) == "none")
        {
            trimmed = "";
        }
        gTransferMemo = trimmed;
        sendRequest("history");
        return 0;
    }

    if (gPendingInput == INPUT_LOAN_AMOUNT)
    {
        amount = parseAmount(trimmed);
        if (amount < 0)
        {
            promptLoanAmount();
            return 0;
        }
        gTransferAmount = amount;
        sendRequest("pay_loan");
        return 0;
    }
    return 0;
}

default
{
    state_entry()
    {
        gBankName = CONFIG_BANK_NAME;
        loadCachedConfig();
        llSetObjectName(activeBankName() + " Mobile");
        llOwnerSay("Phone HUD live script ready. Touch to open mobile banking.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        startSession(avatar);
        llRegionSayTo(avatar, 0, headerLine() + " Opening mobile banking...");
        sendRequest("session");
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gUser)
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
            else if (gCurrentMenu == MENU_TRANSFER)
            {
                handleTransferChoice(message);
            }
            else if (gCurrentMenu == MENU_FINE)
            {
                handleFineChoice(message);
            }
            else if (gCurrentMenu == MENU_LOAN)
            {
                handleLoanChoice(message);
            }
            else if (gCurrentMenu == MENU_CARD)
            {
                handleCardChoice(message);
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

        if (status < 200 || status >= 300)
        {
            handleApiError(body, status);
            return;
        }

        if (gPendingAction == "history" && gTransferTargetName != "" && gTransferTargetAccountId == "")
        {
            gTransferTargetAccountId = resolveTransferAccountId(gTransferTargetName, body);
            if (gTransferTargetAccountId == "")
            {
                llRegionSayTo(gUser, 0, headerLine() + " Recipient not found.");
                clearPending();
                updateCache(body);
                showMainMenu();
                return;
            }
            sendRequest("transfer");
            return;
        }

        updateCache(body);
        llRegionSayTo(gUser, 0, headerLine() + " " + llJsonGetValue(body, ["message"]));
        if (gPendingAction == "history")
        {
            clearPending();
            showHistoryMenu();
            return;
        }
        clearPending();
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
