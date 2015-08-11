window.indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
// DON'T use "var indexedDB = ..." if you're not in a function.
// Moreover, you may need references to some window.IDB* objects:
window.IDBTransaction = window.IDBTransaction || window.webkitIDBTransaction || window.msIDBTransaction;
window.IDBKeyRange = window.IDBKeyRange || window.webkitIDBKeyRange || window.msIDBKeyRange;
//wrapping your code in a self-executing closure
(function(){
"use strict";

const DB_NAME = 'gw2-FYD';
const DB_VERSION = 5; // Use a long long for this value (don't use a float)
const DEBUG = false;
const LOGPREFIX = 'Search : ';
const LANG = 'en';
//available : en/es/de/fr/ko/zh

//IndexedDB uses object stores rather than tables
//Whenever a value is stored in an object store, it is associated with a key.
//There are several different ways that a key can be supplied depending on whether the object store uses a key path or a key generator.
var db;
var SearchCriteria = {
	exceptRarity : ['Junk','Basic','Ascended','Legendary'],
	excepFlag : ['AccountBound','NoSell'],
	excepType : ['Bulk','CraftingMaterial ','Gathering','Bag' ],
	minLevel : 70,
	check : function(infoNode){
		if (infoNode.rarity && SearchCriteria.exceptRarity.indexOf(infoNode.rarity) !== -1){
			return false;
		}
		if( !(infoNode.level >= SearchCriteria.minLevel  || infoNode.level === 0) ) {
		 	return false;
		}
		if (infoNode.type && SearchCriteria.excepType.indexOf(infoNode.infoNode) !== -1){
			return false;
		}
		for( var flag in infoNode.flags) {
			if (SearchCriteria.excepFlag.indexOf(infoNode.flags[flag]) !== -1){
				return false;
			}
		}
		return true;
	}
};

//implement max compo
var DealCriteria = {
	taxePercent : 0.15,
	satisfactoryMarge : 0.15,
	satisfactoryGain : 3000,
	minMarge : 8000,
	checkSellNumber : 20,
	checkBuyNumber : 20,
	maxCompo : 8
};

//Todo
var blackList = [3993,4909,8587,9225,
		12132,12610,12623,12663,12697,12703,12705,
		23893,23311,23325,23757,23411,23987,30034,45238,67185,67344];


function checkCompatibility() {
	if ((!!window.Worker) && (!!window.indexedDB) && (!!window.IDBTransaction)) {
		return true;
	}else {
		console.error('change browser, chrome is good');
		return false;
	}
}

function onError(evt) {
	console.log(evt);
  	console.log('Line #' + evt.lineno + ' - ' + evt.message + ' in ' + evt.filename);
}

/** INDEXED DATABASE */

/*
Note: method get produces the same result for:
a) a record that doesn't exist in the database and
b) a record that has an undefined value.
 */
//may be promise ?
function openDb(callback) {
	console.log(LOGPREFIX + "openDb ...");
	var req = window.indexedDB.open(DB_NAME, DB_VERSION);

	req.onsuccess = function () {
		// Better use "this" than "req" to get the result to avoid problems with
		// garbage collection.
		db = this.result;
	    	db.onerror = function(evt) {
			// Generic error handler for all errors targeted at this database's requests!
			console.log('Database error: ' + evt.target.error.message);
	    	};
	    	console.log(LOGPREFIX + "openDb DONE");
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
		var txn = evt.target.transaction;

		var recipeStore,infoStore,infoDeal;
		if (evt.newVersion != evt.oldVersion) {
		            // Get exiting objectStor
		            recipeStore = txn.objectStore('recipes');
		            infoStore = txn.objectStore('infos');
		 } else {
		 	//db creation
			recipeStore = thisDb.createObjectStore(
			 'recipes', {  autoIncrement: false });

			infoStore = thisDb.createObjectStore(
			'infos', {  autoIncrement: false });

			infoDeal = thisDb.createObjectStore(
			'deal', {  keyPath:"id",autoIncrement: false });
			// var infoStore = thisDb.createObjectStore(
			// 'infos', {  keyPath: "id", autoIncrement: false });
			// infoStore.createIndex('id', 'id', { unique: true });
		}
		//recipeStore.clear();
		//infoStore.clear();
	};
}

  var storeCreateIndex = function (objectStore, name, options) {
            if (!objectStore.indexNames.contains(name)) {
                objectStore.createIndex(name, name, options);
            }
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

function clearObjectStore(store_name) {
	var store = getObjectStore(store_name, 'readwrite');
	var req = store.clear();
	req.onsuccess = function() {
		console.log("Store cleared");
	};
	req.onerror = function (evt) {
		console.error("clearObjectStore:", evt.target.errorCode);
   	};
 }

function getInfoLegacy(itemId) {
	return new Promise(function(resolve, reject) {
		if (itemId === "" || isNaN(itemId)) {
		        resolve(false);
		}
		var store = getObjectStore('infos');
		var req = store.openCursor(itemId);
		req.onsuccess = function(e) {
			var cursor = e.target.target;
			if (cursor) { // key already exist
				var getRequest = store.get(itemId);
				getRequest.onerror = function() {
					console.log('error in getinfo');
				};
				getRequest.onsuccess = function() {
					// Do something with the request.result!
					console.log("Item: " + itemId + " " +getRequest.result.name);
					resolve( getRequest.result );
				};
				console.log('true') ;
			} else { // key not exist
				resolve('key '+itemId +" doesn\' exist" ) ;
			}
		};
	});
}

/**
 * [getRecipe from the id of the item to create]
 * @param  {[type]} itemId [description]
 * @return {Promise}
 */
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
	});
}

