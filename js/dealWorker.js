const DEBUG = false;
//TODO : add demande en param
const LANG = 'en';

importScripts('DealModul.js');

//Ajax methode get with promise
function get(url) {
	return new Promise(function(resolve, reject) {
		var req = new XMLHttpRequest();
		if( url.indexOf('?') === -1) {
			url +='?lang='+LANG;
		} else {
			url +='&lang='+LANG;
		}
		req.open('GET', url);
		req.onerror = function(e) {
			console.log(e);
			reject(Error('Une erreur ' + e.target.status + ' s\'est produite au cours de la réception du document.'));
		};
		req.onload = function() {
			// call event if 404 etc.
			if (req.status === 200) {
				resolve(JSON.parse(req.response));
			}
			else {
				console.log('Error in onload');
				console.log(url);
				console.log(req);
				reject(Error(req.statusText));
			}
		};
		req.send();
	});
}

function onError(err) {
	console.log(err);
  	console.log('FAIL: ' + err.message);
}

//If more than 4 param splite the request into multiple request
//to avoid partial content
function getCommercesListing(itemsIds) {
	var ids = '?ids=';
	var itemsKey = Object.keys(itemsIds),
	promiseArray = [];
	if(itemsKey.length > 4) {
		console.log(itemsKey);
		for (var i =0; i< itemsKey.length; i++){
			var id = itemsKey[i];
			ids += id+',';
			if( (((i+1)&3) === 0) || (i ===  itemsKey.length-1)) {
				ids = ids.substring(0,ids.length-1);
				var uri = 'https://api.guildwars2.com/v2/commerce/listings'+ids;
				console.log(uri);
				promiseArray.push( get(uri));
				console.log("pushPromise");
				console.log(promiseArray);
				ids = '?ids=';
			}
		}
		console.log('final :');
		console.log(promiseArray);
		return Promise.all(promiseArray);
	}
	for (var id in itemsIds) {
		ids += id+',';
	}
	ids = ids.substring(0,ids.length-1);
	//not cached ajax request , prevent 203 : Partial content or not
	//var uri = 'https://api.guildwars2.com/v2/commerce/listings'+ids+'&p=' + (new Date()).getTime();
	var uri = 'https://api.guildwars2.com/v2/commerce/listings'+ids;
	return get(uri);

}

function getCommerceListing(itemId) {
	var uri = 'https://api.guildwars2.com/v2/commerce/listings/'+itemId;
	return get(uri);
}

function getCommercePrice(itemId) {
	var uri = 'https://api.guildwars2.com/v2/commerce/prices/'+itemId;
	return get(uri);
}

// Custom PUBLIC functions (i.e. queryable from the main page)
var queryableFunctions = {
	// example #1: get the difference between two numbers:
	find: function (objecData) {
		var supercraft = objecData.supercraft,
		DealCriteria = objecData.DealCriteria,
		commerce = new DealModul(supercraft,DealCriteria);
		commerce.isDeal().then( function(deal){
			//No price in HDV
			var craftPrice = commerce.crafPrice,
			possibleGain = commerce.possibleGain;
			compoCount = commerce.compoCount;
			buyPrice = commerce.buyPrice;
			var dataSend = {deal,craftPrice,possibleGain,buyPrice,supercraft,compoCount};
			reply('available' , dataSend );
		})
		.catch( function(e){
			onError(e);
			console.error('try to save meuble');
			//No price in HDV
			var craftPrice = 0,
			deal = false,
			possibleGain = 0,
			buyPrice = 0,
			dataSend = {deal,craftPrice,possibleGain,buyPrice,supercraft};
			reply('available' , dataSend );
		});
	},
	// example #2: wait three seconds
	waitSomething: function () {
	 	 setTimeout(function() { reply("alertSomething", 3, "seconds"); }, 3000);
	},
};

/* arg :  listener name, argument to pass 1, argument to pass 2, etc. etc */
function reply () {
	if (arguments.length < 1) {
		throw new TypeError("reply - not enough arguments");
	}
	postMessage({ "vo42t30": arguments[0], "rnb93qh": Array.prototype.slice.call(arguments, 1) });
}

//default PUBLIC function executed only when main page calls the queryableWorker.postMessage() method directly
function defaultQuery (vMsg) {
	console.log('bonjour');
	console.log(vMsg)
}

//run the worker
this.onmessage = function(oEvent) {
	if (oEvent.data instanceof Object && oEvent.data.hasOwnProperty("bk4e1h0") && oEvent.data.hasOwnProperty("ktp3fm1")) {
	    queryableFunctions[oEvent.data.bk4e1h0].apply(self, oEvent.data.ktp3fm1);
	} else {
		defaultQuery(oEvent.data);
	}
};
