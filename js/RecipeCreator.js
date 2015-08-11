//New but not working with many worker (work fine with one)
/*
    Recursivide call, list all the componenet id needed for a recept
    Hydryde craft property : key first is the item to craft
    add Id key with recipe in value
 */
function RecipeCreator(recipeId , callBackSucceed , callbackFailure) {
    this.recipeId = recipeId;
    this.output_item_id = 0;
    this.callBack = callBackSucceed;
    this.callbackFailure = callbackFailure || onError;

    var craft = {};
    var first = true;
    var self = this;

    //Needed to derterminate the end of recursive
    //when we call to find a new recipe
    var waiting = 0;
    var call = false;
    this.searchDone =0;
    var ingredientsTofindCpt = 0;

    var logPrefix = 'In '+ this.recipeId+' ';

    //Todo : rename with infredient
    RecipeCreator.prototype.callToFindRecipe = function(ingredientId) {
        //Todo : add search to indexdb
        searchRecipe(ingredientId).then( function(dependReciveId) {
            if (DEBUG) {
                console.log(logPrefix+'dependend ingredient for '+ingredientId +  ' = ' +dependReciveId.length);
            }
            if(dependReciveId.length > 1) {
                onError('dafuk impossibbbleee');
            }
            if(dependReciveId.length !== 0) {
                first = false;
                waiting ++;
                self.findRecipeIngredients(dependReciveId[0]);
            } else {
                self.searchDone++;
                self.mayFinish();
            }
        })
        .catch( self.callbackFailure);
    };

    RecipeCreator.prototype.DBtoJs = function(recipeNode) {
        console.log('DBtojs');
        var size = 0;
        //it's an addition, so we must destroy 'first' key
        if (recipeNode.hasOwnProperty('first') ) {
            recipeNode[recipeNode.first.output_item_id] =  recipeNode.first;
            delete recipeNode.first;
        }
        for (var key in recipeNode) {
            if ( ! craft.hasOwnProperty(key) ) {
                craft[key] = recipeNode[key];
                size ++;
            }
        }
        self.searchDone++;
        waiting--;
    };

    RecipeCreator.prototype.mayFinish = function() {
        if (DEBUG){
            console.log(logPrefix + ': in may finish, searchDone =  '+ self.searchDone + ' and totalingredient  = ' + ingredientsTofindCpt + ' waiting = '+waiting);
        }
        //find finish condition
        if ( (typeof self.callBack === 'function') && (!call) && (self.searchDone === ingredientsTofindCpt)) {
            call = true;
            if (DEBUG){
                console.log(logPrefix + ': success callback call');
            }
            self.callBack(craft);
        }
        return;
    };

    //error if callBack failure
    RecipeCreator.prototype.findRecipeIngredients = function(recipeId) {
        getRecipeDetail(recipeId).then( function(recipeDetail) {
            //Check if the recip is in the database
            getRecipe(recipeDetail.output_item_id).then( function(existingRecipe){
                if (DEBUG) {
                    var existingText = existingRecipe ? 'true' : 'false';
                    console.log(logPrefix + 'getRecipe of ' +recipeDetail.output_item_id +' : ' +  existingText );
                }
                if (existingRecipe) {
                    if (first) {
                        //huge gain of time in that case
                        self.callBack(existingRecipe);
                    } else {
                        self.DBtoJs(existingRecipe);
                        //Caution don't use existingRecipe now (modification in DBtoJs)
                        self.mayFinish();
                    }
                } else {
                    if (first) {
                        //recipe enterPoint
                        craft.first = recipeDetail;
                    } else {
                        //add recipe dependency like 'list chaner'
                        craft[recipeDetail.output_item_id] = recipeDetail;
                        self.searchDone++;
                    }
                    //Find every linked component
                            for (var ingredientKey in recipeDetail.ingredients) {
                                ingredientsTofindCpt ++;
                                var ingredientId = recipeDetail.ingredients[ingredientKey].item_id;
                                if (DEBUG) {
                                    console.log(logPrefix+'ingredientsNeed : ' + ingredientsTofindCpt);
                                    console.log(logPrefix+ 'call to find ' + ingredientId );
                                }
                                self.callToFindRecipe(ingredientId);
                            }
                            waiting--;
                }
            })
            .catch( self.callbackFailure );
        })
        .catch( self.callbackFailure );
    };
}