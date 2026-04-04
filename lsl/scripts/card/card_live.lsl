integer MENU_MAIN = 0;
integer MENU_CONFIRM = 1;

integer SESSION_TIMEOUT = 120;
integer DIALOG_CHANNEL_BASE = -950000;

integer ACTION_NONE = 0;
integer ACTION_LOCK = 1;
integer ACTION_UNLOCK = 2;
integer ACTION_REPORT_STOLEN = 3;

string CONFIG_API_URL = "http://15.204.56.251/api/v1/portal";
string CONFIG_BOOTSTRAP_SECRET = "QbN2GpbUD2mO4M-bIZKAX_rE3cng549x";
string CONFIG_TENANT_ID = "";
string CONFIG_CARD_ID = "";
string CONFIG_BANK_NAME = "Cronan & Locke Systems";

key gCardOwner = NULL_KEY;
integer gMenuListen = 0;
integer gMenuChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAction = ACTION_NONE;
key gPendingRequest = NULL_KEY;
string gBankName = "";
string gCardNumber = "";
string gCardState = "UNKNOWN";
string gAccountId = "";
float gBalance = 0.0;
string gResolvedTenantId = "";
string gResolvedObjectSecret = "";

integer loadCachedConfig()
{
    string desc = llGetObjectDesc();

    if (llSubStringIndex(desc, "CLSCARD|") != 0)
    {
        return FALSE;
    }

    list parts = llParseStringKeepNulls(desc, ["|"], []);
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
    llSetObjectDesc("CLSCARD|" + gResolvedTenantId + "|" + gBankName + "|" + gResolvedObjectSecret);
    return 0;
}

string activeObjectSecret()
{
    if (gResolvedObjectSecret != "")
    {
        return gResolvedObjectSecret;
    }
    return CONFIG_BOOTSTRAP_SECRET;
}

string activeTenantId()
{
    if (gResolvedTenantId != "")
    {
        return gResolvedTenantId;
    }
    return CONFIG_TENANT_ID;
}

string activeCardId()
{
    if (CONFIG_CARD_ID != "")
    {
        return CONFIG_CARD_ID;
    }
    return (string)llGetKey();
}

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
    return "[" + activeBankName() + " Card]";
}

