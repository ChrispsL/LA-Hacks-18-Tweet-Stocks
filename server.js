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

app.get('/twitter', (req, res) => {
	T.get('search/tweets', { q: 'apple since:2018-03-24', count: 100}, (err, data, response) => {
		for(var i=0; i < data.statuses.length; i++)
		{
			console.log(data.statuses[i].text);
			/*
				.created_at
				.truncated (bool)
				.user[id/id_str/name/screen_name/location/description/followers_count/friends_count]
				.retweet_count
			*/
		}
	})
});



app.post('/upload', (req, res) => {
	// Process
	console.log(req.body);
	res.render("index", {title: "Stocks"});


	var analysisURL = 'https://www.blackrock.com/tools/hackathon/portfolio-analysis?positions=';
	if(req.body['stock[]'].length == 0) {
		console.log("nothing inputted");
		return;
	} else if(typeof req.body['stock[]'] == 'string') {
		analysisURL += req.body['stock[]'] + '~100';
	} else {
	for(var i = 0; i < req.body['stock[]'].length - 1; i++)
	{
		analysisURL = analysisURL + req.body['stock[]'][i] + '~' + (100.0/req.body['stock[]'].length).toString() + '|';
	};
		analysisURL = analysisURL + req.body['stock[]'][i] + '~' + (100.0/req.body['stock[]'].length).toString();
}

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
			console.log(portfolio[0]);
			console.log(portfolio[0]['returns']);
			console.log(portfolio[0]['returns']['returnsMap']['20180325']);
			// console.log(portfolio[0]['request']);
			// console.log(portfolio[0]['exposure']);
			// console.log(portfolio[0]);
		}
		//console.log(body['resultMap']['SEARCH_RESULTS'][0]);

		  });
		  
    });
});

app.listen(3000, () => {
	console.log('Stock stuff listening on port 3000');
});