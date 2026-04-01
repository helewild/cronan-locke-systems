string CONFIG_TENANT_ID = "demo-tenant";
string CONFIG_REGION_ID = "demo-region";
string CONFIG_LOCATION_ID = "main-location";
string CONFIG_OBJECT_ID = "object-001";
integer CONFIG_SESSION_TIMEOUT = 120;

string formatScope()
{
    return CONFIG_TENANT_ID + "/" + CONFIG_REGION_ID + "/" + CONFIG_LOCATION_ID + "/" + CONFIG_OBJECT_ID;
}

string customerName(key avatar)
{
    string name = llKey2Name(avatar);
    if (name == "")
    {
        return "Customer";
    }
    return name;
}

default
{
    state_entry()
    {
        llOwnerSay("Shared template placeholder loaded.");
    }
}
