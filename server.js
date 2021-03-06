var express = require('express');
var ejs = require('ejs');
var https = require('https');
var moment = require('moment');
var twit = require('twit');
var T = new twit({
  consumer_key:         '4EgvleWY7wCQUL71wtlnVQcFk',
  consumer_secret:      'qh2h48NQnjysfzp3EtKjH0evaIG3UWNDqrQ7pPa9ZjkxHkrh75',
  access_token:         '2364339145-qlSSo6MlhMLwBadczULie5nFUdp4fLDzBj8UJFQ',
  access_token_secret:  'y7XZEBuEKxa9AGiTWPxtIro238rLNOgRhzDvjikOj1Tok',
  timeout_ms: 	60 * 1000
});

var app = express();
app.set('view engine', 'ejs');

app.use(express.urlencoded( { extended: false }));
app.use(express.json());
app.use(express.static('public'));	// serve our static CSS, JS

// // // Globals // // //
const warningThreshold = 0.5;	// If score changes by this amount, alert the user
// var companies = new Array();
var total_sentiments = new Array();

// // // // // Routers // // // // //

// Homepage index
app.get('/', (req, res) => {
	res.render("index", {title: "ENTER YOUR WATCHLIST"});
});

// Call on "add" button click to serve a new-line on the form (should we be doing this on the client?)
app.get('/newStock', (req, res) => {
	res.render('partials/StockForm')
});