string ownerName()
{
    string full = llKey2Name(gCardOwner);
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

integer resetListener()
{
    if (gMenuListen)
    {
        llListenRemove(gMenuListen);
        gMenuListen = 0;
    }
    return 0;
}

integer endSession(string reason)
{
    if (gCardOwner != NULL_KEY && reason != "")
    {
        llRegionSayTo(gCardOwner, 0, headerLine() + " " + reason);
    }
    resetListener();
    gCurrentMenu = MENU_MAIN;
    gPendingAction = ACTION_NONE;
    gPendingRequest = NULL_KEY;
    llSetTimerEvent(0.0);
    return 0;
}

integer startSession(key avatar)
{
    if (gCardOwner == NULL_KEY)
    {
        gCardOwner = llGetOwner();
    }

    if (avatar != gCardOwner)
    {
        llRegionSayTo(avatar, 0, headerLine() + " Access denied. This card belongs to " + ownerName() + ".");
        return FALSE;
    }

    resetListener();
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    gPendingAction = ACTION_NONE;
    gPendingRequest = NULL_KEY;
    llSetTimerEvent((float)SESSION_TIMEOUT);
    return TRUE;
}

string buildRequestBody(string actionType)
{
    return llList2Json(
        JSON_OBJECT,
        [
            "action", "object_action",
            "object_type", "card",
            "action_type", actionType,
            "object_secret", activeObjectSecret(),
            "tenant_id", activeTenantId(),
            "card_id", activeCardId(),
            "avatar_key", (string)gCardOwner,
            "avatar_name", ownerName(),
            "object_owner_key", (string)llGetOwner(),
            "object_owner_name", ownerName()
        ]
    );
}

integer sendRequest(string actionType)
{
    if (gPendingRequest != NULL_KEY)
    {
        llRegionSayTo(gCardOwner, 0, headerLine() + " Please wait for the current request to finish.");
        return FALSE;
    }

    string requestBody = buildRequestBody(actionType);
    string postUrl = CONFIG_API_URL;

    if (postUrl == "")
    {
        llRegionSayTo(gCardOwner, 0, headerLine() + " Missing CONFIG_API_URL.");
        return FALSE;
    }

    gPendingRequest = llHTTPRequest(postUrl, [HTTP_METHOD, "POST", HTTP_MIMETYPE, "application/json"], requestBody);
    return TRUE;
}

list mainButtons()
{
    return ["View Card", "Lock Card", "Unlock Card", "Report Stolen", "Status", "Exit"];
}

list confirmButtons()
{
    return ["Confirm", "Cancel"];
}

integer dialog(key avatar, string message, list buttons, integer menuId)
{
    gCurrentMenu = menuId;
    llDialog(avatar, message, buttons, gMenuChannel);
    return 0;
}

integer showMainMenu()
{
    dialog(
        gCardOwner,
        activeBankName() + "\nBank Card\n\n"
        + "Owner: " + ownerName() + "\n"
        + "Card: " + gCardNumber + "\n"
        + "State: " + gCardState + "\n"
        + "Account: " + gAccountId + "\n"
        + "Balance: " + formatMoney(gBalance) + "\n\n"
        + "Select an option:",
        mainButtons(),
        MENU_MAIN
    );
    return 0;
}

integer showConfirmMenu()
{
    string actionName = "Action";

    if (gPendingAction == ACTION_LOCK)
    {
        actionName = "Lock Card";
    }
    else if (gPendingAction == ACTION_UNLOCK)
    {
        actionName = "Unlock Card";
    }
    else if (gPendingAction == ACTION_REPORT_STOLEN)
    {
        actionName = "Report Stolen";
    }

    dialog(
        gCardOwner,
        actionName + "\n\n"
        + "Owner: " + ownerName() + "\n"
        + "Card: " + gCardNumber + "\n"
        + "Current State: " + gCardState + "\n\n"
        + "Confirm this card action?",
        confirmButtons(),
        MENU_CONFIRM
    );
    return 0;
}

integer updateCache(string body)
{
    string bankName = llJsonGetValue(body, ["tenant", "bank_name"]);
    string cardNumber = llJsonGetValue(body, ["card", "card_number"]);
    string cardState = llJsonGetValue(body, ["card", "state"]);
    string accountId = llJsonGetValue(body, ["account", "account_id"]);
    string balance = llJsonGetValue(body, ["account", "balance"]);
    string tenantObjectSecret = llJsonGetValue(body, ["tenant_object_secret"]);

    if (bankName != JSON_INVALID)
    {
        gBankName = bankName;
        llSetObjectName(bankName + " Card");
    }
    string tenantId = llJsonGetValue(body, ["tenant", "tenant_id"]);
    if (cardNumber != JSON_INVALID)
    {
        gCardNumber = cardNumber;
    }
    if (cardState != JSON_INVALID)
    {
        gCardState = cardState;
    }
    if (accountId != JSON_INVALID)
    {
        gAccountId = accountId;
    }
    if (balance != JSON_INVALID)
    {
        gBalance = (float)balance;
    }
    if (tenantId != JSON_INVALID)
    {
        gResolvedTenantId = tenantId;
    }
    if (tenantObjectSecret != JSON_INVALID && tenantObjectSecret != "")
    {
        gResolvedObjectSecret = tenantObjectSecret;
    }
    saveCachedConfig();
    return 0;
}

integer handleApiError(string body, integer status)
{
    string error = llJsonGetValue(body, ["error"]);
    if (error == JSON_INVALID || error == "")
    {
        error = "HTTP " + (string)status;
    }
    llRegionSayTo(gCardOwner, 0, headerLine() + " " + error);
    showMainMenu();
    return 0;
}

integer applyPendingAction()
{
    if (gPendingAction == ACTION_LOCK)
    {
        sendRequest("lock");
    }
    else if (gPendingAction == ACTION_UNLOCK)
    {
        sendRequest("unlock");
    }
    else if (gPendingAction == ACTION_REPORT_STOLEN)
    {
        sendRequest("report_stolen");
    }
    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "View Card" || message == "Status")
    {
        sendRequest("status");
    }
    else if (message == "Lock Card")
    {
        gPendingAction = ACTION_LOCK;
        showConfirmMenu();
    }
    else if (message == "Unlock Card")
    {
        gPendingAction = ACTION_UNLOCK;
        showConfirmMenu();
    }
    else if (message == "Report Stolen")
    {
        gPendingAction = ACTION_REPORT_STOLEN;
        showConfirmMenu();
    }
    else if (message == "Exit")
    {
        endSession("Session closed.");
    }
    return 0;
}

integer handleConfirmChoice(string message)
{
    if (message == "Confirm")
    {
        applyPendingAction();
    }
    else
    {
        gPendingAction = ACTION_NONE;
        showMainMenu();
    }
    return 0;
}

default
{
    state_entry()
    {
        gCardOwner = llGetOwner();
        gBankName = CONFIG_BANK_NAME;
        loadCachedConfig();
        llSetObjectName(gBankName + " Card");
        llOwnerSay("Card live script ready. Touch to open the live card menu. Tenant, branding, and the tenant object secret are detected automatically.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        if (startSession(avatar))
        {
            llRegionSayTo(avatar, 0, headerLine() + " Opening card session...");
            sendRequest("session");
        }
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gCardOwner)
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
            else if (gCurrentMenu == MENU_CONFIRM)
            {
                handleConfirmChoice(message);
            }
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

        updateCache(body);
        llRegionSayTo(
            gCardOwner,
            0,
            headerLine() + "\n"
            + llJsonGetValue(body, ["message"]) + "\n"
            + "Card: " + gCardNumber + "\n"
            + "State: " + gCardState + "\n"
            + "Account: " + gAccountId + "\n"
            + "Balance: " + formatMoney(gBalance)
        );

        gPendingAction = ACTION_NONE;
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
