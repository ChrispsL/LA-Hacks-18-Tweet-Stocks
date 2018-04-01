var express = require('express');
var ejs = require('ejs');
var https = require('https');
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

app.get('/', (req, res) => {
	res.render("index", {title: "ENTER YOUR WATCHLIST"});
});

app.get('/newStock', (req, res) => {
	res.render('partials/StockForm')
});

app.use(express.static('public'));



//if changes by threshold within some time interval, alert
var threshold = 0.5;

//global array for names of companies
var companies = new Array();
var total_sentiments = new Array();

var iteration = 0;
function getTweets(){
	for (var k = 0; k < companies.length; k++){
		console.log("SEARCHING TWITTER FOR " + companies[k]);
		T.get('search/tweets', { q: companies[k] + ' since:2018-03-24', count: 100}, (err, data, response) => {
			console.log(" ");
			console.log("ITERATION NUMBER " + iteration + " WITH " + data.statuses.length + " TWEETS");
			console.log(" ");
			iteration++;
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

app.post('/upload', (req, res) => {
	// Process
	console.log(req.body);
	res.render("analysis");


	var num_companies = 0;
	var analysisURL = 'https://www.blackrock.com/tools/hackathon/portfolio-analysis?positions=';
	if(req.body['stock[]'].length == 0) {
		console.log("nothing inputted");
		return;
	} else if(typeof req.body['stock[]'] == 'string') {
		analysisURL += req.body['stock[]'] + '~100';
	} else {
		num_companies++;
		for(var i = 0; i < req.body['stock[]'].length - 1; i++)
		{
			analysisURL = analysisURL + req.body['stock[]'][i] + '~' + (100.0/req.body['stock[]'].length).toString() + '|';
		};
		analysisURL = analysisURL + req.body['stock[]'][i] + '~' + (100.0/req.body['stock[]'].length).toString();
	}
	num_companies++;
	console.log("YOU ENTERED " + num_companies + " COMPANIES");

	https.get(analysisURL, (res) => {
		  res.setEncoding('utf8');
		  let body = "";
		  res.on("data", data => { body += data });
		  res.on("end", () => {
		  	body = JSON.parse(body);
			
			var portfolio = body['resultMap']['PORTFOLIOS'][0]['portfolios'];
			if(portfolio[0].allDataReturned == false) {
				console.log("Invalid!");
			} else {
			//console.log(portfolio[0]);
			//console.log(portfolio[0]['returns']);
			//console.log(portfolio[0]['returns']['returnsMap']['20180325']);
			// console.log(portfolio[0]['request']);
			// console.log(portfolio[0]['exposure']);
			// console.log(portfolio[0]);
			}
		//console.log(body['resultMap']['SEARCH_RESULTS'][0]);
			for (var k = 0; k < num_companies; k++){
				var company = portfolio[0]['holdings'][k]['description'];
				companies.push(company);
				console.log("COMPANY " + k + " " + company);
	    	}
			getTweets();
		  });
    });
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

/*
EMA -- weighted averages
ind var: time period

*/

app.listen(3000, () => {
	console.log('Stock stuff listening on port 3000');
});
