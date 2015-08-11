var DealModul = function(craftRecip,DealCriteria) {
    this.craftRecip = craftRecip;
    //Id with the number to buy
    this.compoCount = [];
    //Id with the crafPrice
    this.craftDetailPrice = {};
    //Item purchase price
    this.buyPrice = 0;
    this.crafPrice = 0;
    this.possibleGain = 0;

    var idDeal = craftRecip.first.output_item_id;
    var logPrefix = 'DealWorker '+ idDeal+' ';

    var taxe = DealCriteria.taxePercent || 0.15;
    var satisfactoryMarge = DealCriteria.satisfactoryMarge || 0.20;
    var minGain = DealCriteria.satisfactoryGain || 3000;
    var minMarg =DealCriteria.minMarge || 7000;
    var minSellNumber = DealCriteria.checkSellNumber || 1;
    var minBuyNumber = DealCriteria.checkBuyNumber || 30;

    //Variable for computation
    var previousNode ={};
    var lastNode = {};
    var self = this;

    //todo work on that
    DealModul.prototype.countForCraft = function (craftNode ,from ) {
        //create the first one; hydrate previous one;
        this.countForNode(craftNode.ingredients , from);
        for (var key in craftNode.ingredients) {
            var ingredientId = craftNode.ingredients[key].item_id;
            //link to the previous recip
            var nextCraft = this.craftRecip[ingredientId];
            //if there is another
            if (nextCraft) {
                this.countForCraft(nextCraft,ingredientId);
            } else {
                if (from) {
                    var value = (lastNode[from]) ? lastNode[from] : previousNode[from];
                    this.compoCount[ingredientId] =  value * craftNode.ingredients[key].count;
                } else {
                    //if first compo in the first recur
                    this.compoCount[ingredientId] = craftNode.ingredients[key].count;
                }
            }
        }
    };

    DealModul.prototype.countForNode = function(ingredientNode , from ) {
        if(ingredientNode.length > 0) {
            for (var key in ingredientNode) {
                if (from) {
                    if (lastNode[ingredientNode[key].item_id]) {
                        lastNode[ingredientNode[key].item_id] += previousNode[from]*ingredientNode[key].count;
                    } else {
                        lastNode[ingredientNode[key].item_id] = previousNode[from]*ingredientNode[key].count;
                    }
                } else {
                    if (previousNode[ingredientNode[key].item_id]) {
                        previousNode[ingredientNode[key].item_id] += ingredientNode[key].count;
                    } else {
                        previousNode[ingredientNode[key].item_id] = ingredientNode[key].count;
                    }
                }
            }
        }
    };

    //unit price of undefined

    //Based on curent comerce list compute the craftDetailPrice for a compo
    DealModul.prototype.computCraftDetailPrice = function (nodeCommerceList) {
        //display the final result
        var itemId = nodeCommerceList.id;
        var quantityToBuy = this.compoCount[itemId];
        this.craftDetailPrice[itemId] = 0;
        for ( var stack in nodeCommerceList.sells ) {
            var stackQuantity = nodeCommerceList.sells[stack].quantity;
            if( stackQuantity ==='undefined') console.error('Stack quantity undefined');
            if (stackQuantity >= quantityToBuy ) {
                this.craftDetailPrice[itemId] += nodeCommerceList.sells[stack].unit_price * quantityToBuy;
                return;
            } else {
                this.craftDetailPrice[itemId] += nodeCommerceList.sells[stack].unit_price * stackQuantity;
                quantityToBuy -= stackQuantity;
            }
        }
    };

    DealModul.prototype.findCraftPrice = function (callBack,errorCallBack) {
        //find the list of all compo
        this.countForCraft(this.craftRecip.first);
        if (DEBUG) {
            console.log(logPrefix+'List compo :');
            console.log(this.compoCount);
        }
        //get the current price in HDV
        getCommercesListing(this.compoCount).then(
            function(data) {
                var listings = [];
                if( data[0].constructor === Array ) {
                    for (var i in data){
                        listings = listings.concat(data[i]);

                    }
                    console.log(listings);
                } else {
                    listings = data;
                }
                if(data.length >= 6) {
                    console.error(listings);
                }

                for( var key in listings) {
                    self.computCraftDetailPrice(listings[key]);
                }
                if (DEBUG) {
                    console.log(logPrefix+'Detail price :');
                    console.log(self.craftDetailPrice);
                }
                //total price
                for( var itemPrice in self.craftDetailPrice) {
                    self.crafPrice += self.craftDetailPrice[itemPrice];
                }
                //Add sell taxe
                //console.log('withou taxe :' + self.crafPrice);
                self.crafPrice  += (self.crafPrice * taxe);
                if (typeof callBack === 'function') {
                    callBack();
                }
            })
        .catch( function(e){
            console.error('dealWorker can not have the craft price');
            console.log(self.compoCount);
            console.log('call to error callBack');
            if (typeof errorCallBack === 'function') {
                errorCallBack();
            }
            onError(e);
        });
    };

    //Ask the API for the first buy price
    DealModul.prototype.findBuyPrice = function () {
        return new Promise( function (resolve, reject) {
            var itemId = self.craftRecip.first.output_item_id;
            getCommercePrice(itemId)
            .then( function (prices) {
                if ( prices.sells.quantity >= minSellNumber && prices.buys.quantity >= minBuyNumber ) {
                    self.buyPrice = prices.sells.unit_price;
                    if (DEBUG) {
                        console.log(logPrefix+'find a buy price :'+self.buyPrice);
                    }
                    resolve(true);
                } else {
                    console.log('Do not have the min sale requirement');
                    resolve(false);
                }
            })
            .catch( function(e){
                console.error('There is no prices at all') ;
                 onError(e);
                resolve(false);
             });
        });
    };

    DealModul.prototype.isDeal = function() {
        return new Promise( function (resolve, reject) {
                    var successCallBack = function () {
                        if(self.buyPrice <1 ) {
                            console.error('hum craft price <1 and you call me ?');
                        }
                        if (DEBUG) {
                            console.log(logPrefix+'call to isDealCallBack whith buyPrice = '+self.buyPrice);
                        }
                var margin = self.buyPrice - self.crafPrice;
                var deal = ( (margin >= (satisfactoryMarge * self.crafPrice) && margin>= minMarg) || (margin>= minGain) );
                self.possibleGain = margin;
                resolve(deal);
            };

                    self.findBuyPrice().then( function(existingPrice){
                        if(existingPrice) {
                            self.findCraftPrice( successCallBack , function(){resolve(false); } );
                        } else {
                            resolve(false);
                        }
                    })
                    .catch( function(e){
                        console.error('call to reject catch') ;
                        onError(e);
                        reject(false);
                    });
        });
    };
};