Game manager class

Required:

- Instance variables
	- Settings (and getter)
	- MatchID (and getter)
	- Host
	- io

    - gameName (set by subclass)
	- timeoutFunction (set by subclass) - a function to run when the current player's timer expires
    
-----------------------------------
- Functions (superclass)
	- setGameState(data) - takes in data, reads its attributes, and sets those attributes of the game state.

	- setPlayerData(id, data) - takes in a player ID (database ID) and data, reads the data's attributes, and sets those attributes of the player

	- requestPlayerDrop(id) - drops a player out of the game (only after the game ends) - default behavior set by superclass, which just sets the player's rematch flag to false, and tells the socketManager to delete the game if only one player remains. May be extended by the subclass

	- addPlayer(user) - add a player to the game (or re-add them if they are reconnecting). Start the game if full

	- sendGameUpdate() - send the updated game state to all users

	- getMatchId (getter for match ID)

	- getGameState (returns a copy of the game state)

	- getPlayers (returns a list of the players)

	- getSettings (returns the game settings)

    - requestRematch(id) - sets rematch flag for player with indicated ID to true, and starts a rematch if all rematch flags are true.

    - refreshGameState - refreshes the game state for timer purposes (or returns the game state if no timer)

	- handleRatingChange, handleBulkRatingChange - handle rating changes after a game ends

	- startTurnClock() - sets timeout for current player.
------------------------------------
- Functions set by subclass
    - verifySettings(settings) - takes in the game settings and verifies that they are valid. If not, throws an error, which should be caught by the socket manager

    - getTurn(gameState) - takes in a game state (usually the current one) and returns the index of the player whose turn it is.

	- playMove(data) - takes in data (including the user that is playing the move), determines if the move is legal, and returns the status of the move ('OK' or 'fail') 
		and, if successful, the new game state, and a message with the reason for failure if the move failed. Handles the timer (for player timeout) if necessary. Calls sendGameUpdate() if successful.

	- removePlayer(id, reason) - remove a player from the game, and determine if the game should end as a result. Usually due to a disconnect and timeout. Calls sendGameUpdate() if successful.

	- startGame - set the initial game state, do other pre-game prep (e.g. determine player order if necessary, remove empty players, etc.). Calls sendGameUpdate() if successful.

    - requestPlayerDrop(id) - drops a player out of the game (only after the game ends). Call super.requestPlayerDrop(id) first, and then implement logic for other behaviors (whether to delete the game, etc.).

    - startRematch - do pre-game prep for rematch (e.g. shuffle player order, etc.) and starts the game. Calls sendGameUpdate() if successful.

	- handleEndGame - package up the results for rating changes, calls rating change methods, sets results (pseudo-HTML for result modal on client side) and ratingChanges attributes of gameState. Does NOT call sendGameUpdate().

----------------------