const fs = require('fs');
const parseString = require('xml2js').parseString;
const xml = fs.readFileSync('tideData.xml')
let tideArray

console.log('Starting Asychronous File Read and Parse');

 parseString(xml, (err, array) => {
    if (err) throw err;
    console.log('xml data parsed to json/array');
    tideArray = array.data.item
});
console.log('Example tide object ********* ', tideArray[0])

module.exports.tideArray = tideArray;
