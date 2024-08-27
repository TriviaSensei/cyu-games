const { v4: uuidV4 } = require('uuid');
const GameManager = require('./_gameManager');

class Get10Manager extends GameManager {
	verifySettings(settings) {
		let message = '';
		if (!['first', 'second', 'random'].includes(settings.go))
			message = 'Invalid order specified';
		else if (!['game', 'move', 'off'].includes(settings.timer))
			message = 'Invalid timer setting';
		else if (settings.timer === 'game') {
			if (settings.time < 1)
				message = 'Invalid game length - minimum is 5 minutes';
			else if (settings.increment < 0)
				message = 'Invalid increment length - must not be negative';
		} else if (settings.timer === 'move') {
			if (settings.time < 1)
				message = 'Invalid move timer length - minimum is 1 minute';
			else if (settings.reserve < 0)
				message = 'Invalid reserve length - must not be negative';
		}
		if (message) throw new Error(message);
	}

	getTurn(gameState) {
		if (!gameState && !this.getGameState()) return -1;
		if (!gameState) return this.getTurn(this.getGameState());
		return gameState.turnsCompleted % 2;
	}

	playMove = async (move) => {
		const currentState = this.getGameState();
		const player = currentState.players.findIndex((p) => {
			return p.user.id === move.user.id;
		});
		if (!currentState.active || currentState.status === 'pregame')
			return {
				status: 'fail',
				gameState: currentState,
				message: 'Game has not started.',
			};
		else if (currentState.status === 'ended')
			return {
				status: 'fail',
				gameState: currentState,
				message: 'Game has ended.',
			};
		//check if the move was legal - this game has very simple rules
		if (player !== this.getTurn(currentState))
			return {
				status: 'fail',
				gameState: currentState,
				message: "It's not your turn.",
			};

		const points = currentState.points + move.value;

		if (points > 10)
			return {
				status: 'fail',
				gameState: currentState,
				message: 'You may not go over 10 points.',
			};
		else if (points === 10) {
			//end game state
			const winner = currentState.turnsCompleted % 2;
			this.setGameState({
				points,
				status: 'ended',
				reason: '10 points reached',
				winner,
				ranking: [
					{ ...currentState.players[winner], rank: 1 },
					{ ...currentState.players[1 - winner], rank: 2 },
				],
			});
			await this.handleEndGame();
			this.sendGameUpdate();
		}
		//the move was legal but the game did not reach end state
		else {
			this.setGameState({
				points: currentState.points + move.value,
			});
			this.incrementTurn();
			this.sendGameUpdate();
		}

		return {
			status: 'OK',
		};
	};

	startGame() {
		if (this.gameState.status !== 'waiting') return;
		this.setGameState({
			active: true,
			status: 'pregame',
			message: {
				status: 'info',
				message: 'Game starting...',
				duration: this.pregameLength,
			},
		});
		if (this.settings.go === 'random') {
			const a = Math.random();
			if (a < 0.5) {
				this.gameState.players.unshift(this.gameState.players.pop());
			}
		} else if (
			(this.settings.go === 'first' &&
				this.gameState.players[0].id !== this.host.id) ||
			(this.settings.go === 'second' &&
				this.gameState.players[1].id !== this.host.id)
		) {
			this.gameState.players.unshift(this.gameState.players.pop());
		}
		this.sendGameUpdate();
		setTimeout(() => {
			this.setGameState({
				status: 'playing',
				message: null,
				turnStart: Date.now(),
			});
			this.incrementTurn();
			this.sendGameUpdate();
		}, this.pregameLength);
	}

	async handleEndGame() {
		if (this.gameState.status !== 'ended') return;
		if (this.timeout) clearTimeout(this.timeout);
		const winner = this.getGameState().winner;
		if (winner !== 0 && winner !== 1) return;

		const ratingChanges = await this.handleRatingChange(
			this.gameState.players[winner].user,
			this.gameState.players[1 - winner].user,
			1
		);

		const html = [
			{
				selector: 'h3',
				contents: `${this.gameState.players[winner].user.name} wins ${
					this.gameState.reason ? `(${this.gameState.reason})` : ''
				}`,
			},
			{
				selector: 'ol',
				contents: [
					{
						selector: 'li.winner',
						contents: `${this.gameState.players[winner].user.name} (${ratingChanges[0].oldRating} &rarr; ${ratingChanges[0].newRating})`,
					},
					{
						selector: 'li.second',
						contents: `${this.gameState.players[1 - winner].user.name} (${
							ratingChanges[1].oldRating
						} &rarr; ${ratingChanges[1].newRating})`,
					},
				],
			},
		];
		this.setGameState({
			html,
			ratingChanges,
		});
	}

	async removePlayer(id, reason) {
		console.log(`Removing player ${id} (${reason})`);

		const currentState = this.getGameState();
		if (!currentState.active && currentState.status !== 'playing')
			return {
				status: 'fail',
				message: 'Game is not active.',
				gameState: currentState,
			};

		const ind = this.gameState.players.findIndex((p) => {
			return p.user.id === id;
		});
		if (ind === -1)
			return {
				status: 'fail',
				message: 'Player ID not found.',
				gameState: currentState,
			};

		this.setGameState({
			status: 'ended',
			reason: 'disconnect',
			winner: 1 - ind,
		});

		await this.handleEndGame();
		this.sendGameUpdate();
	}

	requestPlayerDrop(id) {
		return { ...super.requestPlayerDrop(), toDelete: true };
	}

	startRematch() {
		this.gameState = {
			...this.gameState,
			active: true,
			status: 'pregame',
			message: {
				status: 'info',
				message: 'Game starting...',
				duration: this.pregameLength,
			},
			turnsCompleted: -1,
			points: 0,
		};
		//switch player order
		this.gameState.players.unshift(this.gameState.players.pop());
		//reset player clocks
		this.gameState.players = this.gameState.players.map((p) => {
			return {
				...p,
				time:
					this.settings.timer === 'off' ? null : this.settings.time * 60 * 1000,
				increment:
					this.settings.timer === 'game' ? this.settings.increment * 1000 : 0,
				reserve:
					this.settings.timer === 'move'
						? this.settings.reserve * 60 * 1000
						: 0,
				timer: this.settings.timer,
				rematch: false,
			};
		});
		this.sendGameUpdate();
		setTimeout(() => {
			this.setGameState({
				status: 'playing',
				message: null,
				turnStart: Date.now(),
			});
			this.incrementTurn();
			this.sendGameUpdate();
		}, this.pregameLength);
	}

	timeOutFunction() {}

	constructor(settings, io) {
		super(settings, io);
		console.log('Initializing game manager for get10');
		this.verifySettings(settings);
		this.gameName = 'get10';

		this.timeoutFunction = async () => {
			this.setGameState({
				status: 'ended',
				reason: 'timeout',
				winner: 1 - this.getTurn(),
			});
			await this.handleEndGame();
		};

		const timerState = {
			time: settings.timer === 'off' ? null : settings.time * 60 * 1000,
			increment: settings.timer === 'game' ? settings.increment * 1000 : 0,
			reserve: settings.timer === 'move' ? settings.reserve * 60 * 1000 : 0,
		};

		this.gameState = {
			active: false,
			status: 'waiting',
			players: [
				{
					...timerState,
					timer: settings.timer,
					rematch: false,
					user: settings.go !== 'second' ? settings.host : null,
				},
				{
					...timerState,
					timer: settings.timer,
					rematch: false,
					user: settings.go === 'second' ? settings.host : null,
				},
			],
			turnsCompleted: -1,
			points: 0,
		};
	}
}

module.exports = Get10Manager;
