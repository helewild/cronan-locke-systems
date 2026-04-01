integer MENU_MAIN = 0;
integer MENU_INCIDENT = 1;
integer MENU_CONFIRM = 2;

integer SESSION_TIMEOUT = 180;
integer DIALOG_CHANNEL_BASE = -990000;

integer ACTION_NONE = 0;
integer ACTION_ACKNOWLEDGE = 1;
integer ACTION_DISPATCH = 2;
integer ACTION_MARK_ARRIVED = 3;
integer ACTION_RESOLVE = 4;
integer ACTION_RESET = 5;

string CONFIG_BANK_NAME = "Whispering Pines Bank";
string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_BRANCH_ID = "main-branch";
string CONFIG_TERMINAL_ID = "security-001";
string CONFIG_TERMINAL_NAME = "Security Dispatch";

key gActiveUser = NULL_KEY;
integer gMenuListen = 0;
integer gMenuChannel = 0;
integer gCurrentMenu = MENU_MAIN;
integer gPendingAction = ACTION_NONE;

list gSecurityWhitelist = [
    "Xander Evergarden",
    "Bank Manager",
    "Lead Teller",
    "Police Chief",
    "Security Officer"
];

string gIncidentId = "WPB-VLT-40001";
string gIncidentState = "ACTIVE";
string gIncidentStage = "BREACH STARTED";
string gIncidentVaultId = "vault-001";
string gIncidentActor = "Unknown Suspect";
string gIncidentRespondingUnit = "NONE";
string gIncidentLastUpdate = "Silent alert received";
integer gIncidentCashFlag = FALSE;

integer randomPrivateChannel(integer base)
{
    return base - (integer)llFrand(1000000.0);
}

string headerLine()
{
    return "[" + CONFIG_BANK_NAME + " Security]";
}

string scopeLabel()
{
    return CONFIG_TENANT_ID + "/" + CONFIG_REGION_ID + "/" + CONFIG_BRANCH_ID;
}

string userName(key avatar)
{
    string full = llKey2Name(avatar);
    if (full == "")
    {
        return "Unknown Officer";
    }
    return full;
}

integer isAuthorized(key avatar)
{
    if (~llListFindList(gSecurityWhitelist, [userName(avatar)]))
    {
        return TRUE;
    }
    return FALSE;
}

string actionLabel(integer actionId)
{
    if (actionId == ACTION_ACKNOWLEDGE)
    {
        return "Acknowledge Alert";
    }
    if (actionId == ACTION_DISPATCH)
    {
        return "Dispatch Unit";
    }
    if (actionId == ACTION_MARK_ARRIVED)
    {
        return "Mark Unit Arrived";
    }
    if (actionId == ACTION_RESOLVE)
    {
        return "Resolve Incident";
    }
    if (actionId == ACTION_RESET)
    {
        return "Reset Incident";
    }
    return "Action";
}

list mainButtons()
{
    return ["View Incident", "Dispatch Board", "Reset Incident", "Close"];
}

list incidentButtons()
{
    if (gIncidentState == "ACTIVE" && gIncidentStage == "BREACH STARTED")
    {
        return ["Acknowledge", "Dispatch", "Back"];
    }
    if (gIncidentState == "ACTIVE" && gIncidentStage == "UNIT DISPATCHED")
    {
        return ["Mark Arrived", "Resolve", "Back"];
    }
    if (gIncidentState == "ACTIVE" && gIncidentStage == "UNIT ON SCENE")
    {
        return ["Resolve", "Back"];
    }
    if (gIncidentState == "RESOLVED")
    {
        return ["Back"];
    }
    return ["Acknowledge", "Dispatch", "Mark Arrived", "Resolve", "Back"];
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

integer resetIncident()
{
    gIncidentId = "WPB-VLT-40001";
    gIncidentState = "ACTIVE";
    gIncidentStage = "BREACH STARTED";
    gIncidentVaultId = "vault-001";
    gIncidentActor = "Unknown Suspect";
    gIncidentRespondingUnit = "NONE";
    gIncidentLastUpdate = "Silent alert received";
    gIncidentCashFlag = FALSE;
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
    llSetTimerEvent(0.0);
    return 0;
}

integer startSession(key avatar)
{
    if (!isAuthorized(avatar))
    {
        llRegionSayTo(avatar, 0, headerLine() + " Access denied. Security authorization required.");
        return 0;
    }

    resetListener();
    gActiveUser = avatar;
    gMenuChannel = randomPrivateChannel(DIALOG_CHANNEL_BASE);
    gMenuListen = llListen(gMenuChannel, "", avatar, "");
    gCurrentMenu = MENU_MAIN;
    clearPendingAction();
    llSetTimerEvent((float)SESSION_TIMEOUT);
    llRegionSayTo(
        gActiveUser,
        0,
        headerLine() + "\nTerminal session opened for " + userName(gActiveUser)
        + "\nTerminal: " + CONFIG_TERMINAL_ID
        + "\nScope: " + scopeLabel()
        + "\nMode: MOCK DISPATCH"
    );
    return 0;
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
        gActiveUser,
        CONFIG_BANK_NAME + "\nSecurity Terminal\n\n"
        + "Incident: " + gIncidentId + "\n"
        + "State: " + gIncidentState + "\n"
        + "Stage: " + gIncidentStage + "\n"
        + "Vault: " + gIncidentVaultId + "\n"
        + "Responding Unit: " + gIncidentRespondingUnit + "\n\n"
        + "Select an option:",
        mainButtons(),
        MENU_MAIN
    );
    return 0;
}

