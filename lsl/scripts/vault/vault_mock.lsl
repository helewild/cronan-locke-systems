integer MENU_MAIN = 0;
integer MENU_CONFIRM = 1;

integer SESSION_TIMEOUT = 120;
integer DIALOG_CHANNEL_BASE = -980000;

integer VAULT_STATE_SECURE = 0;
integer VAULT_STATE_ARMED = 1;
integer VAULT_STATE_BREACHING = 2;
integer VAULT_STATE_LOCKDOWN = 3;
integer VAULT_STATE_OPENED = 4;

integer ACTION_NONE = 0;
integer ACTION_ARM = 1;
integer ACTION_START_BREACH = 2;
integer ACTION_TRIGGER_LOCKDOWN = 3;
integer ACTION_RESET = 4;
integer ACTION_COLLECT = 5;

string CONFIG_BANK_NAME = "Whispering Pines Bank";
string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_BRANCH_ID = "main-branch";
string CONFIG_VAULT_ID = "vault-001";
string CONFIG_SECURITY_CHANNEL = "Security Dispatch";

integer gVaultState = VAULT_STATE_SECURE;
integer gMenuListen = 0;
integer gMenuChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAction = ACTION_NONE;
key gActiveUser = NULL_KEY;
integer gBreachTimeRemaining = 0;
integer gMockMarkedCash = 2500;
string gLastActor = "";

integer randomPrivateChannel(integer base)
{
    return base - (integer)llFrand(1000000.0);
}

string headerLine()
{
    return "[" + CONFIG_BANK_NAME + " Vault]";
}

string scopeLabel()
{
    return CONFIG_TENANT_ID + "/" + CONFIG_REGION_ID + "/" + CONFIG_BRANCH_ID;
}

string actorName(key avatar)
{
    string full;

    if (avatar == NULL_KEY)
    {
        return "Unknown";
    }

    full = llKey2Name(avatar);
    if (full == "")
    {
        return "Unknown";
    }
    return full;
}

string vaultStateLabel()
{
    if (gVaultState == VAULT_STATE_SECURE)
    {
        return "SECURE";
    }
    if (gVaultState == VAULT_STATE_ARMED)
    {
        return "ARMED";
    }
    if (gVaultState == VAULT_STATE_BREACHING)
    {
        return "BREACH IN PROGRESS";
    }
    if (gVaultState == VAULT_STATE_LOCKDOWN)
    {
        return "LOCKDOWN";
    }
    if (gVaultState == VAULT_STATE_OPENED)
    {
        return "OPENED";
    }
    return "UNKNOWN";
}

string actionLabel(integer actionId)
{
    if (actionId == ACTION_ARM)
    {
        return "Arm Vault";
    }
    if (actionId == ACTION_START_BREACH)
    {
        return "Start Breach";
    }
    if (actionId == ACTION_TRIGGER_LOCKDOWN)
    {
        return "Trigger Lockdown";
    }
    if (actionId == ACTION_RESET)
    {
        return "Reset Vault";
    }
    if (actionId == ACTION_COLLECT)
    {
        return "Collect Marked Cash";
    }
    return "Action";
}

list mainButtons()
{
    if (gVaultState == VAULT_STATE_SECURE)
    {
        return ["Arm Vault", "Status"];
    }
    if (gVaultState == VAULT_STATE_ARMED)
    {
        return ["Start Breach", "Lockdown", "Status", "Reset"];
    }
    if (gVaultState == VAULT_STATE_BREACHING)
    {
        return ["Lockdown", "Status"];
    }
    if (gVaultState == VAULT_STATE_LOCKDOWN)
    {
        return ["Status", "Reset"];
    }
    return ["Collect Cash", "Status", "Reset"];
}

list confirmButtons()
{
    return ["Confirm", "Cancel"];
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

integer clearPendingAction()
{
    gPendingAction = ACTION_NONE;
    return 0;
}

integer endSession(string reason)
{
    if (gActiveUser != NULL_KEY && reason != "")
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " " + reason);
    }

    resetListener();
    gCurrentMenu = MENU_MAIN;
    clearPendingAction();
    gActiveUser = NULL_KEY;

    if (gVaultState != VAULT_STATE_BREACHING)
    {
        llSetTimerEvent(0.0);
    }
    return 0;
}

