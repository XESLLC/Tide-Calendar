

let createEvent = async (calendar, auth, calendarId, event) => {
    await calendar.events.insert(
        {
            auth: auth,
            calendarId: calendarId,
            resource: event
        }
    );
}

module.exports.createEvent = createEvent
