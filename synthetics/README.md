# Dashboard History Synthetic Scripts

## What are these for?

Currently, there is no in-product mapping of dashboard names to their GUIDs that persist once a dashboard has been deleted. While you only need a GUID to trigger a dashboard restoration, it can be very hard to know what dashboard a GUID represents without having the user-friendly names as reference.

These synthetic scripts are designed to query your dashboard entities and store a name-guid mapping - these can be referenced down the road to make restoration decisions.

Once there is in-product support for this mapping, we won't need to use these synthetics - but until then, you have to have one of these scripts running in order to enable dashboard restoration in the Dashboard Change History app.

## What do these scripts do?

For each target account, the scripts will load all active dashboards, extract the name for those dashboards, and write out an event to persist the name-guid mapping for future use in deletion scenarios.

The events are written to a custom event called `DasbhoardGuidNameMap`. Each event consists of:

- `dashboardGuid`: the dashboard GUID
- `dashboardName`: the user-friendly name assigned to the dashboard
- `account`: the id of the account the dashboard belongs to (note that `accountId` is a reserved name, and can't be used as a custom event attribute name)
- `accountName`: the name of the account the dashboard belongs to

## Why are there two scripts?

The two scripts basically do the same thing, with a subtle distinction:

- `createDashboardMappings.js` will accept an explicit list of accounts, query the dashboards for each, and write out a mapping into each account individually
- `createParentDashboardMappings.js` will determine the scope of accounts based on a provided `USER KEY`, and will write out mappings into one account (which generally speaking should be a Parent - aka Master - account)

### Which script should I use?

If you have a very large number of accounts and a centralized admin team to handle dashboard restoration requests, then the `createParentDashboardMappings.js` is probably simplest. Be aware that this will limit the accessible scope of the Dashboard Change History app - it can only be deployed to the account that holds the mappings, as no other accounts will be able to access this data.

If you want to make this functionality generally accessible to all permitted users, use the `createDashboardMappings.js` - this will support deploying the app to multiple accounts, and is the most flexible overall. It does have a higher burden of configuration, as you will need to define all target accounts in the script. (Each account has to be individually defined, as each account requires its own `LICENSE KEY` in order to write the data out into the correct account space.)

## How do I use the scripts?

Once you have determined which script is appropriate, simply set it up as an [API Synthetic Monitor](https://docs.newrelic.com/docs/synthetics/synthetic-monitoring/scripting-monitors/write-synthetic-api-tests/) in New Relic Synthetics. Each script has some configuration attributes that need to be set up - details on these are included in the script itself.

## Other considerations

### Monitor frequency

The period you use for the is really dependent on your overall concern for missing a dashboard delete event.

Since a mapping will only be created if the dashboard is found in the active listing, a dashboard that is created and then deleted in the period in-between runs will not be picked up (and will not show up in the Dashboard Change History listings).

Generally, hourly or above should be sufficient. We do not recommend using a monitor frequency less than 15 minutes.

### Mapping event volume

A custom event will be created per dashboard. So, if you have 1000 dashboards, then 1000 custom events will be created each time the monitor runs. If you run the monitor every hour, 24000 events will be created each day.

Each event has a small footprint, so the data overhead is very, very low. However, if you are highly constrained in terms of data consumption, this may be another point to consider when setting the monitor frequency.

### Mapping event lifespan

The custom events will be retained based on your standard retention policy governing custom events. The default retention period for this type of data is 30 days. If you have a custom retention policy, that retention period will be applied to this data.

The retention period governs how long a dashboard will be available for restoration in the Dashboard Change History app, as the app will only present dashboards for restoration if a name-guid mapping exists. Once a dashboard is deleted, it will no longer be refreshed in the `DasbhoardGuidNameMap` event type. The last reference to that dashboard, prior to its deletion, and will age out based on the retention period.
