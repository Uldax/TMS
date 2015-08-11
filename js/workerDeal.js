//Ajax methode get with promise
function get(url) {
	// Renvoie une nouvelle promesse.
	return new Promise(function(resolve, reject) {
		// Fais le boulot XHR habituel
		var req = new XMLHttpRequest();
		req.open('GET', url);
		req.onload = function() {
			// Ceci est appelé même pour une 404 etc.
			// aussi vérifie le statut
			if (req.status === 200) {
				// Accomplit la promesse avec le texte de la réponse
				resolve(JSON.parse(req.response));
			}
			else {
				// Sinon rejette avec le texte du statut
				// qui on l’éspère sera une erreur ayant du sens
				reject(Error(req.statusText));
			}
		};
		// Gère les erreurs réseau
		req.onerror = function(e) {
		 	reject(Error('Une erreur ' + e.target.status + 's\'est produite au cours de la réception du document.'));
		};
		// Lance la requête
		req.send();
	});
}

function onError(err) {
  console.log('FAIL: ' + err.message);
}

function getCommercesListing(itemsIds) {
	var ids = '?ids=';
	for (var id in itemsIds) {
		ids += id+',';
	}
	ids = ids.substring(0,ids.length-1);
	var uri = 'https://api.guildwars2.com/v2/commerce/listings'+ids;
	return get(uri);
}

function getCommerceListing(itemId) {
	var uri = 'https://api.guildwars2.com/v2/commerce/listings/'+itemId;
	return get(uri);
}


this.onmessage = function(e) {
  var info = e.data[0];
  var supercraft = e.data[1];
  var commerce = new CommerceModule(info,supercraft);
  commerce.isDeal().then( function(deal){
  	this.postMessage([deal,commerce.crafPrice,commerce.possibleGain]);
  });
};