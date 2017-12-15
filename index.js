const eztv = require('eztv.ag');
const Stremio = require('stremio-addons');
const magnet = require('magnet-uri');
const imdb = require('imdb');
const { orderBy } = require('lodash');

const manifest = {
	// See https://github.com/Stremio/stremio-addons/blob/master/docs/api/manifest.md for full explanation
	'id': 'org.stremio.eztvag',
	'version': '1.0.0',
	'name': 'EZTV.ag Addon',
	'description': 'Fetch EZTV.ag episodes',
	'icon': 'https://proxybay.fun/assets/logo/eztv.png',
	'logo': 'https://proxybay.fun/assets/logo/eztv.png',
	'isFree': true,
	'email': 'thanosdi@live.com',
	'endpoint': 'http://localhost:7000/stremioget/stremio/v1',
	// Properties that determine when Stremio picks this add-on
	'types': ['series'], // your add-on will be preferred for those content types
	'idProperty': 'imdb_id', // the property to use as an ID for your add-on; your add-on will be preferred for items with that property; can be an array
	// We need this for pre-4.0 Stremio, it's the obsolete equivalent of types/idProperty
	'filter': { 'query.imdb_id': { '$exists': true }, 'query.type': { '$in':['series'] } }
};

const addon = new Stremio.Server({
	'stream.find': function(args, callback) {
		imdb(args.query.imdb_id, function(err, data) {
			if(err) {
				console.log(err.message);
				return callback(err.message);
			}
			if(data && args.query.type === 'series'){
				const imdbTitle = (!data.originalTitle || data.originalTitle === 'N/A') ? data.title : data.originalTitle;
				const title = createTitle(imdbTitle, args);
				eztv.search(title)
					.then(function (results) {
						const stremioRes = orderBy(results, 'seeds', 'desc').slice(0, 4).map( episode => {
							const {infoHash, announce } = magnet.decode(episode.magnet);
							const availability = episode.seeds;
							const detail = `${episode.title.slice(0,40)} S:${episode.seeds}`;

							return {
								infoHash,
								name: '@EZTV',
								title: detail,
								isFree: true,
								sources: [...announce.map(src => `tracker:${src}`), `dht:${infoHash}`],
								availability
							};
						});
						return callback(null, stremioRes)
					}).catch((err) => {
						return callback(new Error(err.message));
					});
			}
		});
	}
}, manifest);

const createTitle = (movieTitle, args) => {
	let title = movieTitle;
	if (args.query.type === 'series') {
		let season = args.query.season;
		let episode = args.query.episode;

		if (parseInt(season) < 10){
			season = `0${season}`;
		}
		if (parseInt(episode) < 10){
			episode = `0${episode}`;
		}

		title = `${movieTitle} S${season}E${episode}`;
	}

	return title;
};

const server = require('http').createServer((req, res) => {
	addon.middleware(req, res, function() { res.end() }); // wire the middleware - also compatible with connect / express
})
	.on('listening', () => {
		console.log(`EZTV.ag Stremio Addon listening on ${server.address().port}`);
	})
	.listen(process.env.PORT || 7000);