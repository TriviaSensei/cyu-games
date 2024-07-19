const { v4: uuidV4 } = require('uuid');
const GameManager = require('./gameManager');

class get10Rules extends GameManager {
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

	startGame() {
		super.setGameState({
			active: true,
			status: 'pregame',
			message: { status: 'info', message: 'Game starting...', duration: 3000 },
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
		return this.gameState;
	}

	addPlayer(user) {
		const result = super.addPlayer(user);

		if (
			result.playerAdded &&
			this.gameState.players.every((p) => {
				return p.user;
			})
		) {
			return {
				...result,
				gameState: this.startGame(),
			};
		}
		return result;
	}

	playMove(move) {
		const currentState = super.getGameState();
		const player = currentState.players.findIndex((p) => {
			return p.user.id === move.user.id;
		});
		if (!currentState.active || currentState.status !== 'playing')
			return {
				status: 'fail',
				gameState: currentState,
				message: 'Game has not started.',
			};
		//check if the move was legal - this game has very simple rules, so every move is legal if it's your turn
		if (player !== currentState.turnsCompleted % 2)
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
		else if (points === 10)
			//end game state
			super.setGameState({
				points,
				status: 'ended',
				winner: currentState.turnsCompleted % 2,
			});
		//the move was legal but the game did not reach end state
		else
			super.setGameState({
				points: currentState.points + move.value,
			});

		this.incrementTurn();

		return {
			status: 'OK',
			gameState: super.getGameState(),
		};
	}

	constructor(settings) {
		super(settings);
		console.log('Initializing game manager for get10');
		this.verifySettings(settings);
		this.getTurn = (gameState) => {
			if (!gameState) return -1;
			return gameState.turnsCompleted % 2;
		};
		const timerState = {
			time: settings.timer === 'off' ? null : settings.time * 60 * 1000,
			increment: settings.timer === 'game' ? settings.increment * 1000 : 0,
			reserve: settings.timer === 'move' ? settings.reserve * 60 * 1000 : 0,
		};

		this.gameState = {
			active: false,
			players: [
				{
					...timerState,
					timer: settings.timer,
					user: settings.go !== 'second' ? settings.host : null,
				},
				{
					...timerState,
					timer: settings.timer,
					user: settings.go === 'second' ? settings.host : null,
				},
			],
			turnsCompleted: 0,
			points: 0,
		};
		// this.timerManager = new TimerManager(this, (gameState) => {
		// 	return gameState.turnsCompleted % 2;
		// });
	}
}

module.exports = get10Rules;