function getInfoCraft(itemId) {
	return new Promise(function(resolve, reject) {
		if (itemId === "" || isNaN(itemId)) {
			resolve(false);
		}
		var store = getObjectStore('infos');
		var getRequest = store.get(itemId);
		getRequest.onerror = function() {
			reject('error in getInfoCraft');
		};
		getRequest.onsuccess = function() {
			if(getRequest.result) {
				resolve( getRequest.result );
			} else {
				resolve(false);
			}
		};
	});
}

/**
 * [addRecipe add a recipeNode with the output craftable item in id]
 * @param {[type]} recipeNode [description]
 */
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

function addInfoCraft(key,infoNode) {
	return 	addWithPromise("infos",infoNode,key);
}

function addWithPromise(objectStoreName,value,key){
	return new Promise(function(resolve, reject) {
		var objectStore  = getObjectStore(objectStoreName,"readwrite");
		var request = objectStore.put(value,key);
		request.onsuccess = function(event) {
			resolve();
		};
	});
}




var createListIdsInfo = function( object) {
	var ids = [];
	for( var itemId in object) {
		if(itemId === 'first') {
			ids.push(object[itemId].output_item_id);
		}
		for (var idIngredient in object[itemId].ingredients) {
			ids.push(object[itemId].ingredients[idIngredient].item_id);
		}
	}
	return ids;
};

/*
Get all the information from the API or indexedDb
return promisse
todo : rename
 */
function infoReceipComponent(craft) {
	return new Promise(function(resolve, reject) {
		getInfoCraft(craft.first.output_item_id).then(function(existingInfo){
			if (DEBUG) {
				var existingText = existingInfo ? 'true' : 'false';
				console.log(LOGPREFIX + 'getInfoCraft of ' +craft.first.output_item_id +' : ' +  existingText );
			}
			if (existingInfo) {
				resolve(existingInfo) ;
			} else {
				var idsTab = createListIdsInfo(craft);
				if (DEBUG) {
					console.log(idsTab);
				}
				getItemsDetail(idsTab).then( function(itemsDetail) {
					//save into indexedDb
					addInfoCraft(craft.first.output_item_id,itemsDetail).then( function(){
						resolve(itemsDetail);
					});
				});
			}
		})
		.catch( function(e){ onError(e); });
	});
}


/* AJAX CALL TO GW2 API V2 */

//Ajax methode get with promise
//Todo : find solution to patial content
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

function getAllRecipe() {
	return get('https://api.guildwars2.com/v2/recipes');
}

function getItemDetail(itemId) {
	console.error('aaaa pourquoi ');
	var uri = 'https://api.guildwars2.com/v2/items/'+itemId;
	return get(uri);
}

function getItemsDetail(itemsIds) {
	var ids = '?ids='+ itemsIds[0];
	for (var i = 1; i < itemsIds.length; i++) {
		ids += ','+itemsIds[i];
	}
	var uri = 'https://api.guildwars2.com/v2/items'+ids;
	return get(uri);
}

