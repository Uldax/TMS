const DB_NAME = 'gw2-FYD';
const DB_VERSION = 5; // Use a long long for this value (don't use a float)
const DEBUG = false;
const LANG = 'en';
//this =  function context

var db;


function onError(err) {
 	console.log('FAIL: ' + err.message);
}
importScripts('RecipeCreator.js');

// TODO : promise is better
function openDb(callback) {
	console.log("openDb ...");
	var req = indexedDB.open(DB_NAME, DB_VERSION);

	req.onsuccess = function () {
		// Better use "this" than "req" to get the result to avoid problems with
		// garbage collection.
		db = this.result;
	    	db.onerror = function(evt) {
			// Generic error handler for all errors targeted at this database's requests!
			console.log('Database error: ' + evt.target.error.message);
	    	};
	    	console.log("openDb DONE");
		    if( typeof callback === 'function') {
		    	callback();
		 }
 	};

  	req.onerror = function(e) {
		console.log(e);
		console.error('Why didn\'t you allow my web app to use IndexedDB?!');
  	};

	//When the indexedDB is opened for the very first time, or when you change the version in the code
	//a single database can contain any number of object stores.
	req.onupgradeneeded = function (evt) {
		console.log("openDb.onupgradeneeded");
		var thisDb = evt.target.result;


		//structure of dbb
		//out-of-line key
		//A key that is stored separately from the value being stored.
		var recipeStore = thisDb.createObjectStore(
		 'recipes', {  autoIncrement: false });
		//recipeStore.createIndex('id', 'id', { unique: true });
		//
		var infoStore = thisDb.createObjectStore(
		'infos', {  autoIncrement: false });
		// var infoStore = thisDb.createObjectStore(
		// 'infos', {  keyPath: "id", autoIncrement: false });
		// infoStore.createIndex('id', 'id', { unique: true });
	};
}


/**
* @param {string} store_name
* @param {string} mode either "readonly"(default) or "readwrite"
*/
function getObjectStore(store_name, mode) {
	//This creates a new transaction. All data operations with IndexedDB require a transaction of some sort.
	//The first argument is a list of object stores
	var tx = db.transaction(store_name, mode);
	//Get the "store_name" object store.
	return tx.objectStore(store_name);
}

//no need to use promise
function addRecipe(recipeNode) {
	var objectStore  = getObjectStore('recipes',"readwrite");
	// Do something when all the data is added to the database.
	var request = null;
	if (recipeNode.first) {
		request = objectStore.put(recipeNode,recipeNode.first.output_item_id);
	} else {
		request = objectStore.put(recipeNode,recipeNode.output_item_id);
	}
	request.onsuccess = function(event) {
		console.log("Add recipe done success");
		// event.target.result == customerData[i].ssn
	};
}

//Note: method get produces the same result for:
//a) a record that doesn't exist in the database and
//b) a record that has an undefined value.
function getRecipe(itemId) {
	return new Promise(function(resolve, reject) {
		if (itemId === "" || isNaN(itemId)) {
			resolve(false);
		}
		var store = getObjectStore('recipes');
		var getRequest = store.get(itemId);
		getRequest.onerror = function() {
			reject('error in getRecip');
		};
		getRequest.onsuccess = function() {
			if(getRequest.result) {
				resolve( getRequest.result );
			} else {
				resolve(false);
			}
		};
	})
}

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
				// Sinon rejette avec le texte du statut
				// qui on l’éspère sera une erreur ayant du sens
				reject(Error(req.statusText));
			}
		};
		req.send();
	});
}

function getRecipeDetail(recipeId){
	 return get('https://api.guildwars2.com/v2/recipes/'+recipeId);
}

function searchRecipe(ingredientId) {
	//console.log('Search for recipe that create ' + ingredientId);
	var uri = 'https://api.guildwars2.com/v2/recipes/search?output='+ingredientId;
	return get(uri);
}

//legacy but working
function legacybuildRecip(recipeId) {
	var craft = {};
	var first = true;

	//Needed to derterminate the end of recursive
	var waiting = 0;
	var call = false;
	var total = 0;
	var searchDone =0;

	return new Promise(
        function (resolve, reject) {
        	function listReceip(recipeId,callBack) {
        		getRecipeDetail(recipeId)
        		.then( function(recipeDetail){
        			total += recipeDetail.ingredients.length;
        			//enterPoint
        			if (first) {
        				craft.first = recipeDetail;
        			} else {
        				craft[recipeDetail.output_item_id] = recipeDetail;
        			}
        			//Find every lonked component
        			for (var ingredientKey in recipeDetail.ingredients) {
        				searchRecipe(recipeDetail.ingredients[ingredientKey].item_id)
        				.then( function(dependReciveId) {
        					if(dependReciveId.length > 1) {
        						onError('dafuk impossibbbleee');
        					}
        					if(dependReciveId.length !== 0) {
        						first = false;
        						waiting++;
        						searchDone++;
        						listReceip(dependReciveId[0],callBack);
        					} else {
        						searchDone++;
        						//find finish condition
        						if (typeof callBack === 'function' && (waiting === -1) && !call && (searchDone === total)) {
        							call = true;
        							//console.log('total ' + total + 'search ' + searchDone );
        							callBack(craft);
        						}
        					}
    					})
        				.catch( onError(e) );
        			}
        			waiting--;
        		})
				.catch( function(e){ console.log('call to reject first'); reject(e); });
        	}
        	//Call
        	listReceip(recipeId, function(supercraft) {
        		resolve(supercraft) ;
        	});
        }
    );
}

function craftFinder(recipeId) {
	    return new Promise( function (resolve, reject) {

		    var successCallback = function(supercraft) {
		    	resolve(supercraft) ;
		    },
		    errorCallback  = function(e) {
		    	console.log('Failur : ');
		    	console.log(e);
		    	reject(e);
		    };
		    var search  = new RecipeCreator(recipeId,successCallback,errorCallback );
		   	search.findRecipeIngredients(recipeId);
	    })
}

//#instancie tous le bordel
function findRecip(idRecip) {
	craftFinder(idRecip)
	.then( function(supercraft) {
		//tell the main thread to run a workDealThread
		reply('done' , supercraft );
		//ask a new recip
		reply('next', idRecip );
	})
	.catch( function(e){ onError(e); });
}

// Custom PUBLIC functions (i.e. queryable from the main page)
var queryableFunctions = {
	// example #1: get the difference between two numbers:
	find: function (idRecip) {
		findRecip(idRecip);
	},
	// example #2: wait three seconds
	waitSomething: function () {
	 	 setTimeout(function() { reply("alertSomething", 3, "seconds"); }, 3000);
	},
	initDB : function() {
		openDb( function() { reply('DBOpen'); });
	}
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