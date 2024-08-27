const { v4: uuidV4 } = require('uuid');
const pregameLength = 1500;
const Player = require('../../models/userModel');

class GameManager {
	setGameState(data) {
		if ((typeof data).toLowerCase() !== 'object') return;
		const items = Object.getOwnPropertyNames(data);
		items.forEach((i) => {
			this.gameState[i] = data[i];
		});
	}

	setPlayerData(id, data) {
		if ((typeof data).toLowerCase() !== 'object') return;
		const items = Object.getOwnPropertyNames(data);

		this.gameState.players.some((p) => {
			if (!p.user) return false;
			if (p.user.id === id) {
				items.forEach((i) => {
					p[i] = data[i];
				});
				return true;
			}
		});
	}

	requestPlayerDrop(id) {
		if (this.gameState.status !== 'ended')
			return {
				status: 'fail',
				message: 'This game is still active.',
			};

		this.gameState.players.some((p) => {
			if (p.user.id === id) {
				p.rematch = false;
				p.connected = false;
				return true;
			}
		});

		return {
			status: 'OK',
		};
	}

	//adds a player to the game
	addPlayer(user, ...data) {
		//see if the player is already in the game -
		//if so, update their information (possibly a reconnect, so they'll need a new socket ID, etc.)
		let playerAdded = false;
		let playerUpdated = false;
		let gameStarted = false;
		if (
			!this.gameState.players.some((p) => {
				if (p.user?.id === user.id) {
					playerUpdated = true;
					p.user.socketId = user.socketId;
					p.connected = true;
					return true;
				}
			})
		) {
			//if not, add them
			if (
				!this.gameState.players.some((p) => {
					if (!p.user) {
						playerAdded = true;
						p.rematch = false;
						p.connected = true;
						p.user = {
							id: user.id,
							socketId: user.socketId,
							name: user.name,
							rating: user.rating ? user.rating.rating : 1200,
						};

						return true;
					}
				})
			) {
				//if there was no space, return nothing
				return {
					status: 'fail',
					message: 'This game is full.',
				};
			}
		}

		//if we added a player, and the game is full, start it.
		//otherwise, send a game update
		if (
			playerAdded &&
			this.gameState.players.every((p) => {
				return p.user;
			})
		) {
			{
				gameStarted = true;
				this.startGame();
			}
		} else this.sendGameUpdate();

		return {
			status: 'OK',
			playerAdded,
			playerUpdated,
			gameStarted,
		};
	}

	sendGameUpdate() {
		const gameState = this.getGameState();
		this.gameState.players.forEach((p, i) => {
			if (!p.user) return;
			if (this.io)
				this.io.to(p.user.socketId).emit('update-game-state', {
					...gameState,
					myIndex: i,
				});
		});
	}

	getMatchId() {
		return this.matchId;
	}

	getGameState() {
		return this.gameState;
	}

	getPlayers() {
		return this.gameState.players;
	}

	getSettings() {
		return this.settings;
	}

	requestRematch(id) {
		if (this.gameState.status !== 'ended')
			return {
				status: 'fail',
				message: 'This game is still active.',
			};

		if (
			!this.gameState.players.some((p) => {
				if (p.user.id === id) {
					p.rematch = true;
					return true;
				}
			})
		) {
			return {
				status: 'fail',
				message: 'You are not in this game.',
			};
		}

		if (
			this.gameState.players.every((p) => {
				return p.rematch;
			})
		)
			this.startRematch();

		return {
			status: 'OK',
			players: this.gameState.players,
		};
	}

	refreshGameState() {
		if (!this.gameState) return null;
		if (this.gameState.status !== 'playing') return this.getGameState();

		const timerSetting = this.settings.timer;
		const turn = this.getTurn(this.gameState);

		if (timerSetting === 'off' || !timerSetting) return this.getGameState();

		const timeElapsed = Date.now() - this.gameState.turnStart;

		this.setGameState({
			players: this.gameState.players.map((p, i) => {
				if (i === turn)
					return {
						...p,
						time: Math.max(0, p.time - timeElapsed),
						reserve:
							this.settings.timer === 'move'
								? p.reserve -
								  Math.max(0, timeElapsed - this.settings.time * 60000)
								: 0,
					};
				return p;
			}),
			turnStart: Date.now(),
		});
		return this.getGameState();
	}

	//to be implemented by the subclass

	removePlayer(id, reason) {}
	getTurn(gameState) {}
	playMove(data) {}
	verifySettings(settings) {}
	startGame() {}
	async handleEndGame() {}
	startRematch() {}

	/**
	 *
	 * @param {The first player's rating} a
	 * @param {The second player's rating} b
	 * @param {The K-value - a larger value lends itself to more volatile rating changes} K
	 * @param {The result for the first player, a. 1 = win, 0 = loss, 0.5 = draw} result
	 * @returns The change in rating
	 */
	getRatingChange(a, b, K, result) {
		const pWin = 1 / (1 + Math.pow(10, (b - a) / 400));
		return K * (result - pWin);
	}

	//rating change for a 2-player game - reformats the input and sends it to the bulk rating change method
	async handleRatingChange(user1, user2, result) {
		if (!this.gameName) return null;
		const toReturn = await this.handleBulkRatingChange([
			{
				user1,
				user2,
				result,
			},
		]);
		return toReturn;
	}

