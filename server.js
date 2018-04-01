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
var companies = new Array();
var total_sentiments = new Array();

// // // // // Routers // // // // //

// Homepage index
app.get('/', (req, res) => {
	res.render("index", {title: "Stocks"});
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
	performanceURL += companies.join(',') + '&endDate=20170313';
	// console.log(performanceURL);
	https.get(performanceURL, (response) => {
		response.setEncoding('utf8');
		let body = "";
		response.on("data", data => { body += data });
		response.on("end", () => {
			body = JSON.parse(body);
		
			// Done fetching the data, operate on data and return the different graph datas

			// console.log(body.resultMap);
			var decisions = 0;
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
					decisions = 1;
				} else if(levels[levels.length-1][1] > confIntPlus[confIntPlus.length-1][1])
				{
					decisions = -1;
				} else {
					decisions = 0;
				}

				if(Math.abs(macd[macd.length-1][1] - ema9mac[ema9mac.length-1][1]) >= 0.1)
				{
					decisions += 0;
				} else {
					if(macd[macd.length-2][1] > ema9mac[ema9mac.length-2][1])
						decisions += 1;
					else
						decisions += -1;
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
			res.render("graph", {ss: graphCompanies, dec: decisions});
		});

		
	});



	// var ss = {
	// 	name: graphCompanies.name,
	// 	data: {
	// 	graphCompanies.data.levels,
	// 	graphCompanies.data.ema5,
	// 	graphCompanies.data.ema14
	// },
	// tooltip: { valueDecimals: 2 }
	// }
	// res.render("graph", {ss});

	// https.get(analysisURL, (res) => {
	// 	  res.setEncoding('utf8');
	// 	  let body = "";
	// 	  res.on("data", data => { body += data });
	// 	  res.on("end", () => {
	// 	  	body = JSON.parse(body);
			
	// 		var portfolio = body['resultMap']['PORTFOLIOS'][0]['portfolios'];
	// 		if(portfolio[0].allDataReturned == false) {
	// 			console.log("Invalid!");
	// 		} else {
	// 		//console.log(portfolio[0]);
	// 		//console.log(portfolio[0]['returns']);
	// 		//console.log(portfolio[0]['returns']['returnsMap']['20180325']);
	// 		// console.log(portfolio[0]['request']);
	// 		// console.log(portfolio[0]['exposure']);
	// 		// console.log(portfolio[0]);
	// 		}
	// 	//console.log(body['resultMap']['SEARCH_RESULTS'][0]);
	// 		for (var k = 0; k < num_companies; k++){
	// 			var company = portfolio[0]['holdings'][k]['description'];
	// 			companies.push(company);
	// 			console.log("COMPANY " + k + " " + company);
	//     	}
	// 		getTweets();
	// 	  });
 //    });
});


app.get('/ema', (req, res) => {
	var performanceURL = 'https://www.blackrock.com/tools/hackathon/performance?identifiers=AMZN'
	// var performanceURL = 'https://www.blackrock.com/tools/hackathon/portfolio-analysis?positions=AAPL~50|MSFT~50'
	https.get(performanceURL, (response) => {
		response.setEncoding('utf8');
		let body = "";
		response.on("data", data => { body += data });
		response.on("end", () => {
			body = JSON.parse(body);
			
			var returns = body.resultMap.RETURNS;
			console.log(returns);
			var levels = returns[0].performanceChart.map(function(point) {
			  				return [point[0], point[1] * 10000]; });
			var ema5 = movingAverage(5, levels);
			var ema14 = movingAverage(14, levels);
			var macd = ema14.map(function(point, i) {
				return [point[0], ema5[i][1] - point[1]];
			});
			var ss = [{
			  			name: "AMZ Plain",
			  			data: levels,
			  			tooltip: { valueDecimals: 2 }
			  		}, {
			  			name: "AMZN EMA 5",
			  			data: ema5,
			  			tooltip: { valueDecimals: 2 }
			  		}, {
			  			name: "AMZN EMA 14",
			  			data: ema14,
			  			tooltip: { valueDecimals: 2 }
			  		}];
			 var ss2 = [{
			  			name: "AMZN MACD",
			  			data: macd,
			  			tooltip: { valueDecimals: 2 }
			  		}];
			res.render("graph", {ss, ss2});
		});
	});
});

