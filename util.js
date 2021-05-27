

let createEvent = async (calendar, auth, calendarId, event) => {
    await calendar.events.insert(
        {
            auth: auth,
            calendarId: calendarId,
            resource: event
        }
    );
   // slow speed of event creation to meet api requirements ??
}

module.exports.createEvent = createEvent
