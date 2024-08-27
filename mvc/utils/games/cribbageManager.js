const { v4: uuidV4 } = require('uuid');
const GameManager = require('./_gameManager');
const CardDeck = require('../cardDeck');

class CribbageManager extends GameManager {
	verifySettings(settings) {
		let message = '';

		if (settings.timer) {
			if (settings.time < 15 || settings.time > 60)
				message = 'Time per move must be between 15 and 60 seconds';
			else if (settings.reserve < 0 || settings.reserve > 10)
				message = 'Reserve time must be between 0 and 10 minutes';
		} else if (settings.target !== 61 && settings.target !== 121)
			message = 'Target must be 61 or 121.';

		if (message) throw new Error(message);
	}

	startGame() {
		if (this.gameState.status !== 'waiting') return null;
		this.setGameState({
			active: true,
			status: 'pregame',
			message: {
				status: 'info',
				message: 'Game starting...',
				duration: this.pregameLength,
			},
		});
		this.sendGameUpdate();
		this.setGameState({ message: null });
		setTimeout(() => {
			//shuffle the deck
			this.deck.shuffle();
			this.setGameState({ status: 'pregame', stage: 'draw-for-crib' });
			const removedCards = [];
			this.gameState.playedCards = [];
			this.gameState.players.forEach((p, i) => {
				p.hand = [];
				//draw a card
				if (i === 0) p.hand.push(this.deck.drawCard());
				else {
					const other = this.gameState.players[0].hand[0];
					let card = this.deck.drawCard();
					while (card.value === other.value) {
						removedCards.push(card);
						card = this.deck.drawCard();
					}
					p.hand.push(card);
				}
			});
			if (
				this.gameState.players[0].hand[0].value <
				this.gameState.players[1].hand[0].value
			)
				this.gameState.crib = 0;
			else this.gameState.crib = 1;
			this.sendGameUpdate();
			this.deck.addRandom(removedCards);
			this.deck.addRandom(
				this.gameState.players.map((p) => {
					return p.hand[0];
				})
			);
			this.dealNewHand();
			this.setGameState({ status: 'playing', stage: 'crib' });
		}, this.pregameLength);
		return this.gameState;
	}

	dealNewHand() {
		this.deck.shuffle();
		this.gameState.players.forEach((p) => {
			p.hand = this.deck.draw(6);
		});
	}

	removePlayer(ind, reason) {
		console.log(`Removing player ${ind} (${reason})`);
		if ((ind !== 0) & (ind !== 1)) return this.gameState;

		const currentState = super.getGameState();
		if (!currentState.active && currentState.status !== 'playing')
			return this.gameState;

		const winner = 1 - ind;
		const endGameString = `${currentState.players[winner].user.name} wins (${reason})`;

		super.setGameState({
			status: 'ended',
			winner,
			endGameString,
			ranking: [
				{ ...currentState.players[winner], rank: 1 },
				{ ...currentState.players[1 - winner], rank: 2 },
			],
		});
		return {
			status: 'OK',
			gameState: this.getGameState(),
		};
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

		//moves to handle:
		//	- submitting cards to the crib
		//	- playing a card

		return {
			status: 'OK',
			gameState: super.getGameState(),
		};
	}

	startRematch() {
		return this.gameState;
	}

	constructor(settings, io) {
		super(settings, io);
		console.log('Initializing game manager for Cribbage');
		this.verifySettings(settings);
		this.gameName = 'cribbage';
		this.deck = new CardDeck();
		this.getTurn = (gameState) => {
			if (!gameState) return -1;
			return gameState.turnsCompleted % 2;
		};
		const timerState = {
			time: settings.timer ? settings.time * 1000 : null,
			reserve: settings.timer ? settings.reserve * 60 * 1000 : 0,
		};

		this.gameState = {
			active: false,
			status: 'waiting',
			stage: '',
			players: [
				{
					...timerState,
					timer: settings.timer,
					rematch: false,
					user: settings.host,
					hand: [],
					score: 0,
				},
				{
					...timerState,
					timer: settings.timer,
					rematch: false,
					user: null,
					hand: [],
					score: 0,
				},
			],
			handsCompleted: -1,
			turnsCompleted: -1,
		};
	}
}

module.exports = CribbageManager;
