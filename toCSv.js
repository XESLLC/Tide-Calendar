const readline = require('readline');
const { google } = require('googleapis');
const ObjectsToCsv = require('objects-to-csv');

// asset and channel characteristics
// calculation made all in inches, milliseconds and minutes
// all time calcs in UTC
// xml from noa adjusted for daylight savings - see screen shot in directory


// asset and channel characteristics
// calculation made all in inches and minutes
const draftOfBoat = 5 * 12 // convert to inches // change this
const lowestInPath0MeanTide = 3.5 * 12 // convert to inches
const nameOfPath = 'Mananlapan'
const delayFromNOA = 0
const noaTideLocation = 'BOYNTON BEACH, FL'
const noaTideLocationId = '8722706'
const tideArray = require('./xmlToArray').tideArray;


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

    Date.prototype.stdTimezoneOffset = function () {
        var jan = new Date(this.getFullYear(), 0, 1);
        var jul = new Date(this.getFullYear(), 6, 1);
        return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
    }

    Date.prototype.isDstObserved = function () {
        return this.getTimezoneOffset() < this.stdTimezoneOffset();
    }

    const today = new Date(prediction.date);

    const adjustForDLSInMilliseconds = () => {
        if (today.isDstObserved()) {
          return (1 * 60 * 60 * 1000) // adjust by 1 hour
        }
        return 0

    }
    console.log("adjustForDLSInMilliseconds", adjustForDLSInMilliseconds());
    const eventDontRunStartTime = new Date(timeAtLow - prevStopOperatingTime - (5 * 60 * 60 * 1000) + adjustForDLSInMilliseconds())
    const eventDontRunEndTime = new Date(timeAtLow + endStopOperatingTime - (5  * 60 * 60 * 1000) + adjustForDLSInMilliseconds())

    const resultSched =  {
      evtdontRunStartTime: eventDontRunStartTime,
      eventdontRunEndTime: eventDontRunEndTime
    }
    return resultSched
}).filter((noOpRange) => {
    return !!noOpRange.evtdontRunStartTime
})

console.log('TideMappingComplete - total tide events = ', tideMap.length);
console.log('Starting Event Creation');

const milliseconds = tideMap.reduce((totalMilli, tideEvent, index, array) => {
  if (index >= (array.length - 1)) {
    return totalMilli
  } else {
    let value = array[index+1].evtdontRunStartTime.getTime() - tideEvent.eventdontRunEndTime.getTime()
    if (value < 0) value = 0;
    // console.log(value/60000)
    return  totalMilli + value
  }

}, 0)

const minutes = milliseconds/60000
const percent = (minutes/(365*24*60))*100
console.log('Percent of time in year you can opperate in channel -',percent);
const dataEvent = []
for (const tideEvent of tideMap) {
    const year = (tideEvent.evtdontRunStartTime.toISOString().split("T")[0].split("-")[0])
    const month = (tideEvent.evtdontRunStartTime.toISOString().split("T")[0].split("-")[1])
    const day = (tideEvent.evtdontRunStartTime.toISOString().split("T")[0].split("-")[2])

    dataEvent.push({"Year": year, "Month": month, "Day": day, "Start of Dont Operate": tideEvent.evtdontRunStartTime.toISOString().split("T")[1].split(".")[0], "End of Dont Operate": tideEvent.eventdontRunEndTime.toISOString().split("T")[1].split(".")[0]});
}
(async () => {
  const csv = new ObjectsToCsv(dataEvent);
  await csv.toDisk('./tideEvents.csv');
})();