integer showIncidentMenu()
{
    string message = "Incident Review\n\n"
        + "Incident ID: " + gIncidentId + "\n"
        + "State: " + gIncidentState + "\n"
        + "Stage: " + gIncidentStage + "\n"
        + "Vault: " + gIncidentVaultId + "\n"
        + "Actor: " + gIncidentActor + "\n"
        + "Responding Unit: " + gIncidentRespondingUnit + "\n"
        + "Marked Cash Flag: ";

    if (gIncidentCashFlag)
    {
        message = message + "YES\n";
    }
    else
    {
        message = message + "NO\n";
    }

    message = message
        + "Last Update: " + gIncidentLastUpdate + "\n"
        + "Scope: " + scopeLabel() + "\n\n"
        + "Select an action:";

    dialog(gActiveUser, message, incidentButtons(), MENU_INCIDENT);
    return 0;
}

integer showDispatchBoard()
{
    llRegionSayTo(
        gActiveUser,
        0,
        headerLine() + "\nDispatch Board\n"
        + "Incident: " + gIncidentId + "\n"
        + "Vault: " + gIncidentVaultId + "\n"
        + "State: " + gIncidentState + "\n"
        + "Stage: " + gIncidentStage + "\n"
        + "Responding Unit: " + gIncidentRespondingUnit + "\n"
        + "Last Update: " + gIncidentLastUpdate + "\n"
        + "Mode: MOCK DISPATCH"
    );
    showMainMenu();
    return 0;
}

integer showConfirmMenu()
{
    dialog(
        gActiveUser,
        actionLabel(gPendingAction) + "\n\n"
        + "Incident: " + gIncidentId + "\n"
        + "Stage: " + gIncidentStage + "\n"
        + "Officer: " + userName(gActiveUser) + "\n\n"
        + "Confirm this dispatch action?",
        confirmButtons(),
        MENU_CONFIRM
    );
    return 0;
}

integer applyPendingAction()
{
    if (gPendingAction == ACTION_ACKNOWLEDGE)
    {
        gIncidentLastUpdate = "Alert acknowledged by " + userName(gActiveUser);
        llRegionSayTo(gActiveUser, 0, headerLine() + " Alert acknowledged.");
    }
    else if (gPendingAction == ACTION_DISPATCH)
    {
        gIncidentStage = "UNIT DISPATCHED";
        gIncidentRespondingUnit = "Unit 12";
        gIncidentLastUpdate = "Unit 12 dispatched by " + userName(gActiveUser);
        llRegionSayTo(
            gActiveUser,
            0,
            headerLine() + "\nDispatch Sent\n"
            + "Unit: " + gIncidentRespondingUnit + "\n"
            + "Destination: " + gIncidentVaultId + "\n"
            + "Status: EN ROUTE"
        );
    }
    else if (gPendingAction == ACTION_MARK_ARRIVED)
    {
        gIncidentStage = "UNIT ON SCENE";
        gIncidentLastUpdate = gIncidentRespondingUnit + " arrived on scene";
        llRegionSayTo(gActiveUser, 0, headerLine() + " Responding unit marked on scene.");
    }
    else if (gPendingAction == ACTION_RESOLVE)
    {
        gIncidentState = "RESOLVED";
        gIncidentStage = "SCENE CLEARED";
        gIncidentCashFlag = TRUE;
        gIncidentLastUpdate = "Incident resolved by " + userName(gActiveUser);
        llRegionSayTo(
            gActiveUser,
            0,
            headerLine() + "\nIncident Resolved\n"
            + "Incident: " + gIncidentId + "\n"
            + "Marked Cash Flag: YES\n"
            + "Status: CLOSED"
        );
    }
    else if (gPendingAction == ACTION_RESET)
    {
        resetIncident();
        llRegionSayTo(gActiveUser, 0, headerLine() + " Incident board reset to mock default.");
    }

    clearPendingAction();
    showMainMenu();
    return 0;
}

integer handleMainChoice(string message)
{
    if (message == "View Incident")
    {
        showIncidentMenu();
    }
    else if (message == "Dispatch Board")
    {
        showDispatchBoard();
    }
    else if (message == "Reset Incident")
    {
        gPendingAction = ACTION_RESET;
        showConfirmMenu();
    }
    else if (message == "Close")
    {
        endSession("Session closed.");
    }
    return 0;
}

integer handleIncidentChoice(string message)
{
    if (message == "Acknowledge")
    {
        gPendingAction = ACTION_ACKNOWLEDGE;
        showConfirmMenu();
    }
    else if (message == "Dispatch")
    {
        gPendingAction = ACTION_DISPATCH;
        showConfirmMenu();
    }
    else if (message == "Mark Arrived")
    {
        gPendingAction = ACTION_MARK_ARRIVED;
        showConfirmMenu();
    }
    else if (message == "Resolve")
    {
        gPendingAction = ACTION_RESOLVE;
        showConfirmMenu();
    }
    else if (message == "Back")
    {
        showMainMenu();
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
        llSetObjectName(CONFIG_BANK_NAME + " Security");
        llOwnerSay("Security terminal mock script ready. Touch to open dispatch.");
    }

    touch_start(integer count)
    {
        key avatar = llDetectedKey(0);
        startSession(avatar);
        if (gActiveUser == avatar)
        {
            showMainMenu();
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
            else if (gCurrentMenu == MENU_INCIDENT)
            {
                handleIncidentChoice(message);
            }
            else if (gCurrentMenu == MENU_CONFIRM)
            {
                handleConfirmChoice(message);
            }
        }
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