/**
 * Get the information of specifique id (icon for exemple) from the info node
 * @param  {[type]} idTofind [description]
 * @param  {[type]} info     infoNode
 * @return {[type]}          information node or null
 */
function getInfoFromId(idTofind,info){
	for (var key in info) {
		// === doesn't work
		if (info[key].id == idTofind) {
			return info[key];
		}
	}
	return null;
}

/** DISPLAY THE DEAL  */
//todo add compo count
function ReceptDisplayer (info,craftRecip,compoCount) {
	this.data = info;
	this.craftRecip = craftRecip;
	var idRecip = craftRecip.first.id;

	var displayIngredientNode = function(ingredientNode , tier) {
		if(ingredientNode.length > 0) {
			//if div not exist we create it
			if( $('#node-'+ idRecip + '-' +tier).length === 0) {
				$( '#node-'+ idRecip + '-' + (tier-1) ).after ( '<div id=node-'+ idRecip + '-' + tier+'> </div>') ;
			} else {
				$( '<span>Ainsi que </span>').appendTo( '#node-'+ idRecip + '-' +tier );
			}
			for (var key in ingredientNode) {
				var infoNode = getInfoFromId([ingredientNode[key].item_id], info);
				var iconUrl = infoNode.icon;
				$( '<span> '+ingredientNode[key].count+' </span><img src='+iconUrl+' alt="">').appendTo( '#node-'+ idRecip + '-' +tier );
			}
		}
	};

	/*
	Recursive
	*/
	var displayCraft = function (craftNode , tier) {
		displayIngredientNode( craftNode.ingredients , tier );
		tier ++;
		for (var key in  craftNode.ingredients) {
			var ingredientId = craftNode.ingredients[key].item_id;
			//link to the previous recip
			var nextCraft = craftRecip[ingredientId];
			if (nextCraft) {
				displayCraft(nextCraft , tier);
			}
		}
	};

	//Diplay the item to create and initialise the container of
	//recipe and compoCont
	var displayFirstItem = function( output_item_iditemId){
		var infoNode = getInfoFromId(output_item_iditemId, info);
		console.log(infoNode);
		var iconUrl = infoNode.icon;
		//Create the recip container
		$( '<div class= recept-container id='+idRecip+' </div>').appendTo( '.all-recept' );
		//Left container for the recip tree
		var id = 'tree-'+idRecip;
		$( '<div class="recept-tree" id='+id+'> <span></div>').appendTo('#'+idRecip);
		//first Node of the tree
		id = 'node-'+idRecip+'-0';
		$( '<div  id='+id+'> <span>' +infoNode.name +' ('+ infoNode.rarity+ ') Lvl : '+infoNode.level+'</span>' + '<img src='+iconUrl+' alt=""> </div>').appendTo('#tree-'+idRecip);

		//right container for compocount
		id = 'compoCout-'+idRecip;
		$( '<div class="recept-compoCount" id='+id+'> <p> You will need the following component : </p> </div>').appendTo('#'+idRecip);
	};


	var displayCompoCount = function(){
		var compoCountNode = $('#compoCout-'+idRecip);
		console.log(compoCount);
		for (var item in compoCount ) {
			var infoNode = getInfoFromId(item, info);
			var iconUrl = infoNode.icon;
			$( '<span> '+compoCount[item]+" " + infoNode.name +' </span><img src='+iconUrl+' alt=""><br />').appendTo(compoCountNode);
		}
	};

	ReceptDisplayer.prototype.displayAllRecipe = function () {
		//display the final result
		displayFirstItem(this.craftRecip.first.output_item_id,0);
		displayCraft(this.craftRecip.first,1);
		displayCompoCount();
	};

	ReceptDisplayer.prototype.getCoin = function (coin, asHtml) {
		var text = (coin % 100) + 'c';
		var html = (coin % 100) + '&nbsp;<img src="img/20px-pb.png" alt="Copper" />';
		if (coin >= 100) {
			var silver = (coin / 100 >> 0) % 100;
			html = silver + '&nbsp;<img src="img/20px-pa.png" alt="Silver" />&nbsp;' + html;
			text = silver + 's ' + text;
		}
		if (coin >= 10000) {
			var gold = coin / 10000 >> 0;
			html = gold + '&nbsp;<img src="img/20px-po.png" alt="Gold" />&nbsp;' + html;
			text = gold + 'g ' + text;
		}
		return asHtml ? html : text;
	};

	ReceptDisplayer.prototype.addGain = function (costCoin,gainCoin) {
		//display the final result
		var cost = this.getCoin(costCoin,true);
		var gain = this.getCoin(gainCoin,true);
		$( '<p> Craft Price : ' +cost + 'but sell gain is '+gain+'</p>' ).appendTo('#'+idRecip) ;
	};
}

