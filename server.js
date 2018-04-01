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
	res.render("index", {title: "Stocks"});
});

app.get('/newStock', (req, res) => {
	res.render('partials/StockForm')
});



//if changes by threshold within some time interval, alert
var threshold = 0.5;

//global array for names of companies
var companies = new Array();
var total_sentiments = new Array();

var iteration = 0;
function getTweets(){
	for (var k = 0; k < companies.length; k++){
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
				
				/*
					.created_at
					.truncated (bool)
					.user[id/id_str/name/screen_name/location/description/followers_count/friends_count]
					.retweet_count
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
	res.render("index", {title: "Stocks"});


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

//var analysisURL = 'https://www.blackrock.com/tools/hackathon/search-securities?identifiers=AAPL';
	https.get(analysisURL,
    (res) => {
		  res.setEncoding('utf8');
		  let body = "";
		  res.on("data", data => { body += data });
		  res.on("end", () => {
		  	body = JSON.parse(body);
			
			var portfolio = body['resultMap']['PORTFOLIOS'][0]['portfolios'];
			if(portfolio[0].allDataReturned == false)
			{
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
//getTweets(req.body['stock[]']);
app.listen(3000, () => {
	console.log('Stock stuff listening on port 3000');
});
