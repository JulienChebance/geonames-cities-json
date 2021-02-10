const fs = require('fs');
const http = require('http');
const path = require('path');
const readline = require('readline');
const unzipper = require('unzipper');

const GEONAMES_DUMPS_PATH = 'http://download.geonames.org/export/dump/';

const parseDsv = (url, dataCallback, closeCallback, delimiter = '\t') => {
	return new Promise((resolve, reject) => http.get(url, (res) => {
		if (path.extname(url) == '.zip') {
			res = res.pipe(unzipper.ParseOne());
		}
		const rl = readline.createInterface({input: res, crlfDelay: Infinity});

		rl.on('line', (line) => {
			if (line.startsWith('#')) return;
			dataCallback?.(line.split(delimiter));
		});

		rl.on('close', () => {
			closeCallback?.();
			resolve();
		});
	}));
};

const countries = {};
const states = {};
const divisions = {};
Promise.all([
	parseDsv(path.join(GEONAMES_DUMPS_PATH, 'countryInfo.txt'), (data) => countries[data[0]] = data[4]),
	parseDsv(path.join(GEONAMES_DUMPS_PATH, 'admin1CodesASCII.txt'), (data) => states[data[0]] = data[1]),
	parseDsv(path.join(GEONAMES_DUMPS_PATH, 'admin2Codes.txt'), (data) => divisions[data[0]] = data[1])
]).then(() => {
	let cities = [];
	parseDsv(path.join(GEONAMES_DUMPS_PATH, 'cities500.zip'), (data) => {
		let division = data[8] + '.' + data[10] + '.' + data[11];
		if (!divisions[division]) {
			division = data[8] + '.' + data[10].padStart(2, '0') + '.' + data[11];
			if (!divisions[division]) {
				division = data[8] + '.' + data[10].padStart(3, '0') + '.' + data[11];
				if (!divisions[division]) {
					division = data[8] + '.' + data[10] + '.' + data[11].padStart(2, '0');
					if (!divisions[division]) {
						division = data[8] + '.' + data[10] + '.' + data[11].padStart(3, '0');
					}
				}
			}
		}
		division = divisions[division] || undefined;
		let state = data[8] + '.' + data[10];
		if (!states[state]) {
			state = data[8] + '.' + data[10].padStart(2, '0');
		}
		state = states[state] || undefined;
		const city = {
			name: data[1],
			alternatenames: data[3].split(','),
			lat: parseFloat(data[4]).toFixed(4), // Limits latitude to 4 decimals
			lon: parseFloat(data[5]).toFixed(4), // Limits longitude to 4 decimals
			country: countries[data[8]],
			population: parseInt(data[14])
		};
		if (division || state) {
			if (data[8] === 'US' && division) {
				division = state + ' - ' + division;
			}
			city.division = division || state;
		}
		cities.push(city);
	}, () => {
		fs.writeFileSync('geonames.json', JSON.stringify(cities));
	});
});