// Call on form submit. GET Blackrock's data on the company, render a new page with graphs and tweets and stuff
app.post('/upload', (req, res) => {
	
	// res.render("index", {title: "Stocks"});

	// var num_companies = 0;
	// var analysisURL = 'https://www.blackrock.com/tools/hackathon/portfolio-analysis?positions=';
	// if(req.body['stock[]'].length == 0) {
	// 	console.log("nothing inputted");
	// 	return;
	// } else if(typeof req.body['stock[]'] == 'string') {
	// 	analysisURL += req.body['stock[]'] + '~100';
	// } else {
	// 	num_companies++;
	// 	for(var i = 0; i < req.body['stock[]'].length - 1; i++)
	// 	{
	// 		analysisURL = analysisURL + req.body['stock[]'][i] + '~' + (100.0/req.body['stock[]'].length).toString() + '|';
	// 	};
	// 	analysisURL = analysisURL + req.body['stock[]'][i] + '~' + (100.0/req.body['stock[]'].length).toString();
	// }
	// num_companies++;
	// console.log("YOU ENTERED " + num_companies + " COMPANIES");
	var companies;
	if(typeof req.body['stock[]'] == 'string')
	{
		companies = req.body['stock[]'].split();	// turn single input (string) into a single element array
	} else {
		companies = req.body['stock[]'];	// already array
	}



	/* Get graph data */
	var graphCompanies;

	var performanceURL = 'https://www.blackrock.com/tools/hackathon/performance?identifiers='
	performanceURL += companies.join(',');
	// console.log(performanceURL);

	var companyNames;
    https.get("https://www.blackrock.com/tools/hackathon/search-securities?identifiers=" + companies.join(','), (res)=> {
        res.setEncoding('utf8');
        let body = "";
        res.on("data", data => { body += data });
        res.on("end", () => {
            body = JSON.parse(body);
            // if(~body.resultMap.SEARCH_RESULTS[0].resultList) return;

           	companyNames = body.resultMap.SEARCH_RESULTS[0].resultList.map(function(list, l){ return [list.description]; });
			//getTweets(companyNames, companies);
        });
    });


	https.get(performanceURL, (response) => {
		response.setEncoding('utf8');
		let body = "";
		response.on("data", data => { body += data });
		response.on("end", () => {
			body = JSON.parse(body);
			
			// if(~body.resultMap.RETURNS) return;
			// Done fetching the data, operate on data and return the different graph datas

			// console.log(body.resultMap);
			var TADecisions = [];
			graphCompanies = body.resultMap.RETURNS.map(function(returns, l) {
				var levels = returns.performanceChart.map(function(point) { return [point[0], point[1] * 1]; });
				var ema12 = movingAverage(12, levels);
				var ema26 = movingAverage(26, levels);
				var macd = ema26.map(function(point, i) { return [point[0], ema12[i][1] - point[1]]; });
				var ema9mac = movingAverage(9, macd);

				// var totMean = levels.reduce(function(pre, cur){
				// 	return pre + cur[1];
				// }, 0)/levels.length;

				var rollingPct = [];
				for(var i = 0; i < 30; i++) { rollingPct[i] = 0; }
				for(var i = 0; i < levels.length - 30; i++)
				{
					var mean = levels.slice(i, i+30).reduce(function(pre, cur){
						return pre + cur[1];
					}, 0)/30;
					var variance = levels.slice(i, i+30).reduce(function(pre, cur){
						return pre + Math.pow(cur[1]-mean, 2);
					}, 0)/30
					rollingPct[i+30] = Math.sqrt(variance)/levels[i+30][1];
				}


				var confIntPlus = ema26.map(function(point, i) { return [point[0], point[1] + rollingPct[i]*levels[i][1]]});
				var confIntMinus = ema26.map(function(point, i) { return [point[0], point[1] - rollingPct[i]*levels[i][1]]});

				var macdInterval = macd.reduce(function(pre, cur) {
					return Math.max(Math.abs(pre), Math.abs(cur[1]));
				}, 0);
				// console.log(macdInterval);

				if(levels[levels.length-1][1] < confIntMinus[confIntMinus.length-1][1])
				{
					TADecisions[l] = 1;
				} else if(levels[levels.length-1][1] > confIntPlus[confIntPlus.length-1][1])
				{
					TADecisions[l] = -1;
				} else {
					TADecisions[l] = 0;
				}

				if(Math.abs(macd[macd.length-1][1] - ema9mac[ema9mac.length-1][1]) >= 0.1)
				{
					TADecisions[l] += 0;
				} else {
					if(macd[macd.length-2][1] > ema9mac[ema9mac.length-2][1])
						TADecisions[l] += 1;
					else
						TADecisions[l] += -1;
				}

				return [
					[{	// First graph (stock + confidence intervals)
			  			name: returns.ticker,
			  			data: levels,
			  			color: '#00fff6',
			  			tooltip: { valueDecimals: 2 },
		  		}, {
			  			name: returns.ticker + " EMA26\+",
			  			data: confIntPlus,
			  			color: '#000000',
			  			tooltip: { valueDecimals: 2 },
		  		}, {
			  			name: returns.ticker + " EMA26\-",
			  			data: confIntMinus,
			  			color: '#000000',
			  			tooltip: { valueDecimals: 2 },
		  		}],

			  		[{	// Second graph (stock + EMAs)
			  			name: returns.ticker,
			  			data: levels,
			  			tooltip: { valueDecimals: 2 },
		  		}, {
			  			name: returns.ticker + " EMA12",
			  			data: ema12,
			  			tooltip: { valueDecimals: 2 },
		  		}, {
			  			name: returns.ticker + " EMA26",
			  			data: ema26,
			  			tooltip: { valueDecimals: 2 },
		  		}],

			  		[{	// Third graph (macd)
			  			name: returns.ticker + " MACD",
			  			data: macd,
			  			interval: macdInterval,
			  			tooltip: { valueDecimals: 2 },
		  		}, {	// Third graph (macd)
			  			name: returns.ticker + " MACD EMA9",
			  			data: ema9mac,
			  			tooltip: { valueDecimals: 2 },
		  		}]];
			});
			// console.log(JSON.stringify(graphCompanies[0]));
			// console.log(graphCompanies[0][2][0].interval);
			//res.render("graph", {ss: graphCompanies, dec: decisions});
			var arrDecisions = [];
			for(var i = 0; i < companyNames.length; i++)
			{
				if(TADecisions[i] > 0)
					arrDecisions[i] = 'SELL';
				else if(TADecisions[i] < 0)
					arrDecisions[i] = 'BUY';
				else
					arrDecisions[i] = 'HOLD';
			}
			var nameData = {
				names: companyNames,
				decision: arrDecisions
			};
			res.render("analysis", {graphs: graphCompanies, nameDatas: nameData});
	});

		
	});

});

// // // // // Functions // // // // //

//store top url for each company
var top_urls = {};
//store the last 5 sentiments. we'll check the most recent with the least recent. if big difference, do something
var sentiments = {};