integer startSession(key avatar)
{
    resetListener();
    gActiveUser = avatar;
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    clearPendingAction();
    llSetTimerEvent((gVaultState == VAULT_STATE_BREACHING) ? 1.0 : (float)SESSION_TIMEOUT);
    return 0;
}

integer dialog(key avatar, string message, list buttons, integer menuId)
{
    gCurrentMenu = menuId;
    llDialog(avatar, message, buttons, gMenuChannel);
    return 0;
}

integer sendSilentAlert(string detail)
{
    llRegionSayTo(
        gActiveUser,
        0,
        "[" + CONFIG_SECURITY_CHANNEL + "] Silent Alert\n"
        + "Vault: " + CONFIG_VAULT_ID + "\n"
        + "Scope: " + scopeLabel() + "\n"
        + "Actor: " + gLastActor + "\n"
        + "Detail: " + detail + "\n"
        + "Status: MOCK ALERT"
    );
    return 0;
}

integer showMainMenu()
{
    string message = CONFIG_BANK_NAME + "\nVault Control\n\n"
        + "Vault ID: " + CONFIG_VAULT_ID + "\n"
        + "State: " + vaultStateLabel() + "\n"
        + "Marked Cash: L$" + (string)gMockMarkedCash + "\n"
        + "Scope: " + scopeLabel() + "\n";

    if (gVaultState == VAULT_STATE_BREACHING)
    {
        message = message + "Breach Timer: " + (string)gBreachTimeRemaining + " seconds\n";
    }

    message = message + "\nSelect an option:";

    dialog(gActiveUser, message, mainButtons(), MENU_MAIN);
    return 0;
}

integer showConfirmMenu()
{
    string message = actionLabel(gPendingAction) + "\n\n"
        + "Vault: " + CONFIG_VAULT_ID + "\n"
        + "State: " + vaultStateLabel() + "\n"
        + "Actor: " + gLastActor + "\n\n"
        + "Confirm this security action?";

    dialog(gActiveUser, message, confirmButtons(), MENU_CONFIRM);
    return 0;
}

integer showStatus()
{
    string message = headerLine() + "\nVault Status\n"
        + "Vault ID: " + CONFIG_VAULT_ID + "\n"
        + "State: " + vaultStateLabel() + "\n"
        + "Marked Cash Reserve: L$" + (string)gMockMarkedCash + "\n"
        + "Last Actor: " + gLastActor + "\n"
        + "Scope: " + scopeLabel() + "\n";

    if (gVaultState == VAULT_STATE_BREACHING)
    {
        message = message + "Breach Timer: " + (string)gBreachTimeRemaining + " seconds\n";
    }

    message = message + "Mode: MOCK DATA";

    llRegionSayTo(gActiveUser, 0, message);
    showMainMenu();
    return 0;
}

integer completeBreach()
{
    gVaultState = VAULT_STATE_OPENED;
    llSetTimerEvent((float)SESSION_TIMEOUT);
    llRegionSayTo(
        gActiveUser,
        0,
        headerLine() + "\nVault Breach Complete\n"
        + "Vault: " + CONFIG_VAULT_ID + "\n"
        + "Marked Cash Available: L$" + (string)gMockMarkedCash + "\n"
        + "Status: OPENED\n"
        + "Note: Marked cash is mock-only in this build."
    );
    showMainMenu();
    return 0;
}

