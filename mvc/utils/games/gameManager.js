const { v4: uuidV4 } = require('uuid');

class GameManager {
	getMatchId() {
		return this.matchId;
	}

	getGameState() {
		return { ...this.gameState };
	}

	getPlayers() {
		return this.gameState.players;
	}

	getSettings() {
		return this.settings;
	}

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
			if (p.id === id) {
				items.forEach((i) => {
					p[i] = data[i];
				});
				return true;
			}
		});
	}

	addPlayer(user) {
		//see if the player is already in the game - if so, update their information (possibly a reconnect, so they'll need a new socket ID, etc.)
		let playerAdded = false;
		let playerUpdated = false;
		if (
			!this.gameState.players.some((p) => {
				if (p.user?.id === user.id) {
					playerUpdated = true;
					p.user.socketId = user.socketId;
					return true;
				}
			})
		) {
			//if not, add them
			if (
				!this.gameState.players.some((p) => {
					if (!p.user) {
						playerAdded = true;
						p.user = {
							id: user.id,
							socketId: user.socketId,
							name: user.name,
							rating: user.rating || 'Unr',
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

		return {
			playerAdded,
			playerUpdated,
			status: 'OK',
			gameState: this.gameState,
		};
	}

	incrementTurn() {
		if (!this.gameState) return;
		if (!this.gameState.status === 'playing') return;
		const timerSetting = this.settings.timer;
		const oldTurn = this.getTurn(this.gameState);

		if (timerSetting === 'off') {
			this.setGameState({
				...this.gameState,
				turnsCompleted: gameState.turnsCompleted + 1,
			});
		}

		const timeElapsed = Date.now() - this.gameState.turnStart;

		this.setGameState({
			turnsCompleted: this.gameState.turnsCompleted + 1,
			players: this.gameState.players.map((p, i) => {
				if (i === oldTurn)
					return {
						...p,
						time:
							this.settings.timer === 'game'
								? Math.max(0, p.time - timeElapsed + this.settings.increment)
								: this.settings.time,
						reserve:
							this.settings.timer === 'move'
								? p.reserve - Math.max(0, timeElapsed - this.settings.time)
								: 0,
					};
				return p;
			}),
		});

		const turn = this.getTurn(this.getGameState());
		this.setGameState({
			...this.gameState,
			turnStart: Date.now(),
		});
	}

	constructor(settings) {
		this.matchId = uuidV4();
		this.settings = { ...settings };
		this.host = settings.host;
		delete this.settings.host;
	}
}

module.exports = GameManager;
