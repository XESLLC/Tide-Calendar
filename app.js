const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const TOKEN_PATH = 'credentials.json';
const createEvent = require('./util').createEvent
const calendarId = '9qn0k4a30hkb1mqlel7nrhf6cs@group.calendar.google.com'
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
const eventColor = 3; //1 blue,, 2 green, 3 purple, 4 red, 5 yellow, 6 orange, 7 turquoise, 8 gray, 9 bold blue, 10 bold green, 11 bold red

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

async function insertEvents (auth) {
    console.log('Starting tide mapping and algo')

    const calendar = google.calendar({ version: 'v3', auth });

    const tideMap = tideArray.map((prediction, index, array) => {
        if (index == 0 || !array[index+1] || prediction.highlow[0] !== 'L' ) {
            return {}
        } // if first or last prediction dont create valid tideMap object
        let dateAndTimeToUtcMilli = (dateArray, timeArray) => {
          const timeParts = timeArray[0].split(":") //split hours and minutes
          const millisecondsFromDayStart = (( Number(timeParts[0])) * (60000 * 60)) + ( Number(timeParts[1]) * 60000)
          return new Date(dateArray[0]).getTime() + millisecondsFromDayStart // milliseconds utc
        }
        // times in millisconds UTC
        const timeAtPrevHigh = dateAndTimeToUtcMilli(array[index-1].date, array[index-1].time)
        const timeAtLow = dateAndTimeToUtcMilli(prediction.date, prediction.time)
        const timeAtNextHigh = dateAndTimeToUtcMilli(array[index+1].date, array[index+1].time)

        console.log(new Date(timeAtPrevHigh), array[index-1].time , new Date(timeAtLow), prediction.time, array[index+1].time,  new Date(timeAtNextHigh) )

        // convert to inches with respect to mean 0 low tide
        const heightAtPrevHighAboveMeanZero =  Math.round((Number(array[index-1].pred[0]) * 12) * 100) / 100
        const heightAtCurrLowBelowMeanZero = Math.round((Number(prediction.pred[0]) * 12) * 100) / 100
        const heightAtNextHighAboveMeanZero = Math.round((Number(array[index+1].pred[0]) * 12) * 100) / 100

        // tide rate milliseconds/inch
        const prevTideRate = Math.round((timeAtLow - timeAtPrevHigh)/(heightAtPrevHighAboveMeanZero - heightAtCurrLowBelowMeanZero)*100)/100
        const nextTideRate = Math.round((timeAtNextHigh - timeAtLow)/(heightAtNextHighAboveMeanZero - heightAtCurrLowBelowMeanZero)*100)/100


        const neededTideIncreasefromLow = Math.round((draftOfBoat - lowestInPath0MeanTide - (Number(prediction.pred[0]) * 12))*100)/100

        const prevStopOperatingTime = neededTideIncreasefromLow * prevTideRate //millisconds to stop operating before low tide
        const endStopOperatingTime = neededTideIncreasefromLow * nextTideRate // millisconds from low tide cant operate

        const eventDontRunStartTime = new Date(timeAtLow - prevStopOperatingTime - (6 * 60 * 60 * 1000))
        const eventDontRunEndTime = new Date(timeAtLow + endStopOperatingTime - (6  * 60 * 60 * 1000))

        const resultSched =  {
          evtdontRunStartTime: eventDontRunStartTime,
          eventdontRunEndTime: eventDontRunEndTime
        }
        console.log("resultSched", resultSched);
        return resultSched
    }).filter((noOpRange) => {
        return !!noOpRange.evtdontRunStartTime
    })

    console.log('TideMappingComplete - total tide events = ', tideMap.length);

    for (const tideEvent of tideMap) {

        const dateTimeStart = tideEvent.evtdontRunStartTime.toISOString().split(".")[0]
        const dateTimeEnd = tideEvent.eventdontRunEndTime.toISOString().split(".")[0]

        const event = {
            colorId: eventColor,
            summary: (draftOfBoat/12) + ' FOOT DRAFT VESSLES !!!DO NOT OPERATE!!!',
            location: nameOfPath + ' Channel',
            description: "Do not operate vessels with a draft of " + (draftOfBoat/12) + " feet during this time in the " + nameOfPath +
            " channel. This calendar is only a estimate of local tide conditions. All tide conditions should be verified locally by a qualified ship captian or mate. Never substitute this calendar for USCG required calcuations for operating a vessel in these waters. The purpose of this Calendar is to suppot safe planning vessel operations - they should never support the actual operation of a vessel. NOT FOR NAVIGATIONAL PURPOSES",
            start: {
                dateTime: dateTimeStart,
                timeZone: 'America/New_York'
            },
            end: {
                dateTime: dateTimeEnd,
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
        // await createEvent(calendar, auth, calendarId, event);


        function resolveAfter2Seconds() {
          return new Promise(resolve => {
            setTimeout(() => {
              resolve('resolved');
            }, 1000);
          });
        }

        async function asyncCall() {
          // console.log('calling');
          const result = await resolveAfter2Seconds();
          // console.log(result);
          // expected output: "resolved"
        }

        asyncCall();

    }
}