/*
  QueryableWorker instances methods:
   * sendQuery(queryable function name, argument to pass 1, argument to pass 2, etc. etc): calls a Worker's queryable function
   * postMessage(string or JSON Data): see Worker.prototype.postMessage()
   * terminate(): terminates the Worker
   * addListener(name, function): adds a listener
   * removeListener(name): removes a listener
  QueryableWorker instances properties:
   * defaultListener: the default listener executed only when the Worker calls the postMessage() function directly
*/
function QueryableWorker (sURL, fDefListener, fOnError) {
	var self = this,
	oWorker = new Worker(sURL),
	oListeners = {};
	this.defaultListener = fDefListener || function () {};
	if (fOnError) { oWorker.onerror = fOnError; }

	oWorker.onmessage = function (oEvent) {
		//call the listener if reply
		if (oEvent.data instanceof Object && oEvent.data.hasOwnProperty("vo42t30") && oEvent.data.hasOwnProperty("rnb93qh")) {
			//The apply() method calls a function with a given this value and arguments provided as an array
			//fun.apply(thisArg, [argsArray])
		  	oListeners[oEvent.data.vo42t30].apply(self, oEvent.data.rnb93qh);
		} else {
			//or call the default one
			self.defaultListener.call(self, oEvent.data);
		}
	};

	/* queryable function name, argument to pass 1, argument to pass 2, etc. etc */
	this.sendQuery = function () {
		if (arguments.length < 1) { throw new TypeError("QueryableWorker.sendQuery - not enough arguments");  }
		oWorker.postMessage({ "bk4e1h0": arguments[0], "ktp3fm1": Array.prototype.slice.call(arguments, 1) });
	};

	this.postMessage = function (vMsg) {
		//I just think there is no need to use call() method
		//how about just oWorker.postMessage(vMsg);
		//the same situation with terminate
		//well,just a little faster,no search up the prototye chain
		Worker.prototype.postMessage.call(oWorker, vMsg);
	};
	this.terminate = function () {
		Worker.prototype.terminate.call(oWorker);
	};
	this.addListener = function (sName, fListener) {
		oListeners[sName] = fListener;
	};
	this.removeListener = function (sName) {
		delete oListeners[sName];
	};
}

function errorListener(evt) {
	console.log('Line #' + evt.lineno + ' - ' + evt.message + ' in ' + evt.filename);
}

function defaultMessageListener(e) {
	console.log('defaultListener');
	console.log(e);
}

function recipeWorkerDone(supercraft) {
	//Save the craft in the db
	getRecipe(supercraft.first.output_item_id).then( function(existingRecipe){
		if (!existingRecipe) {
			addRecipe(supercraft);
		}
	})
	.catch( onError );

	//Get and save the component information
	infoReceipComponent(supercraft).then( function(information){
		dealQueu.push({information,supercraft});
	})
	.catch( onError );
}