	/**
	 *
	 * @param {An array of result objects, formatted as follows:
	 *
	 * {
	 * 		user1 (user object from gameState.players),
	 * 			{
	 * 				id: [id from database],
	 * 				socketId: awfkejlwg,
	 * 				name: 'Bob',
	 * 				rating: {
	 * 					game: 'asdf',
	 * 					rating: 1200,
	 * 					games: 12,
	 * 				}
	 * 			}
	 * 		user2,
	 * 		result: result for user1 (0, 1, 0.5 for loss, win, draw)
	 * }
	 *
	 * The array should NOT contain mirrored results (i.e. if it contains A defeating B, it should not contain B losing to A as well)
	 *
	 * } results
	 */
	async handleBulkRatingChange(results) {
		const p = [];
		//get old ratings for each player
		results.forEach((r) => {
			if (!p.includes(r.user1.id)) p.push(r.user1.id);
			if (!p.includes(r.user2.id)) p.push(r.user2.id);
		});
		//set to 1200 with 0 games if unrated
		let players = await Promise.all(
			p.map((pl) => {
				return this.PlayerModel.findById(pl);
			})
		);
		players = await Promise.all(
			players.map((p) => {
				const rating = p.ratings.find((r) => {
					return r.game === this.gameName;
				});
				if (!rating) {
					p.ratings.push({
						game: this.gameName,
						rating: 1200,
						games: 0,
					});
					p.markModified('ratings');
					return p.save({
						validateBeforeSave: false,
					});
				} else {
					return p;
				}
			})
		);
		//create an array of rating changes
		const ratingChanges = players.map((p, i) => {
			const ratingInfo = p.ratings.find((r) => {
				return r.game === this.gameName;
			});
			return {
				id: p.id,
				oldRating: ratingInfo.rating || 1200,
				newRating: ratingInfo.rating || 1200,
				games: ratingInfo.games,
			};
		});

		//for each result, calculate the individual rating change
		results.forEach((res) => {
			const r1 = ratingChanges.find((r) => {
				return r.id === res.user1.id;
			});
			const r2 = ratingChanges.find((r) => {
				return r.id === res.user2.id;
			});
			const K1 = r1.games < 20 ? 32 : r1.games < 40 ? 16 : 8;
			const K2 = r2.games < 20 ? 32 : r2.games < 40 ? 16 : 8;

			r1.newRating =
				r1.newRating +
				this.getRatingChange(r1.oldRating, r2.oldRating, K1, res.result);
			r2.newRating =
				r2.newRating +
				this.getRatingChange(r2.oldRating, r1.oldRating, K2, 1 - res.result);
		});

		ratingChanges.forEach((rc) => {
			rc.newRating = Math.round(rc.newRating);
		});

		await Promise.all(
			ratingChanges.map(async (rc) => {
				const user = await this.PlayerModel.findById(rc.id);
				if (!user) return;
				user.ratings.some((g) => {
					if (g.game === this.gameName) {
						g.rating = rc.newRating;
						g.games = g.games + 1;
						return true;
					}
				});
				user.markModified('ratings');
				return user.save({ validateBeforeSave: false });
			})
		);
		return ratingChanges;
	}

	//
	startTurnClock() {
		if (this.timeout) clearTimeout(this.timeout);
		const turn = this.getTurn();
		if (this.gameState.timeout > 0) {
			this.timeout = setTimeout(async () => {
				this.setGameState({
					status: 'ended',
					reason: 'timeout',
					winner: 1 - turn,
				});
				await this.handleEndGame();
				this.sendGameUpdate();
			}, this.gameState.timeout);
		}
	}

	//not every subclass will use this - only for turn-based games with timer. Games with simultaneous turns may have to implement
	//their own similar methods after succesful moves are played.
	incrementTurn() {
		if (!this.gameState) return;

		const timerSetting = this.settings.timer;
		const oldTurn = this.getTurn(this.gameState);
		const currentTurn = this.gameState.turnsCompleted + 1;

		if (timerSetting === 'off' || !timerSetting) {
			this.setGameState({
				...this.gameState,
				turnsCompleted: currentTurn,
			});
			return;
		}

		const timeElapsed =
			currentTurn === 0 ? 0 : Date.now() - this.gameState.turnStart;

		this.setGameState({
			turnsCompleted: this.gameState.turnsCompleted + 1,
			players: this.gameState.players.map((p, i) => {
				if (i === oldTurn)
					return {
						...p,
						time:
							this.settings.timer === 'game'
								? Math.max(
										0,
										p.time - timeElapsed + this.settings.increment * 1000
								  )
								: this.settings.time * 60000,
						reserve:
							this.settings.timer === 'move'
								? p.reserve -
								  Math.max(0, timeElapsed - this.settings.time * 60000)
								: 0,
					};
				return p;
			}),
		});

		const turn = this.getTurn(this.getGameState());
		const currentPlayer = this.gameState.players[turn];
		this.setGameState({
			...this.gameState,
			turnStart: Date.now(),
			timeout:
				this.settings.timer === 'game'
					? currentPlayer.time
					: this.settings.timer === 'move'
					? currentPlayer.time + currentPlayer.reserve
					: -1,
		});
		if (this.gameState.timeout >= 0) this.startTurnClock();
	}

	constructor(settings, io) {
		this.matchId = uuidV4();
		this.settings = { ...settings };
		this.host = settings.host;
		this.io = io;
		this.pregameLength = pregameLength;
		this.PlayerModel = Player;
		delete this.settings.host;
	}
}

module.exports = GameManager;