integer applyPendingAction()
{
    if (gPendingAction == ACTION_ARM)
    {
        gVaultState = VAULT_STATE_ARMED;
        llRegionSayTo(gActiveUser, 0, headerLine() + " Vault armed.");
    }
    else if (gPendingAction == ACTION_START_BREACH)
    {
        gVaultState = VAULT_STATE_BREACHING;
        gBreachTimeRemaining = 30;
        llSetTimerEvent(1.0);
        llRegionSayTo(
            gActiveUser,
            0,
            headerLine() + "\nBreach Started\n"
            + "Timer: 30 seconds\n"
            + "Silent alert has been sent."
        );
        sendSilentAlert("Breach started on vault " + CONFIG_VAULT_ID);
    }
    else if (gPendingAction == ACTION_TRIGGER_LOCKDOWN)
    {
        gVaultState = VAULT_STATE_LOCKDOWN;
        gBreachTimeRemaining = 0;
        llSetTimerEvent((float)SESSION_TIMEOUT);
        llRegionSayTo(
            gActiveUser,
            0,
            headerLine() + "\nLockdown Triggered\n"
            + "Vault access denied.\n"
            + "Security channels notified."
        );
        sendSilentAlert("Lockdown triggered on vault " + CONFIG_VAULT_ID);
    }
    else if (gPendingAction == ACTION_RESET)
    {
        gVaultState = VAULT_STATE_SECURE;
        gBreachTimeRemaining = 0;
        gMockMarkedCash = 2500;
        llSetTimerEvent((float)SESSION_TIMEOUT);
        llRegionSayTo(gActiveUser, 0, headerLine() + " Vault reset to secure state.");
    }
    else if (gPendingAction == ACTION_COLLECT)
    {
        llRegionSayTo(
            gActiveUser,
            0,
            headerLine() + "\nMarked Cash Collected\n"
            + "Amount: L$" + (string)gMockMarkedCash + "\n"
            + "Tag: TRACEABLE CURRENCY\n"
            + "Status: MOCK PAYOUT ONLY"
        );
        gMockMarkedCash = 0;
        gVaultState = VAULT_STATE_LOCKDOWN;
    }

    clearPendingAction();
    showMainMenu();
    return 0;
}

integer handleMainChoice(string message)
{
    gLastActor = actorName(gActiveUser);

    if (message == "Arm Vault")
    {
        gPendingAction = ACTION_ARM;
        showConfirmMenu();
    }
    else if (message == "Start Breach")
    {
        gPendingAction = ACTION_START_BREACH;
        showConfirmMenu();
    }
    else if (message == "Lockdown")
    {
        gPendingAction = ACTION_TRIGGER_LOCKDOWN;
        showConfirmMenu();
    }
    else if (message == "Reset")
    {
        gPendingAction = ACTION_RESET;
        showConfirmMenu();
    }
    else if (message == "Collect Cash")
    {
        gPendingAction = ACTION_COLLECT;
        showConfirmMenu();
    }
    else if (message == "Status")
    {
        showStatus();
    }
    return 0;
}

integer handleConfirmChoice(string message)
{
    if (message == "Confirm")
    {
        applyPendingAction();
    }
    else if (message == "Cancel")
    {
        llRegionSayTo(gActiveUser, 0, headerLine() + " Action canceled.");
        clearPendingAction();
        showMainMenu();
    }
    return 0;
}

default
{
    state_entry()
    {
        llSetObjectName(CONFIG_BANK_NAME + " Vault");
        llOwnerSay("Vault mock script ready. Touch to access vault controls.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        startSession(avatar);
        showMainMenu();
    }

    listen(integer channel, string name, key id, string message)
    {
        if (id != gActiveUser)
        {
            return;
        }

        if (gVaultState != VAULT_STATE_BREACHING)
        {
            llSetTimerEvent((float)SESSION_TIMEOUT);
        }

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

    timer()
    {
        if (gVaultState == VAULT_STATE_BREACHING)
        {
            --gBreachTimeRemaining;

            if (gBreachTimeRemaining == 20 || gBreachTimeRemaining == 10 || gBreachTimeRemaining == 5)
            {
                if (gActiveUser != NULL_KEY)
                {
                    llRegionSayTo(
                        gActiveUser,
                        0,
                        headerLine() + " Breach timer: " + (string)gBreachTimeRemaining + " seconds remaining."
                    );
                }
            }

            if (gBreachTimeRemaining <= 0)
            {
                completeBreach();
            }
        }
        else
        {
            endSession("Session timed out.");
        }
    }

    changed(integer change)
    {
        if (change & (CHANGED_OWNER | CHANGED_INVENTORY))
        {
            llResetScript();
        }
    }
}