//Main
//More than 1 recipe worker = kaboom :/
function main() {
	getAllRecipe()
	.then( function(allRecipe) {
		var allRecipeIds = allRecipe,
		dealCpt = 0,
		dealQueu = [],
	 	availableWorker = [],
		dealWorkerPool = [],
		recipeIndex = 0,
		doneCpt = 0,
		recipeFinish = false,
		recipeWorker = new QueryableWorker('js/recipeWorker.js' , defaultMessageListener , errorListener);
		// recipe worker ask for a new recip
		recipeWorker.addListener('next', function () {
			if(recipeIndex < allRecipe.length) {
				recipeWorker.sendQuery('find', allRecipeIds[recipeIndex]);
				recipeIndex++;
			} else {
				console.log(LOGPREFIX + 'Recipe finish, worker terminated');
				recipeFinish = true;
				recipeWorker.terminate();
			}
		});
		recipeWorker.addListener('DBOpen', function () {
			console.log('Ready to start');
			recipeWorker.sendQuery('find', allRecipeIds[recipeIndex]);
			recipeIndex++;
		});
		//Once the recip is find, find if it's a deal
		recipeWorker.addListener('done',function (supercraft) {
			//Save the craft in the db
			getRecipe(supercraft.first.output_item_id).then( function(existingRecipe){
				if (!existingRecipe) {
					addRecipe(supercraft);
				}
			})
			.catch( onError );
			//Get and save the component information
			infoReceipComponent(supercraft).then( function(information){
				var idCraftableItem = supercraft.first.output_item_id;
				var firstInformation = getInfoFromId(idCraftableItem,information);
				//don't qeu if legendary or ascended
				if (SearchCriteria.check(firstInformation)){
					dealQueu.push({supercraft,DealCriteria});
					if (availableWorker.length > 0){
						availableWorker.shift().sendQuery('find',dealQueu.shift());
						if (DEBUG) {
							console.log(LOGPREFIX + 'availableWorker lenght :' + availableWorker.length);
						}
					} else {
						if (DEBUG) {
							console.log(LOGPREFIX + 'no worker available dealQueu length =' + dealQueu.length);
						}
					}
				} else {
					console.log(LOGPREFIX+ 'don\'t match criteria' );
				}
			})
			.catch( onError );
		});

		dealWorkerPool[0] = new QueryableWorker('js/dealWorker.js' , defaultMessageListener , errorListener);
		dealWorkerPool[1] = new QueryableWorker('js/dealWorker.js' , defaultMessageListener , errorListener);
		//dealWorkerPool[2] = new QueryableWorker('js/dealWorker.js' , defaultMessageListener , errorListener);
		for (var i in dealWorkerPool) {
			dealWorkerPool[i] = new QueryableWorker('js/dealWorker.js' , defaultMessageListener , errorListener);
			dealWorkerPool[i].addListener('available', function (objecData) {
				doneCpt++;
				if (DEBUG) {
					console.log(LOGPREFIX + 'object data : ');
					console.log(objecData);
				}
				if(objecData.deal) {
					dealCpt++;
					//save the recipte and id
					console.log('Craft price : '+objecData.craftPrice + ' and gain: ' + objecData.possibleGain);
					console.log('Deal cpt = '+dealCpt);
					//recup les info de la bdd
					getInfoCraft(objecData.supercraft.first.output_item_id).then ( function(information){
						var displayer = new ReceptDisplayer(information,objecData.supercraft,objecData.compoCount);
						displayer.displayAllRecipe();
						displayer.addGain(Math.round(objecData.craftPrice),Math.round(objecData.possibleGain));
					})
					.catch( function(e){ onError(e); });
				}
				availableWorker.push(this);
				console.log(LOGPREFIX+ doneCpt + ' recipe analysed');
				if(recipeFinish) {
					if(dealQueu.length > 0) {
						availableWorker.shift().sendQuery('find',dealQueu.shift());
					} else {
						console.log(LOGPREFIX + 'all recipe done ');
					}
				}
			});
			availableWorker.push(dealWorkerPool[i]);
		}

		//begin
		recipeWorker.sendQuery('initDB');
	})
	.catch( function(e){ onError(e); });
}

function justOne(id) {
	if (!!window.Worker) {

		var dealWorkerPool = [];
		dealWorkerPool[0] = new QueryableWorker('js/dealWorker.js' , defaultMessageListener , errorListener);
		recipeWorker.addListener('next', function () {
			recipeWorker.sendQuery('find', {info,supercraft});
		});

		var recipeWorker = new QueryableWorker('js/recipeWorker.js' , defaultMessageListener , errorListener);
		console.log('Ready to start');
		//initialisation
		recipeWorker.addListener('DBOpen', function () {
			recipeWorker.sendQuery('find', id);
		});
		recipeWorker.addListener('next', function () {
			recipeWorker.terminate();
		});
		recipeWorker.addListener('done', recipeWorkerDone);
		recipeWorker.sendQuery('initDB');

	} else {
		console.log('change de browser');
	}
}

function testDb() {
	openDb();
	getRecipeDetail(1974)
	.then( function(craft) {
		addRecipe(craft);
		infoReceipComponent(craft).then( function(result){
			console.log(result);
		});
	})
	.catch( function(e){ onError(e); });
}

//Call
if(checkCompatibility()){
	console.log('◕‿◕', 'Hi, your navigator can run this experimental progam');
	openDb( main );
} else {
	console.log('ಠ_ಠ', 'Bad navigator, bad !');
}
//openDb(justOne(1905));
//testDb();
})();