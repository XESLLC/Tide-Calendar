const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');


 try {

 const credentials = {
   "client_secret": "jvFf4w6PdGBjTpEzuBQVwA36",
   "client_id": "355987861353-qde5fi3vrqgf9ocaov1gk0kskmnafu7t.apps.googleusercontent.com",
   "redirect_uris": "https//:wwww.oceansyachting.com"
 }

 function listEvents(auth) {
   calendar.events.list({
     calendarId: 'primary',
     timeMin: (new Date()).toISOString(),
     maxResults: 10,
     singleEvents: true,
     orderBy: 'startTime',
   }, (err, res) => {
     if (err) return console.log('The API returned an error: ' + err);
     const events = res.data.items;
     if (events.length) {
       console.log('Upcoming 10 events:');
       events.map((event, i) => {
         const start = event.start.dateTime || event.start.date;
         console.log(`${start} - ${event.summary}`);
       });
     } else {
       console.log('No upcoming events found.');
     }
   });
 }

 /**
  * Create events
  * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
  */
  var event = {
    'summary': 'Google I/O 2015',
    'location': '800 Howard St., San Francisco, CA 94103',
    'description': 'A chance to hear more about Google\'s developer products.',
    'start': {
      'dateTime': '2021-06-28T09:00:00-07:00',
      'timeZone': 'America/Los_Angeles',
    },
    'end': {
      'dateTime': '2015-06-28T17:00:00-07:00',
      'timeZone': 'America/Los_Angeles',
    },
    'recurrence': [
      'RRULE:FREQ=DAILY;COUNT=2'
    ],
    'attendees': [
      {'email': 'lpage@example.com'},
      {'email': 'sbrin@example.com'},
    ],
    'reminders': {
      'useDefault': false,
      'overrides': [
        {'method': 'email', 'minutes': 24 * 60},
        {'method': 'popup', 'minutes': 10},
      ],
    },
  };

  calendar.events.insert({
    auth: auth,
    calendarId: 'c_vmtvfshllh80mbvu0a0ofoo820@group.calendar.google.com',
    resource: event,
  }, function(err, event) {
    if (err) {
      console.log('There was an error contacting the Calendar service: ' + err);
      return;
    }
    console.log('Event created: %s', event.htmlLink);
  });

 } catch (e) {
   console.log(e);
 } finally {
   console.log('finished');
 }


// const oauth2Client = new google.auth.OAuth2(
//   '355987861353-qde5fi3vrqgf9ocaov1gk0kskmnafu7t.apps.googleusercontent.com',
//   'jvFf4w6PdGBjTpEzuBQVwA36',
//   'https//:wwww.oceansyachting.com'
// );