var iteration = 0;
function getTweets(companies, abbrevs){
	var top_url = {};
	console.log(companies.length);
	for (var k = 0; k < companies.length; k++){
		var company_name = companies[k];
		var abbrev = abbrevs[k];
		console.log("SEARCHING TWITTER FOR " + company_name);
		console.log( moment().subtract(7, 'd').format('YYYY-MM-DD'));
		T.get('search/tweets', { q: company_name + ' since:' + moment().subtract(7, 'd').format('YYYY-MM-DD') + '&result_type=popular', count: 100}, (err, data, response) => {
			console.log(" ");
			console.log("ITERATION NUMBER " + iteration + " WITH " + data.statuses.length + " TWEETS");
			console.log(" ");
			iteration++;
			var DATA = {};
			var TWEETS = [];
			//loop through all the tweets
			for(var i=0; i < data.statuses.length; i++)
			{
				//filter for english only posts
				var wtd_total = 0;
				var total_wt = 0;
				if (data.statuses[i].metadata.iso_language_code != "en")
					continue; //if not english, skip it

				//console.log(data.statuses[i].text);
				//console.log(data.statuses[i].user.screen_name + " has " + data.statuses[i].user.followers_count + " followers");
				//if (data.statuses[i].truncated == true)
				//	console.log("TRUNCATED");
				//console.log("------------------------------------");

				var TWEETOBJ = {"followers": data.statuses[i].user.followers_count, 
					"retweets": data.statuses[i].retweet_count, "text": data.statuses[i].text};
				TWEETS.push(TWEETOBJ);

				//check if top_url should be overwritten
				if (data.statuses[i].user.followers_count > top_url["followers"]){
					top_url["followers"] = data.statuses[i].user.followers_count;
					top_url[k]["followers"] = data.statuses[i].user.followers_count;
					/*if (typeof(data.statuses[i].entities.urls[0].url) == "string")
						top_three[k]["url"] = data.statuses[i].entities.urls[0].url;
					else
						top_three[k]["url"] = "";*/
					break;
				}
				//console.log(JSON.stringify(data.statuses[i].entities));
				//console.log(JSON.stringify(data.statuses[i].entities.urls));
				//console.log(JSON.stringify(top_three));
			}
			DATA["company"] = abbrev;
			console.log("abbrev sent was " + abbrev);
			DATA["tweets"] = TWEETS;
			//pretty printing
			console.log(JSON.stringify(DATA, null, 2));

			var request = require("request");

			var options = { method: 'POST',
				url: 'http://10.30.13.138:5000/sentiment',
			    //url: 'https://topguns-lahacks.appspot.com/sentiment',
			  headers: 
			   { 'Postman-Token': 'a531e8c1-122d-4e34-a5c0-18ef2381ce0f',
			     'Cache-Control': 'no-cache',
			     'Content-Type': 'application/json' },
			  body: DATA,
			  json: true };

			  request(options, function (error, response, body) {
			  if (error) throw new Error(error);

			  console.log("HERE IS THE RESPONSE: " + JSON.stringify(body, null, 2));

			  //NOW WE PROCESS THE RESPONSE INCLUDING SENTIMENT
			  //if it hasnt been filled, fill it with zeros
			  if (sentiments[body["company"]] == null){
			  	sentiments[body["company"]] = [];
			  	for (var l = 0; l < 5; l++){
			  		sentiments[body["company"]].push(0);
			  	}
			  }

			  for (var j = 0; j < 5; j++){
			  	if (/*(body["sentiment"] > 25 && sentiments[body["company"]][j] < 0) ||*/ (body["sentiment"] < -25 && sentiments[body["company"]][j] > 0)){
			  		//DO SOMETHING!!!!!
			  		///////////////////////
			  		///////////////////////
			  		///////////////////////
			  	}
			  }

			  //shift values over
			  for (var j = 4; j > 0; j--)
			  	sentiments[body["company"]][j] = sentiments[body["company"]][j - 1];
			  sentiments[body["company"]][0] = body["sentiment"];
			});

		})
	}
	setTimeout(function(){getTweets(companies, abbrevs);}, 20000);
};

function movingAverage(period, data)
{
	var alpha = 2.0/(period + 1);
	const memo = [0];
	var index = 0;
	return data.map(function(point, i) {
		if(i < period-1)
		{
			return [point[0], null];
		} else if(i==period) {
			for(var j = 0; j < period; j++)
			{
				memo[index] += point[1];
			}
			memo[index] /= period;
			return [point[0], memo[index]];
		}
		memo[index+1] = alpha*point[1] + (1-alpha)*memo[index];
		index++;
		return [point[0], memo[index]];
	});
}


app.listen(3000, () => {
	console.log('Stock stuff listening on port 3000');
});