app.get('/ema2', (req, res) => {
	var performanceURL = 'https://www.blackrock.com/tools/hackathon/portfolio-analysis?positions=AAPL~50|MSFT~50&monthsUntilRebalance=50000&useStandardQuarterlyRebalance=false&useStandardYearlyRebalance=false'
	https.get(performanceURL, (response) => {
		response.setEncoding('utf8');
		let body = "";
		response.on("data", data => { body += data });
		response.on("end", () => {
			body = JSON.parse(body);
			// console.log(body.resultMap.PORTFOLIOS[0].portfolios);
			var positionName = "";

			
			var returns = body.resultMap.PORTFOLIOS[0].portfolios[0].returns;
			var levels = returns.performanceChart.map(function(point) {
			  				return [point[0], point[1] * 10000]; });
			var ema5 = movingAverage(5, levels);
			var ema14 = movingAverage(14, levels);
			var macd = ema14.map(function(point, i) {
				return [point[0], ema5[i][1] - point[1]];
			});
			var ss = [{
			  			name: "AAPL MSFT Plain",
			  			data: levels,
			  			tooltip: { valueDecimals: 2 }
			  		}, {
			  			name: "AAPL MSFT EMA 5",
			  			data: ema5,
			  			tooltip: { valueDecimals: 2 }
			  		}, {
			  			name: "AAPL MSFT EMA 14",
			  			data: ema14,
			  			tooltip: { valueDecimals: 2 }
			  		}, {
			  			name: "AAPL MSFT MACD",
			  			data: macd,
			  			tooltip: { valueDecimals: 2 }
			  		}]
			res.render("graph", {ss});
			// console.log(ss);
		});
	});
});



// // // // // Functions // // // // //

function getTweets(){
	for (var k = 0; k < companies.length; k++){
		T.get('search/tweets', { q: companies[k] + ' since:2018-03-24', count: 100}, (err, data, response) => {
			for(var i=0; i < data.statuses.length; i++)
			{
				//filter for english only posts
				var wtd_total = 0;
				var total_wt = 0;
				if (data.statuses[i].metadata.iso_language_code != "en")
					continue; //if not english, skip it

				console.log(data.statuses[i].text);
				console.log(data.statuses[i].user.screen_name + " has " + data.statuses[i].user.followers_count + " followers");
				if (data.statuses[i].truncated == true)
					console.log("TRUNCATED");
				//console.log("language is " + data.statuses[i].metadata.iso_language_code);
				console.log("------------------------------------");

				var wt = data.statuses[i].user.followers_count;
				//TODO: GET SENTIMENT
				/*
					wtd_total += sentiment * wt;
					total_wt += wt;
				*/
			}
		//var total_sentiment = wtd_total / total_wt;
		//total_sentiments[k] = total_sentiment;
		})
	}
	setTimeout(getTweets, 20000);
};

function getGraphData(companies)
{
	var performanceURL = 'https://www.blackrock.com/tools/hackathon/performance?identifiers='
	performanceURL += companies.join(',');
	console.log(performanceURL);

	https.get(performanceURL, (res) => {
		res.setEncoding('utf8');
		let body = "";
		res.on("data", data => { body += data });
		res.on("end", () => {
			body = JSON.parse(body);
		
			// Done fetching the data, operate on data and return the different graph datas

			console.log(body.resultMap);
			var graphCompanies = body.resultMap.RETURNS.map(function(returns) {
				var stockData = returns.performanceChart.map(function(point) { return [point[0], point[1] * 10000]; });
				var calcEma5 = movingAverage(5, stockData);
				var calcEma14 = movingAverage(14, stockData);
				var calcMacd = calcEma14.map(function(point, i) { return [point[0], calcEma5[i][1] - point[1]]; });

				var confIntVal = 0;
				for (var i = 0; i < stockData.length; i++) {
					confIntVal += stockData[i][1];
				}
				confIntVal /= (stockData.length * 20);	// 5% of average stock data
				var calcConfIntPlus = calcEma14.map(function(point, i) { return [point[0], point[1] + confIntVal]});
				var calcConfIntMinus = calcEma14.map(function(point, i) { return [point[0], point[1] - confIntVal]});

				return {
					name: returns.ticker,
					data: [{
						levels: stockData,
						ema5: calcEma5,
						ema14: calcEma14,
						macd: calcMacd,
						confIntP: calcConfIntPlus,
						confIntM: calcConfIntMinus,
					}],
					tooltip: { valueDecimals: 2 }
				};
			});
			return graphCompanies;
		// 	console.log(returns);
		// 	var levels = returns[0].performanceChart.map(function(point) {
		// 	  				return [point[0], point[1] * 10000]; });
		// 	var ema5 = movingAverage(5, levels);
		// 	var ema14 = movingAverage(14, levels);
		// 	var macd = ema14.map(function(point, i) {
		// 		return [point[0], ema5[i][1] - point[1]];
		// 	});
		// 	var ss = [{
		// 	  			name: "AMZ Plain",
		// 	  			data: levels,
		// 	  			tooltip: { valueDecimals: 2 }
		// 	  		}, {
		// 	  			name: "AMZN EMA 5",
		// 	  			data: ema5,
		// 	  			tooltip: { valueDecimals: 2 }
		// 	  		}, {
		// 	  			name: "AMZN EMA 14",
		// 	  			data: ema14,
		// 	  			tooltip: { valueDecimals: 2 }
		// 	  		}];
		// 	 var ss2 = [{
		// 	  			name: "AMZN MACD",
		// 	  			data: macd,
		// 	  			tooltip: { valueDecimals: 2 }
		// 	  		}];
		// 	res.render("graph", {ss, ss2});
		// });
	});
	});
}

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
