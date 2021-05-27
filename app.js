const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'credentials.json';
// asset and channel characteristics
// calculation made all in inches, milliseconds and minutes
// all time calcs in UTC
// xml from noa adjusted for daylight savings - see screen shot in directory


// asset and channel characteristics
// calculation made all in inches and minutes
const draftOfBoat = 5 * 12 // convert to inches
const lowestInPath0MeanTide = 3.5 * 12 // convert to inches
const nameOfPath = 'Mananlapan'
const delayFromNOA = 0
const noaTideLocation = 'BOYNTON BEACH, FL'
const noaTideLocationId = '8722706'
const tideArray = require('./xmlToArray').tideArray;

// Load client secrets from a local file.
try {
  const content = fs.readFileSync('client_secret.json');
  authorize(JSON.parse(content), insertEvents);
} catch (err) {
  return console.log('Error loading client secret file:', err);
}

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 * @return {function} if error in reading credentials.json asks for a new one.
 */
function authorize(credentials, callback) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  let token = {};
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://127.0.0.1:3000"
  );

  // Check if we have previously stored a token.
  try {
    token = fs.readFileSync(TOKEN_PATH);
    console.log('Retrieved prevoiusly stored token');
  } catch (err) {
    return getAccessToken(oAuth2Client, callback);
  }
  oAuth2Client.setCredentials(JSON.parse(token));
  console.log('oAuth2Client', oAuth2Client.credentials);
  callback(oAuth2Client);
}
/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.question('Enter the code from that page here: ', code => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return callback(err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      try {
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
        console.log('Token stored to', TOKEN_PATH);
      } catch (err) {
        console.error(err);
      }
      callback(oAuth2Client);
    });
  });
}


console.log('Starting tide mapping and algo')

const tideMap = tideArray.map((prediction, index, array) => {
    if (index == 0 || !array[index+1] || prediction.highlow[0] !== 'L' ) {
        return {}
    } // if first or last prediction dont create valid tideMap object
    let dateAndTimeToUtcMilli = (dateArray, timeArray) => {
      const timeParts = timeArray[0].split(":") //split hours and minutes
      const millisecondsFromDayStart = (( Number(timeParts[0])) * (60000 * 60)) + ( Number(timeParts[1]) * 60000)
      return new Date(dateArray[0]).getTime() + millisecondsFromDayStart // milliseconds utc
    }
    // times in millisconds
    const timeAtPrevHigh = dateAndTimeToUtcMilli(array[index-1].date, array[index-1].time)
    const timeAtLow = dateAndTimeToUtcMilli(prediction.date, prediction.time)
    const timeAtNextHigh = dateAndTimeToUtcMilli(array[index+1].date, array[index+1].time)

    // convert to inches with respect to mean 0 low tide
    const heightAtPrevHighAboveMeanZero =  Math.round((Number(array[index-1].pred[0]) * 12) * 100) / 100
    const heightAtCurrLowBelowMeanZero = Math.round((Number(prediction.pred[0]) * 12) * 100) / 100
    const heightAtNextHighAboveMeanZero = Math.round((Number(array[index+1].pred[0]) * 12) * 100) / 100

    // tide rate milliseconds/inch
    const prevTideRate = Math.round((timeAtLow - timeAtPrevHigh)/(heightAtPrevHighAboveMeanZero - heightAtCurrLowBelowMeanZero)*100)/100
    const nextTideRate = Math.round((timeAtNextHigh - timeAtLow)/(heightAtNextHighAboveMeanZero - heightAtCurrLowBelowMeanZero)*100)/100

    const neededTideIncreasefromLow = draftOfBoat - lowestInPath0MeanTide - (Number(prediction.pred[0]) * 12)

    const prevStopOperatingTime = neededTideIncreasefromLow * prevTideRate //millisconds to stop operating before low tide
    const endStopOperatingTime = neededTideIncreasefromLow * nextTideRate // millisconds from low tide cant operate

    const eventDontRunStartTime = new Date(timeAtLow - prevStopOperatingTime - (6 * 60 * 60 * 1000))
    const eventDontRunEndTime = new Date(timeAtLow + endStopOperatingTime - (6 * 60 * 60 * 1000))

    return {
      evtdontRunStartTime: eventDontRunStartTime,
      eventdontRunEndTime: eventDontRunEndTime
    }
}).filter((noOpRange) => {
    return !!noOpRange.evtdontRunStartTime
})

for (const tideEvent of tideMap) {
    function insertEvents(auth) {
      const calendar = google.calendar({ version: 'v3', auth });
      var event = {
        summary: 'Dont Drive Your Boat Asshole!',
        location: 'SOMEWHERE IN FL',
        description: "None Needed",
        start: {
          dateTime: '2021-05-28T09:00:00',
          timeZone: 'America/New_York'
        },
        end: {
          dateTime: '2021-05-28T17:00:00',
          timeZone: 'America/New_York'
        },
        // recurrence: ['RRULE:FREQ=DAILY;COUNT=2'], creating a single event looping throught the tide array for each event
        //attendees: [{ email: 'lpage@example.com' }, { email: 'sbrin@example.com' }], // this could also be list of licensed users
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 5 },
            { method: 'popup', minutes: 5 }
          ]
        }
      };

      // calendar.events.insert(
      //   {
      //     auth: auth,
      //     calendarId: '26cb0kkf1du7ol3dtgd5fcpvc0@group.calendar.google.com',
      //     resource: event
      //   },
      //   function(err, event) {
      //     if (err) {
      //       console.log(
      //         'There was an error contacting the Calendar service: ' + err
      //       );
      //       return;
      //     }
      //     console.log('Event created: %s', event.data.htmlLink);
      //   }
      // );
    }
}
